"use client";

import { TopBar } from "@/components/BharatLink/TopBar";
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
            <h1 className="font-display text-3xl font-extrabold text-bharatlink-navy sm:text-4xl">
              {getUiText(language, "Eligible schemes")}
            </h1>
            <p className="mt-1 text-bharatlink-navy/70">
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
              className={`mt-1 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                announcing
                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                  : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
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
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold capitalize transition shadow-sm ${
                filter === cat
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-500/20 glow-coral"
                  : "glass-card text-bharatlink-navy/70 hover:bg-white/60 hover:text-orange-600"
              }`}
            >
              {getCategoryLabel(language, cat)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent shadow-[0_0_10px_#ea580c]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl glass-card p-8 text-center border-orange-500/20">
            <p className="text-bharatlink-navy/70 font-medium">
              {getUiText(language, "No matching schemes found.")}
            </p>
            <Link
              href="/onboarding/voice"
              className="mt-3 inline-block text-sm font-bold text-orange-600 hover:underline"
            >
              {getUiText(language, "Complete your profile to see more →")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(({ scheme, score, missingFields }, idx) => (
              <Link
                key={scheme.id}
                href={`/scheme/${scheme.id}`}
                className="group block rounded-2xl glass-card p-5 transition hover:border-orange-500/50 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-200/50 px-2 py-0.5 text-[10px] font-bold uppercase text-bharatlink-navy/50">
                        {getCategoryLabel(language, scheme.category)}
                      </span>
                      <span className="rounded bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                        {getBenefitLabel(language, scheme.benefitType)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-bharatlink-navy group-hover:text-orange-600 transition">
                      {translatedNames[idx] ?? scheme.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-bharatlink-navy/50">{scheme.department}</p>
                    <p className="mt-2 text-sm leading-relaxed text-bharatlink-navy/70 line-clamp-2">
                      {translatedDescs[idx] ?? scheme.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="whitespace-nowrap rounded-full bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 px-3 py-1.5 text-sm font-extrabold text-orange-600 shadow-sm">
                      ₹{scheme.estimatedBenefitINR.toLocaleString(locale)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {Math.round(score * 100)}% {getMatchLabel(language)}
                    </span>
                  </div>
                </div>
                {missingFields.length > 0 && (
                  <p className="mt-4 rounded-lg bg-amber-50/80 border border-amber-200/50 px-3 py-2 text-xs font-medium text-amber-700">
                    {getUiText(language, "Missing info:")} <span className="font-bold">{missingFields.join(", ")}</span>
                  </p>
                )}
                <div className="mt-4 text-xs font-bold text-orange-600 opacity-0 transition group-hover:opacity-100 flex items-center gap-1">
                  {getUiText(language, "Apply now")} <span className="text-lg leading-none">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex gap-4">
          <Link href="/dashboard" className="text-sm font-bold text-orange-600 underline-offset-4 hover:underline">
            {`← ${getUiText(language, "Dashboard")}`}
          </Link>
        </div>
      </main>
    </>
  );
}
