"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";
import { useAppLanguage } from "@/lib/app-language";
import { getProfile, type ProfileData } from "@/lib/profile-vault";
import { matchFieldsToProfile, type ExtractedFormField } from "@/lib/form-processor";
import { listen, speak, stopSpeaking, type ListenHandle } from "@/lib/speech-engine";
import { useTranslation } from "react-i18next";

type Step = "upload" | "scanning" | "review" | "filling" | "generating" | "done";

export default function FormFillPage() {
  const { isLoaded } = useUser();
  const { language } = useAppLanguage();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileData>({});
  const [formImage, setFormImage] = useState("");
  const [formLanguage, setFormLanguage] = useState("");
  const [fields, setFields] = useState<ExtractedFormField[]>([]);
  const [filledFields, setFilledFields] = useState<Record<string, string>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [currentMissing, setCurrentMissing] = useState(0);
  const [pdfUrl, setPdfUrl] = useState("");
  const [listening, setListening] = useState(false);
  const listenRef = useRef<ListenHandle | null>(null);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopSpeaking();
      listenRef.current?.abort();
    };
  }, []);

  // ─── Upload / scan ────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormImage(dataUrl);
      scanForm(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraOpen(false);
      setError("Camera access denied");
    }
  }

  function captureAndScan() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = Math.min(video.videoWidth, 1600);
    canvas.height = Math.round(
      (canvas.width / video.videoWidth) * video.videoHeight,
    );
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setFormImage(dataUrl);
    scanForm(dataUrl);
  }

  async function scanForm(imageDataUrl: string) {
    setStep("scanning");
    setError("");
    try {
      const res = await fetch("/api/agent/scan-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Scan failed");
      }

      const data = await res.json();
      setFormLanguage(data.languageName || data.language || "Unknown");
      setFields(data.fields || []);

      // Match fields to profile
      const match = matchFieldsToProfile(data.fields || [], profile);
      setFilledFields(match.filled);
      setMissingFields(match.missing);
      setStep("review");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setStep("upload");
    }
  }

  // ─── Fill missing fields ──────────────────────────────

  function startFillingMissing() {
    if (missingFields.length === 0) {
      generatePdf();
      return;
    }
    setCurrentMissing(0);
    setStep("filling");
    askForField(0);
  }

  function askForField(index: number) {
    if (index >= missingFields.length) {
      generatePdf();
      return;
    }
    const fieldName = missingFields[index];
    speak(t("scheme.pleaseEnter", { defaultValue: "Please tell me your" }) + " " + fieldName, language);
  }

  const handleVoiceForMissing = useCallback(() => {
    if (listening) {
      listenRef.current?.stop();
      listenRef.current = null;
      setListening(false);
      return;
    }

    stopSpeaking();
    setListening(true);

    listenRef.current = listen({
      lang: language,
      timeoutMs: 15_000,
      onResult: (result) => {
        setListening(false);
        listenRef.current = null;
        const fieldName = missingFields[currentMissing];
        if (result.transcript.trim() && fieldName) {
          setFilledFields((prev) => ({
            ...prev,
            [fieldName]: result.transcript.trim(),
          }));
          const next = currentMissing + 1;
          setCurrentMissing(next);
          if (next < missingFields.length) {
            setTimeout(() => askForField(next), 500);
          } else {
            setStep("review");
          }
        }
      },
      onError: () => {
        setListening(false);
        listenRef.current = null;
      },
      onEnd: () => setListening(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, language, currentMissing, missingFields]);

  // ─── Generate PDF ─────────────────────────────────────

  async function generatePdf() {
    setStep("generating");
    setError("");
    try {
      const fieldPositions = fields
        .filter((f) => filledFields[f.label])
        .map((f) => ({
          label: f.label,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
        }));

      const res = await fetch("/api/agent/fill-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formImage,
          filledFields,
          fieldPositions,
          mode: "overlay",
        }),
      });

      if (!res.ok) throw new Error("PDF generation failed");
      const data = await res.json();
      setPdfUrl(`data:application/pdf;base64,${data.pdf}`);
      setStep("done");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setStep("review");
    }
  }

  // ─── Render ───────────────────────────────────────────

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 pb-24 pt-28">
      <div className="flex items-center gap-3">
        <Link href="/assistant" className="text-saathi-forest">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="font-display text-2xl font-semibold text-saathi-ink">
          Fill Offline Form
        </h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-saathi-ink/70">
            Scan or upload a government form. We&apos;ll detect the language, extract fields, and auto-fill from your profile.
          </p>

          <button
            type="button"
            onClick={() => void openCamera()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-saathi-forest px-6 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Scan with camera
          </button>

          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-saathi-forest/30 px-6 text-sm font-medium text-saathi-forest transition hover:bg-saathi-mint/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload file
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
          </label>

          {/* Demo form + Assistant help */}
          <div className="mt-2 rounded-2xl border border-saathi-sand bg-saathi-cream/40 p-4">
            <p className="text-xs font-medium text-saathi-ink/60 mb-3">Try it out:</p>
            <a
              href="/demo-form.pdf"
              download="PM-KISAN-Application-Form.pdf"
              className="inline-flex items-center gap-2 text-sm font-medium text-saathi-forest hover:underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Download demo form (PM-KISAN)
            </a>
          </div>

          <Link
            href="/assistant"
            className="flex items-center gap-3 rounded-2xl border border-saathi-forest/20 bg-gradient-to-r from-saathi-mint/20 to-saathi-forest/5 p-4 transition hover:shadow-md hover:border-saathi-forest/40"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-saathi-forest text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-saathi-ink">Need help filling a form?</p>
              <p className="text-xs text-saathi-ink/60">Ask the assistant — it&apos;ll guide you step by step, by voice</p>
            </div>
            <svg className="h-4 w-4 text-saathi-forest" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      )}

      {/* Camera */}
      {cameraOpen && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-saathi-forest/30 bg-black">
          <video ref={videoRef} className="w-full" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-4">
            <button
              type="button"
              onClick={captureAndScan}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg"
            >
              <div className="h-12 w-12 rounded-full border-4 border-saathi-forest" />
            </button>
            <button
              type="button"
              onClick={() => {
                streamRef.current?.getTracks().forEach((t) => t.stop());
                setCameraOpen(false);
              }}
              className="flex h-10 items-center rounded-full bg-white/20 px-4 text-sm font-medium text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scanning */}
      {step === "scanning" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
          <p className="text-sm text-saathi-ink/60">Scanning form and extracting fields...</p>
        </div>
      )}

      {/* Review */}
      {step === "review" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-saathi-mint/20 px-4 py-3">
            <p className="text-sm font-medium text-saathi-forest">
              Detected language: {formLanguage}
            </p>
            <p className="text-xs text-saathi-ink/60 mt-1">
              {Object.keys(filledFields).length} fields auto-filled · {missingFields.length} fields missing
            </p>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => {
              const value = filledFields[field.label];
              const isMissing = missingFields.includes(field.labelEnglish || field.label);
              return (
                <div key={i} className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-saathi-ink/70">
                    {field.label}
                    {field.labelEnglish && field.labelEnglish !== field.label && (
                      <span className="text-saathi-ink/40">({field.labelEnglish})</span>
                    )}
                    {!isMissing && value && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        Auto
                      </span>
                    )}
                    {isMissing && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        Missing
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={filledFields[field.label] ?? ""}
                    onChange={(e) =>
                      setFilledFields((prev) => ({ ...prev, [field.label]: e.target.value }))
                    }
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-saathi-ink outline-none transition focus:border-saathi-forest ${
                      isMissing && !filledFields[field.label]
                        ? "border-amber-300 bg-amber-50"
                        : "border-saathi-sand bg-white"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-2">
            {missingFields.length > 0 && (
              <button
                type="button"
                onClick={startFillingMissing}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-saathi-forest/30 py-3 text-sm font-medium text-saathi-forest hover:bg-saathi-mint/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Fill missing by voice
              </button>
            )}
            <button
              type="button"
              onClick={generatePdf}
              className="flex-1 rounded-full bg-saathi-forest py-3 text-sm font-semibold text-white shadow-md hover:bg-saathi-ink"
            >
              Generate PDF
            </button>
          </div>
        </div>
      )}

      {/* Filling missing fields by voice */}
      {step === "filling" && (
        <div className="flex flex-col items-center gap-6 py-8">
          <p className="text-sm text-saathi-ink/70 text-center">
            Field {currentMissing + 1} of {missingFields.length}
          </p>
          <h2 className="text-lg font-semibold text-saathi-ink text-center">
            {missingFields[currentMissing]}
          </h2>
          <button
            type="button"
            onClick={handleVoiceForMissing}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition ${
              listening
                ? "animate-pulse bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-saathi-forest/10 text-saathi-forest hover:bg-saathi-forest/20"
            }`}
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
          <p className="text-xs text-saathi-ink/50">
            {listening ? "Listening..." : "Tap to speak your answer"}
          </p>
          <button
            type="button"
            onClick={() => {
              listenRef.current?.abort();
              listenRef.current = null;
              setListening(false);
              setStep("review");
            }}
            className="text-sm text-saathi-ink/50 underline-offset-4 hover:underline"
          >
            Skip — type manually instead
          </button>
        </div>
      )}

      {/* Generating */}
      {step === "generating" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
          <p className="text-sm text-saathi-ink/60">Generating your filled form...</p>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-saathi-ink">Form Ready!</h2>
          <p className="text-sm text-saathi-ink/60 text-center">
            Your form has been filled. Download the PDF below.
          </p>
          <a
            href={pdfUrl}
            download={`formsaathi-filled-${Date.now()}.pdf`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-saathi-forest px-8 text-sm font-semibold text-white shadow-md hover:bg-saathi-ink"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PDF
          </a>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setStep("upload");
                setFields([]);
                setFilledFields({});
                setMissingFields([]);
                setFormImage("");
                setPdfUrl("");
              }}
              className="text-sm text-saathi-forest underline-offset-4 hover:underline"
            >
              Fill another form
            </button>
            <Link href="/assistant" className="text-sm text-saathi-ink/50 underline-offset-4 hover:underline">
              Back to assistant
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
