"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getProfile,
  getDocuments,
  getFamilyMembers,
  getReferences,
  type ProfileData,
  type CapturedDocument,
  type FamilyMember,
  type SchemeReference,
} from "@/lib/profile-vault";
import { CursorToggle } from "@/components/BharatLink/CursorToggle";

/** Circular progress ring — SVG, gradient stroke, animated. */
function DataRing({
  id,
  value,
  label,
  sub,
  size = 128,
}: {
  id: string;
  value: number;
  label: string;
  sub: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{Math.round(pct * 100)}%</span>
          <span className="text-[10px] text-slate-400">{sub}</span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

const PROFILE_FIELDS: { key: keyof ProfileData; label: string }[] = [
  { key: "fullName", label: "Full name" },
  { key: "fatherName", label: "Father's name" },
  { key: "dob", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "aadhaarNumber", label: "Aadhaar number" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "district", label: "District" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "occupation", label: "Occupation" },
  { key: "annualIncome", label: "Annual income" },
  { key: "category", label: "Category" },
  { key: "education", label: "Education" },
  { key: "bankAccount", label: "Bank account" },
  { key: "rationCardType", label: "Ration card" },
  { key: "landOwnership", label: "Land ownership" },
  { key: "maritalStatus", label: "Marital status" },
];

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData>({});
  const [docs, setDocs] = useState<CapturedDocument[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [refs, setRefs] = useState<SchemeReference[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, d, f, r] = await Promise.all([
        getProfile().catch(() => ({}) as ProfileData),
        getDocuments().catch(() => [] as CapturedDocument[]),
        getFamilyMembers().catch(() => [] as FamilyMember[]),
        getReferences().catch(() => [] as SchemeReference[]),
      ]);
      if (!alive) return;
      setProfile(p);
      setDocs(d);
      setFamily(f);
      setRefs(r);
      try {
        const est = await navigator.storage?.estimate?.();
        if (alive && est && typeof est.usage === "number" && typeof est.quota === "number" && est.quota > 0) {
          setStorage({ usage: est.usage, quota: est.quota });
        }
      } catch {
        /* storage estimate unsupported */
      }
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filled = PROFILE_FIELDS.filter((f) => {
    const v = profile[f.key];
    return typeof v === "string" && v.trim().length > 0;
  });
  const completeness = PROFILE_FIELDS.length ? filled.length / PROFILE_FIELDS.length : 0;
  const storagePct = storage && storage.quota ? Math.min(1, storage.usage / storage.quota) : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 pb-24 pt-28">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Settings · Your data vault</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
            Everything BharatLink knows about you
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            All extracted data is AES-GCM encrypted and stored only in this browser (IndexedDB) — nothing ever
            reaches a server. This page is your window into that vault.
          </p>
        </div>
        <CursorToggle className="shrink-0" />
      </div>

      {/* ── Circular rings ── */}
      <section className="glass-card flex flex-wrap items-center justify-around gap-6 rounded-3xl border border-orange-500/15 p-6">
        <DataRing id="ring-profile" value={completeness} label="Profile" sub={`${filled.length}/${PROFILE_FIELDS.length}`} />
        <DataRing
          id="ring-storage"
          value={storagePct}
          label="Storage"
          sub={storage ? fmtBytes(storage.usage) : "—"}
        />
        <DataRing
          id="ring-docs"
          value={Math.min(1, docs.length / 10)}
          label="Documents"
          sub={`${docs.length} captured`}
        />
      </section>

      {/* ── Extracted profile report ── */}
      <section className="rounded-3xl border border-orange-500/15 bg-white/60 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Extracted profile data</h2>
        <p className="mt-1 text-xs text-slate-500">
          Filled by the Aadhaar scan, voice onboarding, and the agent&apos;s profile tools.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROFILE_FIELDS.map(({ key, label }) => {
            const v = profile[key];
            const has = typeof v === "string" && v.trim().length > 0;
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                  has ? "border-green-500/20 bg-green-50/60" : "border-slate-200 bg-white/50"
                }`}
              >
                <span className="text-slate-500">{label}</span>
                <span className={`ml-3 truncate font-medium ${has ? "text-slate-900" : "text-slate-300"}`}>
                  {has ? (v as string) : "not filled yet"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Documents & references ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-orange-500/15 bg-white/60 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Captured documents</h2>
          {docs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Nothing captured yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {docs.slice(0, 6).map((doc) => (
                <li key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-slate-800">{doc.label || doc.type}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">
                    {new Date(doc.capturedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
              {docs.length > 6 && <li className="text-xs text-slate-400">+{docs.length - 6} more…</li>}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-orange-500/15 bg-white/60 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Family & scheme references</h2>
          <div className="mt-3 flex gap-6">
            <div>
              <p className="text-2xl font-bold text-slate-900">{family.length}</p>
              <p className="text-xs text-slate-400">Family members</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{refs.length}</p>
              <p className="text-xs text-slate-400">Scheme references</p>
            </div>
          </div>
          {refs.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {refs.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-slate-800">{r.schemeName}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">{r.referenceNumber}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Privacy note ── */}
      <section className="rounded-3xl border border-green-500/20 bg-green-50/70 p-5">
        <p className="text-sm font-semibold text-green-900">🔒 Privacy by design</p>
        <p className="mt-1 text-xs leading-relaxed text-green-800/80">
          The encryption key lives in this browser&apos;s localStorage — clearing it permanently destroys the vault,
          by design. Document images are read by the vision API and immediately discarded; nothing is persisted
          server-side.
        </p>
      </section>

      <Link href="/dashboard" className="text-center text-sm text-slate-500 underline-offset-4 hover:underline">
        ← Back to dashboard
      </Link>

      {!loaded && <p className="text-center text-xs text-slate-400">Loading vault…</p>}
    </main>
  );
}
