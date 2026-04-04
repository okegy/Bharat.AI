"use client";

import { TopBar } from "@/components/formsaathi/TopBar";
import { useAppLanguage } from "@/lib/app-language";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getProfile } from "@/lib/profile-vault";
import { findEligibleSchemes, type SchemeMatch } from "@/lib/schemes-db";
import { speak, stopSpeaking, isTTSAvailable } from "@/lib/speech-engine";
import { getSelectedLanguageCode } from "@/lib/language-storage";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import {
  getBenefitLabel,
  getCategoryLabel,
  getEligibilityHeaderText,
  getMatchLabel,
  getUiText,
} from "@/lib/ui-text";
import {
  getEligibilityAnnounceText,
  getSchemeVoiceName,
} from "@/lib/voice-copy";
import { useTranslatedBatch } from "@/lib/translate-cache";

const CATEGORIES = ["all", "food", "agriculture", "education", "pension", "health", "housing", "employment", "women", "disability", "insurance", "finance", "skill"] as const;

export default function EligibilityPage() {
  const { language, locale } = useAppLanguage();
  const [matches, setMatches] = useState<SchemeMatch[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [announcing, setAnnouncing] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setMatches(findEligibleSchemes(p));
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all"
    ? matches
    : matches.filter((m) => m.scheme.category === filter);

  const totalBenefit = filtered.reduce((s, m) => s + m.scheme.estimatedBenefitINR, 0);

  const schemeNames = useMemo(() => filtered.map((m) => m.scheme.name), [filtered]);
  const schemeDescs = useMemo(() => filtered.map((m) => m.scheme.description), [filtered]);
  const translatedNames = useTranslatedBatch(schemeNames, language);
  const translatedDescs = useTranslatedBatch(schemeDescs, language);

  const announceResults = () => {
    if (!isTTSAvailable() || filtered.length === 0) return;
    setAnnouncing(true);
    const lang: IndianLanguageCode = getSelectedLanguageCode() ?? "hi";
    const top3 = filtered.slice(0, 3);
    const topNames = top3.map((m) =>
      getSchemeVoiceName(lang, m.scheme.name, m.scheme.nameHi),
    );
    const text = getEligibilityAnnounceText(
      lang,
      filtered.length,
      topNames,
      totalBenefit.toLocaleString("en-IN"),
    );
    speak(text, lang, { onEnd: () => setAnnouncing(false) });
  };

  // Auto-speak results when data loads
  const hasAutoSpoken = useRef(false);
  useEffect(() => {
    if (loading || hasAutoSpoken.current || matches.length === 0) return;
    hasAutoSpoken.current = true;
    announceResults();
  }, [loading, matches.length]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-saathi-ink sm:text-4xl">
              {getUiText(language, "Eligible schemes")}
            </h1>
            <p className="mt-1 text-saathi-ink/60">
              {loading
                ? getUiText(language, "Loading…")
                : getEligibilityHeaderText(
                    language,
                    filtered.length,
                    totalBenefit.toLocaleString(locale),
                  )}
            </p>
          </div>
          {isTTSAvailable() && filtered.length > 0 && (
            <button
              type="button"
              onClick={announcing ? () => { stopSpeaking(); setAnnouncing(false); } : announceResults}
              className={`mt-1 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                announcing
                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                  : "bg-saathi-forest/10 text-saathi-forest hover:bg-saathi-forest/20"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
              {announcing ? getUiText(language, "Stop") : getUiText(language, "Read aloud")}
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                filter === cat
                  ? "bg-saathi-forest text-white"
                  : "bg-saathi-sand/60 text-saathi-ink/70 hover:bg-saathi-sand"
              }`}
            >
              {getCategoryLabel(language, cat)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-saathi-sand bg-white p-8 text-center">
            <p className="text-saathi-ink/60">
              {getUiText(language, "No matching schemes found.")}
            </p>
            <Link
              href="/onboarding/voice"
              className="mt-3 inline-block text-sm font-medium text-saathi-forest hover:underline"
            >
              {getUiText(language, "Complete your profile to see more →")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ scheme, score, missingFields }, idx) => (
              <Link
                key={scheme.id}
                href={`/scheme/${scheme.id}`}
                className="group block rounded-2xl border border-saathi-sand bg-white p-5 transition hover:border-saathi-forest hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-saathi-sand/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-saathi-ink/50">
                        {getCategoryLabel(language, scheme.category)}
                      </span>
                      <span className="rounded bg-saathi-mint/30 px-1.5 py-0.5 text-[10px] font-medium text-saathi-forest">
                        {getBenefitLabel(language, scheme.benefitType)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-saathi-ink group-hover:text-saathi-forest">
                      {translatedNames[idx] ?? scheme.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-saathi-ink/50">{scheme.department}</p>
                    <p className="mt-2 text-xs leading-relaxed text-saathi-ink/60 line-clamp-2">
                      {translatedDescs[idx] ?? scheme.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="whitespace-nowrap rounded-full bg-saathi-mint/40 px-3 py-1 text-sm font-bold text-saathi-forest">
                      ₹{scheme.estimatedBenefitINR.toLocaleString(locale)}
                    </span>
                    <span className="text-[10px] font-medium text-saathi-ink/40">
                      {Math.round(score * 100)}% {getMatchLabel(language)}
                    </span>
                  </div>
                </div>
                {missingFields.length > 0 && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] text-amber-700">
                    {getUiText(language, "Missing info:")} {missingFields.join(", ")}
                  </p>
                )}
                <div className="mt-3 text-xs font-medium text-saathi-forest opacity-0 transition group-hover:opacity-100">
                  {getUiText(language, "Apply now →")}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex gap-4">
          <Link href="/dashboard" className="text-sm font-medium text-saathi-forest underline-offset-4 hover:underline">
            {`← ${getUiText(language, "Dashboard")}`}
          </Link>
        </div>
      </main>
    </>
  );
}
