"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import {
  needsVaultBiometricUnlock,
  verifyDevicePasskey,
  resetStoredPasskey,
  markVaultSessionUnlocked,
} from "@/lib/biometric-storage";

type GateState = "unknown" | "open" | "locked";

/**
 * For users who registered a device passkey: prompts fingerprint / face / screen
 * lock before showing vault-backed pages. Skipped-passkey users pass through.
 *
 * Auto-triggers the biometric prompt as soon as the lock screen mounts, so the
 * user sees the OS-level fingerprint / face dialog immediately without needing
 * to tap a button first.
 */
export function VaultUnlockGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [gate, setGate] = useState<GateState>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const autoTriggered = useRef(false);
  const failCount = useRef(0);

  useEffect(() => {
    setGate(needsVaultBiometricUnlock() ? "locked" : "open");
  }, []);

  const onUnlock = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyDevicePasskey();
      setGate("open");
    } catch (e) {
      failCount.current += 1;
      setError(e instanceof Error ? e.message : t("biometric.somethingWentWrong"));
      if (failCount.current >= 2) {
        setShowReset(true);
      }
    } finally {
      setBusy(false);
    }
  }, [t]);

  useEffect(() => {
    if (gate !== "locked") return;
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    const timer = setTimeout(() => void onUnlock(), 400);
    return () => clearTimeout(timer);
  }, [gate, onUnlock]);

  const onReset = useCallback(() => {
    resetStoredPasskey();
    markVaultSessionUnlocked();
    setGate("open");
  }, []);

  if (gate === "unknown") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
      </div>
    );
  }

  if (gate === "open") {
    return <>{children}</>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 pb-24 pt-28">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
          {t("auth.protectedDetails")}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-saathi-ink">
          {t("auth.unlockToContinue")}
        </h1>
        <p className="mt-2 text-sm text-saathi-ink/60">
          {t("auth.unlockDescription")}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void onUnlock()}
        className="rounded-full bg-saathi-forest py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink disabled:opacity-50"
      >
        {busy ? t("auth.waiting") : t("auth.unlockWithDevice")}
      </button>

      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-800 transition hover:bg-red-100"
        >
          {t("auth.resetBiometric")}
        </button>
      )}

      <Link
        href="/"
        className="text-center text-sm font-medium text-saathi-ink/50 underline-offset-4 hover:text-saathi-forest hover:underline"
      >
        {t("nav.backToHome")}
      </Link>
    </main>
  );
}
