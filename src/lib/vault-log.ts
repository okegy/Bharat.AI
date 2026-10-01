/**
 * In-app vault access log — encrypted, client-side, per-device.
 *
 * Logs ONLY metadata about vault accesses (timestamp, source, dataCategory,
 * action) — never the accessed values themselves. Stored in its own IndexedDB
 * with the same AES-GCM device-key pattern as the profile vault, so there is
 * no unencrypted storage path.
 */

const LOG_DB = "BharatLink_vault_log";
const LOG_VERSION = 1;
const LOG_STORE = "accessLog";
const KEY_STORAGE = "bharatlink_vault_log_key";
const MAX_ENTRIES = 500;

export interface VaultAccessEntry {
  timestamp: number;
  source: string;
  dataCategory: string;
  action: "read" | "write";
}

/** More than this many vault accesses within an hour gets a visual flag. */
export const ACCESS_BURST_THRESHOLD = 20;

function openLogDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOG_DB, LOG_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOG_STORE)) {
        const store = db.createObjectStore(LOG_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("ts", "ts", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getLogKey(): Promise<CryptoKey> {
  return (async () => {
    let raw = localStorage.getItem(KEY_STORAGE);
    if (!raw) {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      raw = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KEY_STORAGE, raw);
    }
    const keyData = new Uint8Array(raw.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return crypto.subtle.importKey("raw", keyData, "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
}

async function encryptPayload(data: string): Promise<{ iv: string; data: string }> {
  const key = await getLogKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(data),
  );
  const b64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { iv: b64(iv), data: b64(ciphertext) };
}

async function decryptPayload(rec: { iv: string; data: string }): Promise<string> {
  const key = await getLogKey();
  const iv = new Uint8Array(
    atob(rec.iv)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const ciphertext = new Uint8Array(
    atob(rec.data)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/** Record a vault access. Never throws — logging must not break the app. */
export async function logVaultAccess(entry: {
  source: string;
  dataCategory: string;
  action: "read" | "write";
}): Promise<void> {
  try {
    const full: VaultAccessEntry = { timestamp: Date.now(), ...entry };
    const payload = await encryptPayload(JSON.stringify(full));
    const db = await openLogDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOG_STORE, "readwrite");
      tx.objectStore(LOG_STORE).add({ ts: full.timestamp, ...payload });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Trim oldest entries beyond the cap (best-effort)
    try {
      const db2 = await openLogDB();
      const tx = db2.transaction(LOG_STORE, "readwrite");
      const store = tx.objectStore(LOG_STORE);
      const countReq = store.count();
      countReq.onsuccess = () => {
        const extra = countReq.result - MAX_ENTRIES;
        if (extra > 0) {
          const cursorReq = store.openCursor();
          let removed = 0;
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor && removed < extra) {
              cursor.delete();
              removed++;
              cursor.continue();
            }
          };
        }
      };
    } catch {
      /* trim is best-effort */
    }
  } catch {
    /* never break the calling feature */
  }
}

/** Reverse-chronological access log (metadata only). */
export async function getVaultLog(limit = 100): Promise<VaultAccessEntry[]> {
  try {
    const db = await openLogDB();
    const records = await new Promise<Array<{ ts: number; iv: string; data: string }>>(
      (resolve, reject) => {
        const tx = db.transaction(LOG_STORE, "readonly");
        const req = tx.objectStore(LOG_STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );
    const entries: VaultAccessEntry[] = [];
    for (const rec of records) {
      try {
        entries.push(JSON.parse(await decryptPayload(rec)) as VaultAccessEntry);
      } catch {
        /* skip corrupt rows */
      }
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}

/** Number of vault accesses within the trailing window (anomaly flag helper). */
export async function getRecentAccessCount(windowMs = 3_600_000): Promise<number> {
  const entries = await getVaultLog(MAX_ENTRIES);
  const cutoff = Date.now() - windowMs;
  return entries.filter((e) => e.timestamp >= cutoff).length;
}

/* ── Renewals helpers (Part A) ──────────────────────────── */

export interface RenewalSchedule {
  rationCardRenewal?: string;
  voterRollVerification?: string;
  lpgKycDue?: string;
  pmsbyPremiumDue?: string;
  pmjjbyPremiumDue?: string;
  taxFilingDeadline?: string;
  privateInsurancePremiumDue?: string;
}

export const RENEWAL_LABELS: Record<keyof RenewalSchedule, string> = {
  rationCardRenewal: "Ration card renewal",
  voterRollVerification: "Voter roll verification",
  lpgKycDue: "LPG KYC",
  pmsbyPremiumDue: "PMSBY insurance premium",
  pmjjbyPremiumDue: "PMJJBY insurance premium",
  taxFilingDeadline: "Income tax filing",
  privateInsurancePremiumDue: "Private insurance premium",
};

export function parseRenewals(profile: { renewals?: string }): RenewalSchedule {
  try {
    return JSON.parse(profile.renewals ?? "{}") as RenewalSchedule;
  } catch {
    return {};
  }
}

export function serializeRenewals(r: RenewalSchedule): string {
  return JSON.stringify(r);
}

export interface DueRenewal {
  key: keyof RenewalSchedule;
  label: string;
  date: string;
  daysUntil: number;
}

/** Renewals due within 30 days (or overdue), soonest first. */
export function getDueRenewals(schedule: RenewalSchedule, horizonDays = 30): DueRenewal[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DueRenewal[] = [];
  for (const [key, date] of Object.entries(schedule)) {
    if (!date) continue;
    const due = new Date(date + "T00:00:00");
    if (isNaN(due.getTime())) continue;
    const daysUntil = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (daysUntil <= horizonDays) {
      out.push({
        key: key as keyof RenewalSchedule,
        label: RENEWAL_LABELS[key as keyof RenewalSchedule] ?? key,
        date,
        daysUntil,
      });
    }
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil);
  return out;
}

export function renewalLine(r: DueRenewal): string {
  if (r.daysUntil < 0) return `${r.label} is overdue by ${-r.daysUntil} day${-r.daysUntil === 1 ? "" : "s"}`;
  if (r.daysUntil === 0) return `${r.label} is due today`;
  return `${r.label} is due in ${r.daysUntil} day${r.daysUntil === 1 ? "" : "s"}`;
}
