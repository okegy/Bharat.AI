"use client";

import { BiometricSetupNavLink } from "@/components/BharatLink/BiometricSetupNavLink";
import { LanguagePickerNavLink } from "@/components/BharatLink/LanguagePickerNavLink";
import { TopBar } from "@/components/BharatLink/TopBar";
import { useAppLanguage } from "@/lib/app-language";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { speak, stopSpeaking } from "@/lib/speech-engine";
import { getProfile, getReferences, type ProfileData, type SchemeReference } from "@/lib/profile-vault";
import { findEligibleSchemes, type SchemeMatch } from "@/lib/schemes-db";
import { isWebAuthnAvailable } from "@/lib/biometric-storage";
import {
  getDashboardSummaryText,
  getMatchLabel,
  getMatchesCountText,
  getStatusLabel,
  getUiText,
  getWelcomeText,
} from "@/lib/ui-text";
import { useTranslatedBatch } from "@/lib/translate-cache";
import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { t } = useTranslation();
  const { language, locale } = useAppLanguage();
  const [profile, setProfile] = useState<ProfileData>({});
  const [matches, setMatches] = useState<SchemeMatch[]>([]);
  const [refs, setRefs] = useState<SchemeReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBio, setShowBio] = useState(false);

  useEffect(() => {
    setShowBio(isWebAuthnAvailable());
  }, []);

  useEffect(() => {
    async function load() {
      const p = await getProfile();
      setProfile(p);
      setMatches(findEligibleSchemes(p));
      setRefs(await getReferences());
      setLoading(false);
    }
    load();
  }, []);

  const firstName = user?.firstName || user?.username || "there";

  // Auto-speak welcome + summary when data loads
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (loading || !isLoaded || hasSpoken.current) return;
    hasSpoken.current = true;
    const welcome = getWelcomeText(language, firstName);
    const summary = getDashboardSummaryText(language, matches.length);
    speak(`${welcome}. ${summary}`, language);
    return () => stopSpeaking();
  }, [loading, isLoaded, language, firstName, matches.length]);

  const topSchemes = useMemo(() => matches.slice(0, 5), [matches]);
  const schemeNames = useMemo(() => topSchemes.map((m) => m.scheme.name), [topSchemes]);
  const schemeDescs = useMemo(() => topSchemes.map((m) => m.scheme.description), [topSchemes]);
  const translatedNames = useTranslatedBatch(schemeNames, language);
  const translatedDescs = useTranslatedBatch(schemeDescs, language);

  if (!isLoaded || loading) {
    return (
      <>
        <TopBar />
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 pt-28">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-500 border-t-transparent shadow-[0_0_12px_#ea580c]" />
        </main>
      </>
    );
  }

  const profileFields = Object.entries(profile).filter(([, v]) => v);
  const completeness = Math.min(
    100,
    Math.round((profileFields.length / 12) * 100),
  );

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
        <section className="mb-10">
          <h1 className="font-display text-3xl font-extrabold text-bharatlink-navy sm:text-4xl">
            {getWelcomeText(language, firstName)}
          </h1>
          <p className="mt-2 text-base text-bharatlink-navy/70">
            {getDashboardSummaryText(language, matches.length)}
          </p>
        </section>

        {/* Vault Hub CTA */}
        <section className="mb-8">
          <Link
            href="/dashboard/vault"
            className="group flex items-center gap-4 rounded-2xl glass-card border border-orange-500/30 p-5 shadow-lg shadow-orange-500/10 hover:border-orange-500/60 transition"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/30 glow-coral">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75M6.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-bharatlink-navy group-hover:text-orange-600 transition">Vault Hub — reminders &amp; access log</p>
              <p className="text-sm text-bharatlink-navy/60">
                Renewal dates, document access timeline, and every vault entry in one place
              </p>
            </div>
            <svg className="h-5 w-5 text-orange-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </section>

        {/* BharatLink Assistant CTA */}
        <section className="mb-8">
          <Link
            href="/assistant"
            className="group flex items-center gap-4 rounded-2xl glass-card border border-orange-500/30 p-5 shadow-lg shadow-orange-500/10 hover:border-orange-500/60 transition"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 glow-coral">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-bharatlink-navy group-hover:text-orange-600 transition">BharatLink AI Voice Assistant</p>
              <p className="text-sm text-bharatlink-navy/60">
                {t("dashboard.assistantDesc", "Fill forms, find schemes, get guided help — by voice")}
              </p>
            </div>
            <svg className="h-5 w-5 text-orange-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </section>

        {/* Offline Form Fill CTA */}
        <section className="mb-8">
          <Link
            href="/form-fill"
            className="group flex items-center gap-4 rounded-2xl glass-card p-5 transition hover:border-orange-500/40 hover:shadow-md"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-bharatlink-navy group-hover:text-orange-600 transition">{t("dashboard.offlineFormFill", "Fill Offline Form")}</p>
              <p className="text-sm text-bharatlink-navy/60">
                {t("dashboard.offlineFormDesc", "Scan or upload a government form — we auto-fill it from your profile")}
              </p>
            </div>
            <svg className="h-5 w-5 text-orange-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </section>

        {/* Quick actions */}
        <section className="mb-10 grid gap-3 sm:grid-cols-3">
          <Link
            href="/eligibility"
            className="flex items-center gap-3 rounded-2xl glass-card p-4 transition hover:border-orange-500/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-bharatlink-navy">
                {getUiText(language, "Find schemes")}
              </p>
              <p className="text-xs font-medium text-orange-600/90">
                {getMatchesCountText(language, matches.length)}
              </p>
            </div>
          </Link>
          <Link
            href="/documents"
            className="flex items-center gap-3 rounded-2xl glass-card p-4 transition hover:border-orange-500/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-bharatlink-navy">
                {getUiText(language, "Documents")}
              </p>
              <p className="text-xs text-bharatlink-navy/50">
                {getUiText(language, "Capture & vault")}
              </p>
            </div>
          </Link>
          <Link
            href="/onboarding/voice"
            className="flex items-center gap-3 rounded-2xl glass-card p-4 transition hover:border-orange-500/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-bharatlink-navy">
                {getUiText(language, "Voice profile")}
              </p>
              <p className="text-xs text-bharatlink-navy/50">
                {getUiText(language, "Update answers")}
              </p>
            </div>
          </Link>
        </section>

        {/* Profile completeness */}
        <section className="mb-10 rounded-2xl glass-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-bharatlink-navy">
              {getUiText(language, "Profile completeness")}
            </h2>
            <span className="text-xs font-extrabold text-orange-600">{completeness}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
          {completeness < 80 && (
            <p className="mt-3 text-xs text-bharatlink-navy/60">
              {t("dashboard.addMoreDetails")}{" "}
              <Link href="/onboarding/voice" className="font-semibold text-orange-600 hover:underline">
                {t("dashboard.continueVoiceProfile")}
              </Link>
            </p>
          )}
        </section>

        {/* Eligible schemes */}
        {matches.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-bharatlink-navy">
                {getUiText(language, "Eligible schemes")}
              </h2>
              <Link href="/eligibility" className="text-xs font-semibold text-orange-600 hover:underline">
                {getUiText(language, "View all →")}
              </Link>
            </div>
            <div className="space-y-3">
              {topSchemes.map(({ scheme, score, missingFields }, idx) => (
                <Link
                  key={scheme.id}
                  href={`/scheme/${scheme.id}`}
                  className="group block rounded-2xl glass-card p-4 transition hover:border-orange-500/50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-bharatlink-navy group-hover:text-orange-600 transition">
                        {translatedNames[idx] ?? scheme.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-bharatlink-navy/60 font-medium">{scheme.department}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-bharatlink-navy/60 line-clamp-2">
                        {translatedDescs[idx] ?? scheme.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="whitespace-nowrap rounded-full bg-orange-500/10 border border-orange-500/25 px-2.5 py-0.5 text-xs font-extrabold text-orange-600">
                        ₹{scheme.estimatedBenefitINR.toLocaleString(locale)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {Math.round(score * 100)}% {getMatchLabel(language)}
                      </span>
                    </div>
                  </div>
                  {missingFields.length > 0 && (
                    <p className="mt-2 text-[10px] font-medium text-amber-600">
                      {t("eligibility.missingInfo")} {missingFields.join(", ")}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent applications */}
        {refs.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-display text-xl font-bold text-bharatlink-navy">
              {getUiText(language, "Recent applications")}
            </h2>
            <div className="space-y-3">
              {refs.slice(0, 5).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between rounded-2xl glass-card p-4"
                >
                  <div>
                    <p className="text-sm font-bold text-bharatlink-navy">{ref.schemeName}</p>
                    <p className="text-xs text-bharatlink-navy/50 font-medium">
                      {getUiText(language, "Ref:")} {ref.referenceNumber}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    ref.status === "submitted" ? "bg-blue-500/10 border border-blue-500/20 text-blue-700" :
                    ref.status === "approved" ? "bg-green-500/10 border border-green-500/20 text-green-700" :
                    ref.status === "rejected" ? "bg-red-500/10 border border-red-500/20 text-red-700" :
                    "bg-amber-500/10 border border-amber-500/20 text-amber-700"
                  }`}>
                    {getStatusLabel(language, ref.status)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Settings links */}
        <section className="flex flex-wrap gap-4 border-t border-slate-300/80 pt-6">
          <LanguagePickerNavLink className="text-sm font-semibold text-orange-600 underline-offset-4 hover:underline">
            {getUiText(language, "Change language")}
          </LanguagePickerNavLink>
          {showBio && (
            <BiometricSetupNavLink className="text-sm font-semibold text-orange-600 underline-offset-4 hover:underline">
              {getUiText(language, "Fingerprint")}
            </BiometricSetupNavLink>
          )}
          <Link href="/" className="text-sm font-semibold text-orange-600 underline-offset-4 hover:underline">
            {getUiText(language, "Home")}
          </Link>
        </section>
      </main>
    </>
  );
}
