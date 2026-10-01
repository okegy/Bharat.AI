"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDueRenewals,
  logVaultAccess,
  parseRenewals,
  renewalLine,
  serializeRenewals,
  type DueRenewal,
} from "@/lib/vault-log";
import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";

const DEMO_RENEWALS = {
  rationCardRenewal: "2027-03-15",
  voterRollVerification: "2026-12-01",
  lpgKycDue: "2026-11-20",
  pmsbyPremiumDue: "2027-05-31",
  pmjjbyPremiumDue: "2027-05-31",
  taxFilingDeadline: "2026-07-31",
  privateInsurancePremiumDue: "",
};

/**
 * Notification bell — shows a badge count of vault renewals due within 30
 * days, with a dropdown listing each one soonest first. Optional local
 * browser notifications (permission-gated, purely on-device).
 */
export function VaultBell() {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState<DueRenewal[]>([]);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [notifState, setNotifState] = useState<NotificationPermission | "unsupported">("default");
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const profile = await getProfile().catch(() => ({}) as ProfileData);
    const schedule = parseRenewals(profile as { renewals?: string });
    setDue(getDueRenewals(schedule));
    setHasSchedule(Object.values(schedule).some(Boolean));
  }, []);

  useEffect(() => {
    void load();
    setNotifState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [load]);

  const loadDemo = useCallback(async () => {
    const profile = await getProfile().catch(() => ({}) as ProfileData);
    await saveProfile({ renewals: serializeRenewals(DEMO_RENEWALS) } as ProfileData);
    await logVaultAccess({ source: "vault-bell", dataCategory: "renewals", action: "write" });
    void load();
    void profile;
  }, [load]);

  const enableBrowserReminders = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifState(perm);
    if (perm === "granted") {
      for (const r of due.slice(0, 3)) {
        new Notification("BharatLink reminder", { body: renewalLine(r) });
      }
    }
  }, [due]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Renewal reminders${due.length ? ` (${due.length} due)` : ""}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-500/30 text-orange-600 transition hover:bg-orange-500/10"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {due.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white shadow">
            {due.length}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-card absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-orange-500/25 p-4 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">
            Renewal reminders
          </p>
          {!hasSchedule ? (
            <div className="mt-2">
              <p className="text-sm text-bharatlink-navy/60">
                No renewal dates yet. Load sample dates to see this in action.
              </p>
              <button
                type="button"
                onClick={() => void loadDemo()}
                className="mt-3 w-full rounded-full border border-orange-500/30 px-4 py-2 text-xs font-bold text-orange-600 transition hover:bg-orange-500/10"
              >
                Load demo renewal dates
              </button>
            </div>
          ) : due.length === 0 ? (
            <p className="mt-2 text-sm text-bharatlink-navy/60">
              Nothing due in the next 30 days. You&apos;re all caught up ✓
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {due.map((r) => (
                <li
                  key={r.key}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    r.daysUntil < 0
                      ? "border-red-300/50 bg-red-50/70 text-red-800"
                      : r.daysUntil <= 7
                        ? "border-orange-300/50 bg-orange-50/70 text-orange-900"
                        : "border-bharatlink-sand bg-white/60 text-bharatlink-navy/80"
                  }`}
                >
                  {renewalLine(r)}
                  <span className="ml-1 text-xs opacity-60">({r.date})</span>
                </li>
              ))}
            </ul>
          )}
          {hasSchedule && due.length > 0 && notifState !== "granted" && notifState !== "unsupported" && (
            <button
              type="button"
              onClick={() => void enableBrowserReminders()}
              className="mt-3 w-full rounded-full bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:from-orange-500 hover:to-amber-500"
            >
              Enable on-device reminders
            </button>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-bharatlink-navy/40">
            Reminders are generated on this device from your own vault data. Nothing is sent to any
            server.
          </p>
        </div>
      )}
    </div>
  );
}
