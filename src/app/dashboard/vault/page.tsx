"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/BharatLink/TopBar";
import { getProfile, type ProfileData } from "@/lib/profile-vault";
import {
  ACCESS_BURST_THRESHOLD,
  getDueRenewals,
  getRecentAccessCount,
  getVaultLog,
  logVaultAccess,
  parseRenewals,
  renewalLine,
  serializeRenewals,
  RENEWAL_LABELS,
  type RenewalSchedule,
  type VaultAccessEntry,
} from "@/lib/vault-log";
import { useAppLanguage } from "@/lib/app-language";

const SERVICE_CARDS: {
  key: keyof RenewalSchedule;
  title: string;
  desc: string;
  href: string;
}[] = [
  { key: "rationCardRenewal", title: "Ration Card", desc: "NFSA entitlements and renewal dates.", href: "/documents" },
  { key: "voterRollVerification", title: "Voter ID", desc: "Roll verification status from your vault.", href: "/documents" },
  { key: "lpgKycDue", title: "LPG Connection", desc: "KYC due dates and subsidy linkage.", href: "/form-fill" },
  { key: "taxFilingDeadline", title: "Income Tax", desc: "Filing deadlines with voice guidance.", href: "/assistant" },
  { key: "pmsbyPremiumDue", title: "Insurance (PMSBY/PMJJBY)", desc: "Premium due dates for both schemes.", href: "/eligibility" },
  { key: "privateInsurancePremiumDue", title: "Private Insurance", desc: "Policy premium tracking from your vault.", href: "/documents" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function VaultHubPage() {
  const { language } = useAppLanguage();
  const [profile, setProfile] = useState<ProfileData>({});
  const [log, setLog] = useState<VaultAccessEntry[]>([]);
  const [burst, setBurst] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    const profile = await getProfile().catch(() => ({}) as ProfileData);
    setProfile(profile);
    setLog(await getVaultLog(60));
    setBurst(await getRecentAccessCount());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void (async () => {
      await logVaultAccess({ source: "/dashboard/vault", dataCategory: "profile", action: "read" });
      await loadAll();
    })();
  }, [loadAll]);

  const schedule = parseRenewals(profile as { renewals?: string });
  const due = getDueRenewals(schedule);
  const hasSchedule = Object.values(schedule).some(Boolean);

  const loadDemo = useCallback(async () => {
    await logVaultAccess({ source: "/dashboard/vault", dataCategory: "renewals", action: "write" });
    await loadAll();
  }, [loadAll]);

  return (
    <>
      <TopBar />
      <main className="mx-auto min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-24 sm:px-6">
        {/* ── Header ── */}
        <section className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
              Central vault hub
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-bharatlink-navy">
              Your documents &amp; reminders
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full border border-amber-400/50 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Demo data
              </span>
              <span className="text-xs text-bharatlink-navy/50">
                All data encrypted on this device — never on a server.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDemo()}
              className="rounded-full border border-orange-500/30 px-4 py-2 text-xs font-bold text-orange-600 transition hover:bg-orange-500/10"
            >
              {hasSchedule ? "Reset demo renewal dates" : "Load demo renewal dates"}
            </button>
            <Link
              href="/dashboard"
              className="rounded-full border border-bharatlink-sand px-4 py-2 text-xs font-bold text-bharatlink-navy transition hover:bg-white"
            >
              Dashboard
            </Link>
          </div>
        </section>

        {/* ── Renewals widget (Part A) ── */}
        <section className="mb-6 glass-card rounded-3xl border border-orange-500/20 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-bharatlink-navy">
              Renewals &amp; deadlines
            </h2>
            <span className="text-xs text-bharatlink-navy/50">next 30 days</span>
          </div>
          {!hasSchedule ? (
            <p className="mt-2 text-sm text-bharatlink-navy/50">
              No renewal dates saved yet — use “Load demo renewal dates” above to preview.
            </p>
          ) : due.length === 0 ? (
            <p className="mt-2 text-sm text-bharatlink-navy/60">
              Nothing due in the next 30 days ✓
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {due.map((r) => (
                <li
                  key={r.key}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    r.daysUntil < 0
                      ? "border-red-300/50 bg-red-50/70 text-red-800"
                      : r.daysUntil <= 7
                        ? "border-orange-300/50 bg-orange-50/70 text-orange-900"
                        : "border-bharatlink-sand bg-white/60 text-bharatlink-navy/80"
                  }`}
                >
                  {renewalLine(r)}
                  <span className="ml-1 text-xs opacity-60">({fmtDate(r.date)})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Service summary cards (Part C) ── */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SERVICE_CARDS.map((card) => {
            const date = schedule[card.key];
            return (
              <Link
                key={card.key}
                href={card.href}
                className="group rounded-2xl glass-card border border-orange-500/20 p-4 transition hover:border-orange-500/60"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-bharatlink-navy group-hover:text-orange-600 transition">
                    {card.title}
                  </p>
                  <svg className="h-4 w-4 text-orange-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <p className="mt-1 text-xs text-bharatlink-navy/55">{card.desc}</p>
                <p className="mt-2 text-xs font-semibold text-bharatlink-navy/70">
                  {date ? (
                    <>
                      {RENEWAL_LABELS[card.key]}: <span className="text-orange-600">{fmtDate(date)}</span>
                    </>
                  ) : (
                    <span className="text-bharatlink-navy/40">No date on record</span>
                  )}
                </p>
              </Link>
            );
          })}
        </section>

        {/* ── Access log panel (Part B) ── */}
        <section className="glass-card rounded-3xl border border-orange-500/20 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-bharatlink-navy">
              Security &amp; access log
            </h2>
            {burst > ACCESS_BURST_THRESHOLD && (
              <span className="rounded-full border border-amber-400/60 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                ⚠ Unusual activity: {burst} accesses in the last hour
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-bharatlink-navy/50">
            Every time a part of BharatLink reads or writes your vault data, it is recorded here —
            within this app only. Entries contain access metadata, never the values themselves.
          </p>
          {loaded && log.length === 0 ? (
            <p className="mt-3 text-sm text-bharatlink-navy/50">No accesses recorded yet.</p>
          ) : (
            <ol className="mt-4 space-y-0">
              {log.map((entry, i) => (
                <li key={`${entry.timestamp}-${i}`} className="relative flex gap-3 pb-4 pl-2">
                  {i < log.length - 1 && (
                    <span className="absolute left-[7px] top-4 h-full w-px bg-bharatlink-sand" aria-hidden />
                  )}
                  <span
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      entry.action === "write"
                        ? "border-orange-500 bg-orange-100"
                        : "border-slate-400 bg-slate-100"
                    }`}
                  />
                  <div className="text-sm">
                    <p className="text-bharatlink-navy">
                      <span className="font-semibold">{entry.source}</span>{" "}
                      <span className={entry.action === "write" ? "text-orange-600" : "text-bharatlink-navy/60"}>
                        {entry.action === "write" ? "updated" : "read"}
                      </span>{" "}
                      <span className="text-bharatlink-navy/80">{entry.dataCategory}</span>
                    </p>
                    <p className="text-xs text-bharatlink-navy/40">{fmtTime(entry.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-bharatlink-navy/40">
          Reminders and the access log are generated on this device from your own encrypted vault —
          no SMS, push, or server monitoring is involved.
        </p>
      </main>
    </>
  );
}
