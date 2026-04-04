"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppLanguage } from "@/lib/app-language";
import {
  isSTTAvailable,
  isTTSAvailable,
  listen,
  speak,
  stopSpeaking,
  type ListenHandle,
} from "@/lib/speech-engine";
import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";
import {
  getOnboardingQuestionText,
  type VoiceOnboardingQuestionId,
} from "@/lib/voice-copy";
import {
  getOnboardingInputType,
  getOnboardingOptions,
  getOnboardingPlaceholder,
  getStoredOnboardingValue,
  matchOnboardingTranscript,
} from "@/lib/onboarding-profile";
import { markOnboardingComplete } from "@/lib/language-storage";
import {
  getQuestionProgressText,
  getUiText,
} from "@/lib/ui-text";
import { useTranslation } from "react-i18next";

/** Only ask what Aadhaar scan can't provide. */
const ALL_VOICE_QUESTIONS: VoiceOnboardingQuestionId[] = [
  "occupation",
  "annualIncome",
  "category",
];

/** Fields already covered by Aadhaar scan — skip if present in profile. */
const AADHAAR_FIELDS = new Set(["fullName", "gender", "state", "address", "district", "pincode", "fatherName", "dob", "aadhaarNumber"]);

export default function VoiceOnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ProfileData>({});
  const [textInput, setTextInput] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [saving, setSaving] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [processing, setProcessing] = useState(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const [hasTTS, setHasTTS] = useState(false);
  const [hasSTT, setHasSTT] = useState(false);

  useEffect(() => {
    setHasTTS(isTTSAvailable());
    setHasSTT(isSTTAvailable());
  }, [language]);

  const [questionOrder, setQuestionOrder] = useState<VoiceOnboardingQuestionId[]>(ALL_VOICE_QUESTIONS);

  useEffect(() => {
    getProfile().then((p) => {
      if (p && Object.keys(p).length > 0) setAnswers(p);
      // Filter out questions the user already answered (e.g., from Aadhaar scan)
      const remaining = ALL_VOICE_QUESTIONS.filter((q) => !p[q]);
      if (remaining.length === 0) {
        // Everything already filled — skip to dashboard
        markOnboardingComplete();
        router.push("/assistant");
        return;
      }
      setQuestionOrder(remaining);
    });
  }, [router]);

  const currentQ = questionOrder[step];
  const currentOptions = currentQ
    ? getOnboardingOptions(language, currentQ)
    : [];

  const speakQuestion = useCallback(() => {
    if (!currentQ) return;
    speak(getOnboardingQuestionText(language, currentQ), language);
  }, [currentQ, language]);

  // Speak each question once when it changes — no cleanup that would re-trigger
  const lastSpokenQ = useRef<string | null>(null);
  useEffect(() => {
    if (!hasTTS || !currentQ) return;
    if (lastSpokenQ.current === currentQ) return;
    lastSpokenQ.current = currentQ;
    speak(getOnboardingQuestionText(language, currentQ), language);
  }, [hasTTS, currentQ, language]);

  const submitAnswer = useCallback(
    (value: string, fromVoice = false) => {
      if (!currentQ || !value.trim()) return;
      stopSpeaking();
      if (listenRef.current) {
        listenRef.current.abort();
        listenRef.current = null;
      }

      let stored = value.trim();
      if (fromVoice) {
        const m = matchOnboardingTranscript(currentQ, stored);
        if (m) stored = m;
      }
      stored = getStoredOnboardingValue(currentQ, stored);

      setAnswers((prev) => ({ ...prev, [currentQ]: stored }));
      setTextInput("");
      setInterim("");
      setListening(false);

      if (step < questionOrder.length - 1) {
        setStep((s) => s + 1);
      } else {
        setSaving(true);
        const final = { ...answers, [currentQ]: stored };
        saveProfile(final).then(() => {
          markOnboardingComplete();
          router.push("/assistant");
        });
      }
    },
    [currentQ, step, answers, router],
  );

  const toggleMic = useCallback(() => {
    if (listening && listenRef.current) {
      listenRef.current.stop();
      listenRef.current = null;
      setProcessing(true);
      setInterim(getUiText(language, "Processing…"));
      return;
    }

    listenRef.current?.abort();
    stopSpeaking();
    setListening(true);
    setProcessing(false);
    setInterim("");
    setVoiceError("");
    listenRef.current = listen({
      lang: language,
      timeoutMs: 15_000,
      onInterim: (text) => {
        if (text === t("common.processing")) setProcessing(true);
        setInterim(text);
      },
      onResult: (result) => {
        const transcript = result.transcript;
        setInterim(transcript);
        setListening(false);
        setProcessing(false);
        setTimeout(() => submitAnswer(transcript, true), 600);
      },
      onError: (error) => {
        setInterim("");
        setListening(false);
        setProcessing(false);
        setVoiceError(error ?? getUiText(language, "Could not recognise speech. Please try again."));
        setTimeout(() => setVoiceError(""), 4000);
      },
      onEnd: () => {
        setListening(false);
      },
    });
  }, [language, listening, submitAnswer]);

  if (!isLoaded || !currentQ) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 pb-24 pt-28">
        <p className="text-center text-saathi-ink/60">
          {getUiText(language, "Loading…")}
        </p>
      </main>
    );
  }

  if (!user) return null;

  if (saving) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 pb-24 pt-28">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
        <p className="text-saathi-ink/60">
          {t("common.savingProfile")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 pb-24 pt-28">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
          {getQuestionProgressText(language, step + 1, questionOrder.length)}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-saathi-ink sm:text-3xl">
          {getOnboardingQuestionText(language, currentQ)}
        </h1>
        <p className="mt-1 text-sm text-saathi-ink/50">
          {getUiText(language, "Tap a choice, type, or use the microphone.")}
        </p>
      </div>

      {currentOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => submitAnswer(option.value)}
              className="rounded-full border border-saathi-sand bg-white px-4 py-2 text-sm font-medium text-saathi-ink transition hover:border-saathi-forest hover:bg-saathi-mint/20"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type={getOnboardingInputType(currentQ) === "number" ? "number" : "text"}
          value={interim || textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitAnswer(textInput);
          }}
          placeholder={getOnboardingPlaceholder(language, currentQ)}
          className="flex-1 rounded-xl border border-saathi-sand bg-white px-4 py-3 text-sm text-saathi-ink outline-none transition focus:border-saathi-forest focus:ring-1 focus:ring-saathi-mint"
        />
        <button
          type="button"
          onClick={() => submitAnswer(textInput)}
          disabled={!textInput.trim() && !interim}
          className="rounded-xl bg-saathi-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-saathi-ink disabled:opacity-40"
        >
          {getUiText(language, "Next")}
        </button>
      </div>

      {voiceError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm font-medium text-red-700">{voiceError}</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        {hasSTT && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={processing}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
              processing
                ? "bg-amber-100 text-amber-600"
                : listening
                  ? "animate-pulse bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : "bg-saathi-forest/10 text-saathi-forest hover:bg-saathi-forest/20"
            }`}
            aria-label={listening ? getUiText(language, "Stop") : getUiText(language, "Voice")}
          >
            {processing ? (
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                {listening ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                )}
              </svg>
            )}
          </button>
        )}
        {(listening || processing || interim) && (
          <p className={`text-sm ${processing ? "text-amber-600 font-medium" : "text-saathi-ink/60 animate-pulse"}`}>
            {interim || getUiText(language, "Listening…")}
          </p>
        )}
        {hasTTS && !listening && !processing && (
          <button
            type="button"
            onClick={speakQuestion}
            className="ml-auto flex items-center gap-1.5 text-sm font-medium text-saathi-forest hover:underline"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            {getUiText(language, "Hear again")}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setStep((s) => s - 1);
              setTextInput("");
              setInterim("");
            }}
            className="text-sm font-medium text-saathi-forest underline-offset-4 hover:underline"
          >
            {`← ${getUiText(language, "Previous")}`}
          </button>
        )}
        <Link
          href="/assistant"
          className="ml-auto text-sm font-medium text-saathi-ink/50 underline-offset-4 hover:underline"
        >
          {getUiText(language, "Skip voice onboarding →")}
        </Link>
      </div>

      <div className="flex gap-1.5">
        {questionOrder.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i < step ? "bg-saathi-forest" : i === step ? "bg-saathi-mint" : "bg-saathi-sand"
            }`}
          />
        ))}
      </div>
    </main>
  );
}
