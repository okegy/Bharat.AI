"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppLanguage } from "@/lib/app-language";
import { isBiometricOnboardingComplete } from "@/lib/biometric-storage";
import {
  INDIAN_LANGUAGES,
  type IndianLanguageCode,
} from "@/lib/indian-languages";
import {
  SESSION_LANGUAGE_REPICK,
  getSelectedLanguageCode,
  setLanguageWithServerSync,
} from "@/lib/language-storage";
import { getUiText } from "@/lib/ui-text";
import { useTranslation } from "react-i18next";
import { speak, stopSpeaking } from "@/lib/speech-engine";

export default function LanguageOnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { language } = useAppLanguage();
  const { t } = useTranslation();

  // Auto-speak: "Choose your language" (once)
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (!isLoaded || !user || hasSpoken.current) return;
    hasSpoken.current = true;
    speak(getUiText(language, "Choose your language"), language);
    return () => stopSpeaking();
  }, [isLoaded, user, language]);
  const [current, setCurrent] = useState<IndianLanguageCode | null>(null);
  /**
   * User opened this screen via “Language” (repick). After we clear the session
   * flag, `router` / Clerk can re-run effects; without this we’d see “saved +
   * biometric done” and replace away while they’re still choosing.
   */
  const repickSessionRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    const repick =
      typeof window !== "undefined" &&
      sessionStorage.getItem(SESSION_LANGUAGE_REPICK) === "1";
    if (repick) {
      sessionStorage.removeItem(SESSION_LANGUAGE_REPICK);
      repickSessionRef.current = true;
      const saved = getSelectedLanguageCode();
      if (saved) setCurrent(saved);
      return;
    }

    if (repickSessionRef.current) return;

    const saved = getSelectedLanguageCode();
    if (!saved) return;
    if (isBiometricOnboardingComplete()) {
      router.replace("/onboarding");
    } else {
      router.replace("/onboarding/biometric");
    }
    // Intentionally omit `router`: a new reference re-ran this effect and caused bogus redirects.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable navigation; avoid effect loops
  }, [isLoaded]);

  const choose = useCallback(
    (code: IndianLanguageCode) => {
      repickSessionRef.current = false;
      setLanguageWithServerSync(code);
      setCurrent(code);
      if (isBiometricOnboardingComplete()) {
        router.push("/onboarding");
      } else {
        router.push("/onboarding/biometric");
      }
    },
    [router],
  );

  if (!isLoaded) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 pb-24 pt-28 sm:px-6">
        <p className="text-center text-saathi-ink/60">
          {getUiText(language, "Loading…")}
        </p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-24 pt-28 sm:px-6">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
          {getUiText(language, "Step 2 of 3")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-saathi-ink sm:text-4xl">
          {getUiText(language, "Choose your language")}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-saathi-ink/70">
          {t("onboarding.signInSubtext")}{" "}
          {getUiText(language, "The app uses this language for screens and voice.")}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {INDIAN_LANGUAGES.map((lang) => {
          const active = current === lang.code;
          return (
            <li key={lang.code}>
              <button
                type="button"
                onClick={() => choose(lang.code)}
                className={`flex w-full flex-col items-center rounded-2xl border px-4 py-5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saathi-forest ${
                  active
                    ? "border-saathi-forest bg-white shadow-md ring-1 ring-saathi-mint/50"
                    : "border-saathi-sand bg-saathi-cream/40 hover:border-saathi-mint/70 hover:bg-white"
                }`}
              >
                <span className="text-lg font-semibold text-saathi-ink">
                  {lang.script}
                </span>
                <span className="mt-1 text-xs text-saathi-ink/50">
                  {lang.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-10 text-center text-xs text-saathi-ink/45">
        {getUiText(
          language,
          "Next in onboarding: WebAuthn fingerprint on this device (optional skip), then your FormSaathi home.",
        )}
      </p>

      <Link
        href="/"
        className="mt-6 text-center text-sm font-medium text-saathi-forest underline-offset-4 hover:underline"
      >
        {`← ${getUiText(language, "Back to home")}`}
      </Link>
    </main>
  );
}
