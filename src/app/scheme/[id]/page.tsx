"use client";

import { TopBar } from "@/components/formsaathi/TopBar";
import { useAppLanguage } from "@/lib/app-language";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProfile,
  saveProfile,
  saveReference,
  type ProfileData,
  type SchemeReference,
} from "@/lib/profile-vault";
import { getSchemeById, type Scheme, type FormFieldDef } from "@/lib/schemes-db";
import {
  speak,
  stopSpeaking,
  listen,
  isTTSAvailable,
  isSTTAvailable,
  type ListenHandle,
} from "@/lib/speech-engine";
import { matchTranscriptToOption } from "@/lib/voice-match";
import { useTranslatedText } from "@/lib/translate-cache";
import { useTranslation } from "react-i18next";
import { getFieldLabel, getUiText } from "@/lib/ui-text";

type FormValues = Record<string, string>;
type FieldStatus = Record<string, "auto" | "voice" | "manual" | "empty">;

export default function SchemeFormPage() {
  const params = useParams();
  const { language, locale } = useAppLanguage();
  const { t } = useTranslation();
  const schemeId = params.id as string;
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [fieldStatus, setFieldStatus] = useState<FieldStatus>({});
  const [phase, setPhase] = useState<
    "loading" | "prefill" | "portal-assist" | "done"
  >("loading");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [askingField, setAskingField] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const listenRef = useRef<ListenHandle | null>(null);

  useEffect(() => {
    const s = getSchemeById(schemeId);
    if (!s) return;
    setScheme(s);

    getProfile().then((p) => {
      const vals: FormValues = {};
      const statuses: FieldStatus = {};
      for (const field of s.formFields) {
        const profileVal = field.profileKey ? p[field.profileKey] : undefined;
        if (profileVal) {
          vals[field.id] = profileVal;
          statuses[field.id] = "auto";
        } else {
          vals[field.id] = "";
          statuses[field.id] = "empty";
        }
      }
      setValues(vals);
      setFieldStatus(statuses);
      setPhase("prefill");
    });
  }, [schemeId]);

  const translatedName = useTranslatedText(scheme?.name ?? "", language);
  const translatedDesc = useTranslatedText(scheme?.description ?? "", language);

  // Auto-speak scheme name + how many fields auto-filled on load
  const hasAutoSpoken = useRef(false);
  useEffect(() => {
    if (phase !== "prefill" || hasAutoSpoken.current || !scheme) return;
    hasAutoSpoken.current = true;
    const autoCount = Object.values(fieldStatus).filter((s) => s === "auto").length;
    const emptyCount = Object.values(fieldStatus).filter((s) => s === "empty").length;
    const name = translatedName || scheme.name;
    const msg = `${name}. ${autoCount} ${t("scheme.fieldsAutoFilled", { defaultValue: "fields auto-filled" })}. ${emptyCount} ${t("scheme.fieldsMissing", { defaultValue: "fields need your input" })}.`;
    speak(msg, language);
    return () => stopSpeaking();
  }, [phase, scheme, fieldStatus, translatedName, language, t]);

  const setFieldValue = useCallback(
    (fieldId: string, value: string, source: "manual" | "voice") => {
      setValues((prev) => ({ ...prev, [fieldId]: value }));
      setFieldStatus((prev) => ({ ...prev, [fieldId]: source }));
    },
    [],
  );

  const copyToClipboard = useCallback(
    async (fieldId: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 1500);
      } catch {
        /* fallback: ignored on non-secure */
      }
    },
    [],
  );

  const openPortal = useCallback(() => {
    if (!scheme) return;
    window.open(scheme.portalUrl, "_blank", "noopener,noreferrer");
    setPhase("portal-assist");
  }, [scheme]);

  const narrateFieldByField = useCallback(() => {
    if (!scheme || !isTTSAvailable()) return;
    setNarrating(true);
    const fields = scheme.formFields;
    let idx = 0;

    const narrateNext = () => {
      if (idx >= fields.length) {
        speak(t("scheme.allFieldsCopied"), language, {
          onEnd: () => setNarrating(false),
        });
        return;
      }
      const f = fields[idx]!;
      const label = getFieldLabel(language, f.label);
      const val = values[f.id]?.trim();
      const text = val
        ? `${t("scheme.fieldOf", { current: idx + 1, total: fields.length })}. ${label}: ${val}`
        : `${label}: ${t("scheme.noValue")}`;
      idx++;
      speak(text, language, { rate: 0.85, onEnd: narrateNext });
    };
    narrateNext();
  }, [scheme, values, language, t]);

  const askForMissing = useCallback(
    (field: FormFieldDef, allEmpty?: FormFieldDef[]) => {
      setVoiceError("");
      setAskingField(field.id);

      const startListening = () => {
        if (!isSTTAvailable()) return;
        setListening(true);
        setInterim("");
        listenRef.current = listen({
          lang: language,
          timeoutMs: 15_000,
          onInterim: (txt) => setInterim(txt),
          onResult: (r) => {
            let text = r.transcript.trim();
            if (field.options?.length) {
              const m = matchTranscriptToOption(text, field.options);
              if (m) text = m;
            }
            setFieldValue(field.id, text, "voice");
            setListening(false);
            setInterim("");
            setAskingField(null);

            if (field.profileKey) {
              saveProfile({ [field.profileKey]: text });
            }

            if (allEmpty && allEmpty.length > 1) {
              const remaining = allEmpty.filter((f) => f.id !== field.id);
              if (remaining.length > 0) {
                setTimeout(() => askForMissing(remaining[0]!, remaining), 800);
              }
            }
          },
          onError: (error) => {
            setListening(false);
            setInterim("");
            setVoiceError(error ?? "Could not recognise speech. Please try again.");
            setTimeout(() => setVoiceError(""), 4000);
          },
          onEnd: () => setListening(false),
        });
      };

      if (!isTTSAvailable()) {
        startListening();
        return;
      }
      const label = getFieldLabel(language, field.label);
      speak(`${t("scheme.pleaseEnter")} ${label}`, language, {
        onEnd: startListening,
      });
    },
    [language, setFieldValue, t],
  );

  const markDone = useCallback(async () => {
    if (!scheme) return;
    stopSpeaking();

    const profileUpdates: ProfileData = {};
    for (const field of scheme.formFields) {
      if (field.profileKey && values[field.id]) {
        profileUpdates[field.profileKey] = values[field.id];
      }
    }
    await saveProfile(profileUpdates);

    const ref: SchemeReference = {
      id: crypto.randomUUID(),
      schemeName: scheme.name,
      schemeId: scheme.id,
      referenceNumber: `PORTAL-${Date.now().toString(36).toUpperCase()}`,
      submittedAt: Date.now(),
      portalUrl: scheme.portalUrl,
      status: "submitted",
    };
    await saveReference(ref);
    setPhase("done");
  }, [scheme, values]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      listenRef.current?.abort();
    };
  }, []);

  // ---------- Loading ----------
  if (phase === "loading" || !scheme) {
    return (
      <>
        <TopBar />
        <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 pt-28">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
        </main>
      </>
    );
  }

  const autoFilledCount = Object.values(fieldStatus).filter(
    (s) => s === "auto",
  ).length;
  const emptyFields =
    scheme.formFields.filter((f) => !values[f.id]?.trim()) ?? [];

  // ---------- Done ----------
  if (phase === "done") {
    return (
      <>
        <TopBar />
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 pb-24 pt-28 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-semibold text-saathi-ink">
            {t("scheme.portalDoneTitle")}
          </h1>
          <p className="text-saathi-ink/70">
            {t("scheme.portalDoneDesc", { portal: scheme.portalUrl })}
          </p>
          <div className="flex gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-saathi-forest px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
            >
              {getUiText(language, "Dashboard")}
            </Link>
            <Link
              href="/eligibility"
              className="rounded-full border border-saathi-sand px-6 py-2.5 text-sm font-medium text-saathi-ink hover:bg-white"
            >
              {t("scheme.moreSchemes")}
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ---------- Portal-Assist (copy-paste cards) ----------
  if (phase === "portal-assist") {
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
          {/* Header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-700">
              {t("scheme.portalOpened")}
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-saathi-ink sm:text-3xl">
            {translatedName || scheme.name}
          </h1>
          <p className="mt-1 text-xs text-saathi-ink/50">{scheme.department}</p>

          {/* Assist banner */}
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-blue-900">
              {t("scheme.portalAssistTitle")}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              {t("scheme.portalAssistDesc")}
            </p>
          </div>

          {/* Voice error */}
          {voiceError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <p className="text-sm font-medium text-red-700">{voiceError}</p>
            </div>
          )}

          {/* Voice prompt overlay */}
          {askingField && (
            <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-800">
                {listening
                ? interim || t("onboarding.listening")
                : `${t("scheme.pleaseEnter")} ${getFieldLabel(language, scheme.formFields.find((f) => f.id === askingField)?.label ?? "")}`}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={values[askingField] ?? ""}
                onChange={(e) =>
                  setFieldValue(askingField, e.target.value, "manual")
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") setAskingField(null);
                }}
                className="flex-1 rounded-lg border border-blue-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (listenRef.current) {
                    listenRef.current.stop();
                    listenRef.current = null;
                  }
                  setAskingField(null);
                  setListening(false);
                  setInterim("");
                }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {getUiText(language, "Done")}
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                window.open(
                  scheme.portalUrl,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="flex items-center gap-1.5 rounded-full bg-saathi-forest px-4 py-2 text-xs font-semibold text-white transition hover:bg-saathi-ink"
            >
              <ExternalLinkIcon />
              {t("scheme.openPortalAgain")}
            </button>
            {isTTSAvailable() && (
              <button
                type="button"
                onClick={
                  narrating
                    ? () => {
                        stopSpeaking();
                        setNarrating(false);
                      }
                    : narrateFieldByField
                }
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  narrating
                    ? "bg-red-50 text-red-700"
                    : "bg-saathi-forest/10 text-saathi-forest hover:bg-saathi-forest/20"
                }`}
              >
                <SpeakerIcon />
                {narrating ? t("scheme.stopGuide") : t("scheme.voiceGuide")}
              </button>
            )}
            {emptyFields.length > 0 && isSTTAvailable() && (
              <button
                type="button"
                onClick={() => askForMissing(emptyFields[0]!, emptyFields)}
                className="flex items-center gap-1.5 rounded-full bg-saathi-forest/10 px-4 py-2 text-xs font-semibold text-saathi-forest transition hover:bg-saathi-forest/20"
              >
                <MicIcon />
                {t("scheme.fillMissingCount", { count: emptyFields.length })}
              </button>
            )}
          </div>

          {/* Copy-paste cards */}
          <div className="mt-6 space-y-3">
            {scheme.formFields.map((field, idx) => {
              const val = values[field.id]?.trim();
              const isCopied = copiedField === field.id;
              return (
                <div
                  key={field.id}
                  className={`relative rounded-2xl border bg-white px-4 py-3 transition ${
                    isCopied
                      ? "border-green-300 bg-green-50"
                      : val
                        ? "border-saathi-sand"
                        : "border-amber-200 bg-amber-50/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-saathi-forest/10 text-[10px] font-bold text-saathi-forest">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-medium text-saathi-ink/60">
                          {getFieldLabel(language, field.label)}
                          {field.required && (
                            <span className="text-red-400"> *</span>
                          )}
                        </p>
                        {fieldStatus[field.id] === "auto" && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                            {getUiText(language, "Auto")}
                          </span>
                        )}
                        {fieldStatus[field.id] === "voice" && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                            {getUiText(language, "Voice")}
                          </span>
                        )}
                      </div>
                      {val ? (
                        <p className="mt-1 text-sm font-semibold text-saathi-ink">
                          {val}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-amber-600">
                          {t("scheme.noValue")}
                        </p>
                      )}
                    </div>
                    {val && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(field.id, val)}
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          isCopied
                            ? "bg-green-600 text-white"
                            : "bg-saathi-forest/10 text-saathi-forest hover:bg-saathi-forest hover:text-white"
                        }`}
                      >
                        {isCopied ? (
                          <span className="flex items-center gap-1">
                            <CheckIcon /> {t("scheme.copied")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CopyIcon /> {t("scheme.copyValue")}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Required documents */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-saathi-ink">
              {t("scheme.requiredDocuments")}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {scheme.requiredDocuments.map((doc) => (
                <li
                  key={doc}
                  className="flex items-center gap-2 text-xs text-saathi-ink/60"
                >
                  <DocIcon />
                  {doc}
                </li>
              ))}
            </ul>
          </div>

          {/* Mark done */}
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => void markDone()}
              className="flex-1 rounded-full bg-saathi-forest py-3 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
            >
              {t("scheme.markDone")}
            </button>
            <Link
              href="/dashboard"
              className="flex items-center justify-center rounded-full border border-saathi-sand px-6 py-3 text-sm font-medium text-saathi-ink hover:bg-white"
            >
              {getUiText(language, "Back")}
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ---------- Pre-fill phase (review data before opening portal) ----------
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
        {/* Scheme header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="rounded bg-saathi-sand/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-saathi-ink/50">
              {scheme.category}
            </span>
            <span className="rounded bg-saathi-mint/30 px-1.5 py-0.5 text-[10px] font-medium text-saathi-forest">
              ₹{scheme.estimatedBenefitINR.toLocaleString(locale)}
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-saathi-ink sm:text-3xl">
            {translatedName || scheme.name}
          </h1>
          <p className="mt-1 text-xs text-saathi-ink/50">
            {scheme.department}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-saathi-ink/70">
            {translatedDesc || scheme.description}
          </p>
        </div>

        {/* Auto-fill banner */}
        {autoFilledCount > 0 && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-medium text-green-800">
              {t("scheme.autoFilled", {
                filled: autoFilledCount,
                total: scheme.formFields.length,
              })}
            </p>
          </div>
        )}

        {/* Portal link preview */}
        <div className="mb-6 rounded-2xl border border-saathi-sand bg-saathi-cream/50 px-4 py-3">
          <p className="text-xs text-saathi-ink/50">
            {t("scheme.officialPortal")}
          </p>
          <p className="text-sm font-medium text-saathi-forest">
            {scheme.portalUrl}
          </p>
        </div>

        {/* Voice error */}
        {voiceError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <p className="text-sm font-medium text-red-700">{voiceError}</p>
          </div>
        )}

        {/* Voice prompt overlay */}
        {askingField && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-800">
              {listening
                ? interim || t("onboarding.listening")
                : `${t("scheme.pleaseEnter")} ${getFieldLabel(language, scheme.formFields.find((f) => f.id === askingField)?.label ?? "")}`}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={values[askingField] ?? ""}
                onChange={(e) =>
                  setFieldValue(askingField, e.target.value, "manual")
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") setAskingField(null);
                }}
                className="flex-1 rounded-lg border border-blue-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (listenRef.current) {
                    listenRef.current.stop();
                    listenRef.current = null;
                  }
                  setAskingField(null);
                  setListening(false);
                  setInterim("");
                }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {getUiText(language, "Done")}
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="mb-6 flex flex-wrap gap-3">
          {emptyFields.length > 0 && isSTTAvailable() && (
            <button
              type="button"
              onClick={() => askForMissing(emptyFields[0]!, emptyFields)}
              className="flex items-center gap-1.5 rounded-full bg-saathi-forest/10 px-4 py-2 text-xs font-semibold text-saathi-forest transition hover:bg-saathi-forest/20"
            >
              <MicIcon />
              {t("scheme.fillMissingCount", { count: emptyFields.length })}
            </button>
          )}
        </div>

        {/* Form fields (editable before opening portal) */}
        <div className="space-y-4">
          {scheme.formFields.map((field) => (
            <div key={field.id}>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-saathi-ink/70">
                  {getFieldLabel(language, field.label)}
                  {field.required && (
                    <span className="text-red-400"> *</span>
                  )}
                </label>
                {fieldStatus[field.id] === "auto" && (
                  <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                    {getUiText(language, "Auto")}
                  </span>
                )}
                {fieldStatus[field.id] === "voice" && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                    {getUiText(language, "Voice")}
                  </span>
                )}
              </div>
              {field.type === "select" && field.options ? (
                <select
                  value={values[field.id] ?? ""}
                  onChange={(e) =>
                    setFieldValue(field.id, e.target.value, "manual")
                  }
                  className="w-full rounded-xl border border-saathi-sand bg-white px-4 py-2.5 text-sm text-saathi-ink outline-none transition focus:border-saathi-forest focus:ring-1 focus:ring-saathi-mint"
                >
                  <option value="">{getUiText(language, "Select…")}</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  value={values[field.id] ?? ""}
                  onChange={(e) =>
                    setFieldValue(field.id, e.target.value, "manual")
                  }
                  rows={3}
                  className="w-full rounded-xl border border-saathi-sand bg-white px-4 py-2.5 text-sm text-saathi-ink outline-none transition focus:border-saathi-forest focus:ring-1 focus:ring-saathi-mint"
                />
              ) : (
                <input
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : "text"
                  }
                  value={values[field.id] ?? ""}
                  onChange={(e) =>
                    setFieldValue(field.id, e.target.value, "manual")
                  }
                  className="w-full rounded-xl border border-saathi-sand bg-white px-4 py-2.5 text-sm text-saathi-ink outline-none transition focus:border-saathi-forest focus:ring-1 focus:ring-saathi-mint"
                />
              )}
            </div>
          ))}
        </div>

        {/* Required documents */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-saathi-ink">
            {t("scheme.requiredDocuments")}
          </h2>
          <ul className="mt-2 space-y-1.5">
            {scheme.requiredDocuments.map((doc) => (
              <li
                key={doc}
                className="flex items-center gap-2 text-xs text-saathi-ink/60"
              >
                <DocIcon />
                {doc}
                <Link
                  href="/documents"
                  className="ml-auto text-saathi-forest hover:underline"
                >
                  {getUiText(language, "Upload")}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA: Open official portal */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={openPortal}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-saathi-forest py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
          >
            <ExternalLinkIcon />
            {t("scheme.openPortal")}
          </button>
          <Link
            href="/eligibility"
            className="flex items-center justify-center rounded-full border border-saathi-sand px-6 py-3 text-sm font-medium text-saathi-ink hover:bg-white"
          >
            {getUiText(language, "Back")}
          </Link>
        </div>
      </main>
    </>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      className="h-4 w-4 text-saathi-forest"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}
