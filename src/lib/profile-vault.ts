/**
 * On-device encrypted profile vault using IndexedDB + SubtleCrypto.
 *
 * All personal data (answers, Aadhaar fields, documents, reference numbers)
 * stays on the device. The encryption key is derived from a stable device
 * identifier stored in localStorage; if cleared the vault is unrecoverable
 * by design — no server backup.
 */

const DB_NAME = "formsaathi_vault";
const DB_VERSION = 1;

const STORES = {
  profile: "profile",
  documents: "documents",
  references: "references",
  family: "family",
} as const;

const KEY_STORAGE = "formsaathi_vault_key";

export interface ProfileData {
  fullName?: string;
  fatherName?: string;
  dob?: string;
  gender?: string;
  aadhaarNumber?: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  occupation?: string;
  annualIncome?: string;
  category?: string;
  education?: string;
  bankAccount?: string;
  rationCardType?: string;
  landOwnership?: string;
  disabilityStatus?: string;
  maritalStatus?: string;
  numberOfDependents?: string;
  [key: string]: string | undefined;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  profileData: ProfileData;
  createdAt: number;
}

export interface CapturedDocument {
  id: string;
  type: string;
  label: string;
  imageData: string;
  extractedFields: Record<string, string>;
  capturedAt: number;
  qualityScore: number;
}

export interface SchemeReference {
  id: string;
  schemeName: string;
  schemeId: string;
  referenceNumber: string;
  submittedAt: number;
  portalUrl: string;
  status: "submitted" | "pending" | "approved" | "rejected";
  familyMemberId?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getEncryptionKey(): Promise<CryptoKey> {
  let raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    raw = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(KEY_STORAGE, raw);
  }
  const keyData = new Uint8Array(
    raw.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
  );
  return crypto.subtle.importKey("raw", keyData, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = new Uint8Array(
    atob(data)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

async function putEncrypted<T>(
  storeName: string,
  id: string,
  value: T,
): Promise<void> {
  const db = await openDB();
  const encrypted = await encrypt(JSON.stringify(value));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put({ id, data: encrypted });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDecrypted<T>(
  storeName: string,
  id: string,
): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = async () => {
      if (!req.result) {
        resolve(null);
        return;
      }
      try {
        const decrypted = await decrypt(req.result.data);
        resolve(JSON.parse(decrypted) as T);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAllDecrypted<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = async () => {
      const results: T[] = [];
      for (const row of req.result) {
        try {
          const decrypted = await decrypt(row.data);
          results.push(JSON.parse(decrypted) as T);
        } catch {
          /* corrupted entry, skip */
        }
      }
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteEntry(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Profile ---

export async function saveProfile(data: ProfileData): Promise<void> {
  const existing = (await getDecrypted<ProfileData>(STORES.profile, "self")) ?? {};
  await putEncrypted(STORES.profile, "self", { ...existing, ...data });
}

export async function getProfile(): Promise<ProfileData> {
  return (await getDecrypted<ProfileData>(STORES.profile, "self")) ?? {};
}

// --- Family ---

export async function saveFamilyMember(member: FamilyMember): Promise<void> {
  await putEncrypted(STORES.family, member.id, member);
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  return getAllDecrypted<FamilyMember>(STORES.family);
}

export async function deleteFamilyMember(id: string): Promise<void> {
  await deleteEntry(STORES.family, id);
}

// --- Documents ---

export async function saveDocument(doc: CapturedDocument): Promise<void> {
  await putEncrypted(STORES.documents, doc.id, doc);
}

export async function getDocuments(): Promise<CapturedDocument[]> {
  return getAllDecrypted<CapturedDocument>(STORES.documents);
}

export async function getDocumentById(
  id: string,
): Promise<CapturedDocument | null> {
  return getDecrypted<CapturedDocument>(STORES.documents, id);
}

export async function deleteDocument(id: string): Promise<void> {
  await deleteEntry(STORES.documents, id);
}

// --- References ---

export async function saveReference(ref: SchemeReference): Promise<void> {
  await putEncrypted(STORES.references, ref.id, ref);
}

export async function getReferences(): Promise<SchemeReference[]> {
  return getAllDecrypted<SchemeReference>(STORES.references);
}

export async function getReferenceById(
  id: string,
): Promise<SchemeReference | null> {
  return getDecrypted<SchemeReference>(STORES.references, id);
}
