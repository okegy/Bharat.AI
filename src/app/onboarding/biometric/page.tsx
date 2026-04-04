"use client";

import { Trans, useTranslation } from "react-i18next";
import "@/lib/i18n";

import { BiometricSetupNavLink } from "@/components/formsaathi/BiometricSetupNavLink";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppLanguage } from "@/lib/app-language";
import { speak, stopSpeaking } from "@/lib/speech-engine";
import {
  SESSION_BIOMETRIC_SETUP_INTENT,
  hasPlatformBiometric,
  isBiometricOnboardingComplete,
  isPasskeyRegisteredOnDevice,
  isWebAuthnAvailable,
  markPasskeySkipped,
  registerDevicePasskey,
} from "@/lib/biometric-storage";
import {
  markLanguagePickerRepick,
  isLanguageOnboardingComplete,
} from "@/lib/language-storage";

type BiometricSupport = "loading" | "full" | "webauthn-only" | "none";

export default function BiometricOnboardingPage() {
  const { t } = useTranslation();
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { language } = useAppLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsEntry, setSettingsEntry] = useState(false);
  const [support, setSupport] = useState<BiometricSupport>("loading");
  const completeRedirectRef = useRef(false);
  const capabilityChecked = useRef(false);

  useEffect(() => {
    if (capabilityChecked.current) return;
    capabilityChecked.current = true;

    if (!isWebAuthnAvailable()) {
      setSupport("none");
      return;
    }

    hasPlatformBiometric().then((has) =>
      setSupport(has ? "full" : "webauthn-only"),
    );
  }, []);

  // Auto-speak the page content
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (support === "loading" || !isLoaded || hasSpoken.current) return;
    hasSpoken.current = true;
    const hasSensor = support === "full";
    const title = hasSensor
      ? t("biometric.setupBiometric")
      : t("biometric.setupSecurityKey");
    const desc = hasSensor
      ? t("biometric.setupBiometricDescOnboarding")
      : t("biometric.setupSecurityKeyDescOnboarding");
    speak(`${title}. ${desc}`, language);
    return () => stopSpeaking();
  }, [support, isLoaded, t, language]);

  useEffect(() => {
    if (!isLoaded || support === "loading") return;

    if (!isLanguageOnboardingComplete()) {
      router.replace("/onboarding/language");
      return;
    }

    if (settingsEntry) return;

    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem(SESSION_BIOMETRIC_SETUP_INTENT) === "1"
    ) {
      sessionStorage.removeItem(SESSION_BIOMETRIC_SETUP_INTENT);
      setSettingsEntry(true);
      return;
    }

    if (support === "none") {
      markPasskeySkipped();
      router.replace("/onboarding/aadhaar");
      return;
    }

    if (!isBiometricOnboardingComplete()) return;
    if (completeRedirectRef.current) return;
    completeRedirectRef.current = true;
    router.replace("/onboarding/aadhaar");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `router` churn re-fired this effect and bounced users off the page
  }, [isLoaded, settingsEntry, support]);

  const onRegister = useCallback(async () => {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      const username =
        user.primaryEmailAddress?.emailAddress ||
        user.username ||
        user.id;
      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        username;

      await registerDevicePasskey({
        userId: user.id,
        username,
        displayName,
      });
      router.push("/onboarding/aadhaar");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("biometric.somethingWentWrong"),
      );
    } finally {
      setBusy(false);
    }
  }, [user, router, t]);

  const onSkip = useCallback(() => {
    markPasskeySkipped();
    router.push("/onboarding/aadhaar");
  }, [router]);

  if (!isLoaded || support === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 pb-24 pt-28">
        <p className="text-center text-saathi-ink/60">{t("common.loading")}</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (settingsEntry && support === "none") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 pb-24 pt-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
            {t("biometric.thisDevice")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-saathi-ink sm:text-4xl">
            {t("biometric.notAvailable")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-saathi-ink/75">
            {t("biometric.notAvailableDesc")}
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-saathi-forest px-6 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
        >
          {t("biometric.backToOnboarding")}
        </Link>
      </main>
    );
  }

  if (settingsEntry && isPasskeyRegisteredOnDevice()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 pb-24 pt-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
            {t("biometric.thisDevice")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-saathi-ink sm:text-4xl">
            {t("biometric.alreadySetUp")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-saathi-ink/75">
            {t("biometric.alreadySetUpDesc")}
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-saathi-forest px-6 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
        >
          {t("biometric.backToOnboarding")}
        </Link>
      </main>
    );
  }

  const stepLabel = settingsEntry
    ? t("biometric.deviceSecurity")
    : t("biometric.step3Optional");

  const hasSensor = support === "full";

  const description = settingsEntry
    ? hasSensor
      ? t("biometric.setupBiometricDescSettings")
      : t("biometric.setupSecurityKeyDescSettings")
    : hasSensor
      ? t("biometric.setupBiometricDescOnboarding")
      : t("biometric.setupSecurityKeyDescOnboarding");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 pb-24 pt-28">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
          {stepLabel}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-saathi-ink sm:text-4xl">
          {hasSensor
            ? t("biometric.setupBiometric")
            : t("biometric.setupSecurityKey")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-saathi-ink/75">
          {description}
        </p>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRegister()}
          className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-saathi-forest px-6 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink disabled:opacity-50"
        >
          {busy
            ? t("biometric.waitingForDevice")
            : hasSensor
              ? t("biometric.setupBiometricBtn")
              : t("biometric.setupSecurityKeyBtn")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="inline-flex h-12 items-center justify-center rounded-full border border-saathi-sand px-6 text-sm font-semibold text-saathi-ink hover:bg-white disabled:opacity-50"
        >
          {settingsEntry
            ? t("biometric.notNowBack")
            : t("biometric.skipContinue")}
        </button>
      </div>

      <div className="text-xs leading-relaxed text-saathi-ink/50">
        {hasSensor ? (
          <p>{t("biometric.biometricFinePrint")}</p>
        ) : (
          <p>{t("biometric.securityKeyFinePrint")}</p>
        )}
        <p className="mt-2">
          <Trans
            i18nKey="biometric.fingerprintAnytime"
            components={{
              1: (
                <BiometricSetupNavLink className="font-medium text-saathi-forest underline-offset-2 hover:underline">
                  {t("nav.fingerprint")}
                </BiometricSetupNavLink>
              ),
            }}
          />
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
        <Link
          href="/onboarding/language"
          onClick={() => markLanguagePickerRepick()}
          className="text-sm font-medium text-saathi-forest underline-offset-4 hover:underline"
        >
          {t("nav.changeLanguage")}
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-saathi-forest underline-offset-4 hover:underline"
        >
          {`← ${t("nav.backToHome")}`}
        </Link>
      </div>
    </main>
  );
}
