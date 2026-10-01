"use client";

import { useAppLanguage } from "@/lib/app-language";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";
import { logVaultAccess } from "@/lib/vault-log";
import { getFieldLabel, getUiText } from "@/lib/ui-text";
import { speak, stopSpeaking } from "@/lib/speech-engine";

type ScanState = "idle" | "camera" | "processing" | "done";
type ScanSide = "front" | "back";

export default function AadhaarScanPage() {
  const { language } = useAppLanguage();
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<ScanState>("idle");
  const [scanSide, setScanSide] = useState<ScanSide>("front");
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ProfileData>({});
  const [backExtracted, setBackExtracted] = useState<ProfileData>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);

  // Single TTS effect — speaks page title on load, then state transitions
  const hasSpoken = useRef(false);
  const prevState = useRef<ScanState>(state);
  useEffect(() => {
    // Initial page load speak (once)
    if (!hasSpoken.current) {
      hasSpoken.current = true;
      speak(getUiText(language, "Scan your Aadhaar card"), language);
      return;
    }
    // State transition speaks
    if (state !== prevState.current) {
      prevState.current = state;
      if (state === "processing") {
        speak(getUiText(language, "Scanning Aadhaar card…"), language);
      } else if (state === "done") {
        speak(getUiText(language, "Fill in or correct the details below, then continue."), language);
      }
    }
  }, [state, language]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { stopCamera(); stopSpeaking(); };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError(null);
    setState("camera");
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
      setError(t("aadhaar.cameraDenied"));
      setState("idle");
    }
  }, [t]);

  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Crop to the guide frame (plus a small margin) so card text keeps most
    // of the image budget instead of being a fraction of the full frame.
    let sx = 0;
    let sy = 0;
    let sw = canvas.width;
    let sh = canvas.height;
    const videoRect = video.getBoundingClientRect();
    const guideRect = guideRef.current?.getBoundingClientRect();
    if (guideRect && videoRect.width > 0 && videoRect.height > 0) {
      const MARGIN = 1.08;
      const relW = Math.min(1, (guideRect.width / videoRect.width) * MARGIN);
      const relH = Math.min(1, (guideRect.height / videoRect.height) * MARGIN);
      const relX =
        (guideRect.left - videoRect.left) / videoRect.width +
        (guideRect.width / videoRect.width - relW) / 2;
      const relY =
        (guideRect.top - videoRect.top) / videoRect.height +
        (guideRect.height / videoRect.height - relH) / 2;
      sx = Math.round(Math.max(0, relX * canvas.width));
      sy = Math.round(Math.max(0, relY * canvas.height));
      sw = Math.round(Math.min(canvas.width - sx, relW * canvas.width));
      sh = Math.round(Math.min(canvas.height - sy, relH * canvas.height));
    }

    const MAX_EDGE = 1600;
    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));
    const small = document.createElement("canvas");
    small.width = width;
    small.height = height;
    small.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, width, height);
    const dataUrl = small.toDataURL("image/jpeg", 0.9);

    stopCamera();
    setState("processing");
    setError(null);

    try {
      const res = await fetch("/api/openrouter/aadhaar-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = (await res.json()) as {
        profile?: ProfileData;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.detail
              ? `${data.error}: ${data.detail}`
              : data.error
            : t("aadhaar.scanExtractFailed");
        setError(msg);
        setState("idle");
        return;
      }

      const scanned = data.profile ?? {};

      if (scanSide === "front") {
        // Merge policy: manually entered details win; the scan only fills
        // gaps. A matching Aadhaar number confirms the scan is the same card.
        let saved: ProfileData = {};
        try {
          saved = await getProfile();
        } catch {
          saved = {};
        }
        const merged: ProfileData = { ...scanned };
        for (const [key, val] of Object.entries(saved)) {
          if (typeof val === "string" && val) {
            merged[key as keyof ProfileData] = val;
          }
        }
        const savedNum = (saved.aadhaarNumber ?? "").replace(/\D/g, "");
        const scannedNum = (scanned.aadhaarNumber ?? "").replace(/\D/g, "");
        if (savedNum && scannedNum) {
          setMergeNotice(
            savedNum === scannedNum
              ? "Matched your saved Aadhaar number — details auto-filled from what you entered."
              : "Scanned Aadhaar number doesn't match your saved details — kept your saved details.",
          );
        } else if (Object.keys(saved).length > 0) {
          setMergeNotice("Auto-filled from your saved details; the scan filled the blanks.");
        }
        setExtracted(merged);
        setState("done");
      } else {
        setBackExtracted(scanned);
        // Merge back data into extracted (back overrides only empty fields)
        setExtracted((prev) => {
          const merged = { ...prev };
          const back = scanned;
          for (const [key, val] of Object.entries(back)) {
            if (val && !merged[key as keyof ProfileData]) {
              merged[key as keyof ProfileData] = val;
            }
          }
          return merged;
        });
        setState("done");
      }
    } catch {
      setError(t("aadhaar.scanExtractFailed"));
      setState("idle");
    }
  }, [stopCamera, t, scanSide]);

  const [manualFields, setManualFields] = useState<ProfileData>({});

  const handleFieldChange = useCallback((key: keyof ProfileData, value: string) => {
    setManualFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const saveAndContinue = useCallback(async () => {
    const merged = { ...extracted, ...manualFields };
    await saveProfile(merged);
    void logVaultAccess({ source: "/onboarding/aadhaar", dataCategory: "profile (Aadhaar scan)", action: "write" });
    router.push("/onboarding/voice");
  }, [extracted, manualFields, router]);


  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 pb-24 pt-28">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
          {getUiText(language, "Optional · Aadhaar Scan")}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-bharatlink-navy sm:text-3xl">
          {getUiText(language, "Scan your Aadhaar card")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-bharatlink-navy/70">
          {getUiText(
            language,
            "Point the camera at your Aadhaar card. One photo is sent to a vision API (OpenRouter) to read visible text. You can edit every field before saving; saved data stays only in your encrypted on-device vault.",
          )}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}

      {state === "idle" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void startCamera()}
            className="glow-coral inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 px-6 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-500 hover:to-amber-500 hover:scale-[1.02]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            {getUiText(language, "Open camera")}
          </button>
          <button
            type="button"
            onClick={() => setState("done")}
            className="inline-flex h-12 items-center justify-center rounded-full border border-orange-500/30 px-6 text-sm font-bold text-orange-600 transition hover:bg-orange-500/10"
          >
            {getUiText(language, "Enter details manually")}
          </button>
          <Link
            href="/onboarding/voice"
            className="text-center text-sm font-medium text-bharatlink-navy/50 underline-offset-4 hover:underline"
          >
            {getUiText(language, "Skip — enter details manually later →")}
          </Link>
        </div>
      )}

      {state === "camera" && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-orange-500/30 bg-black">
          <video ref={videoRef} className="w-full" autoPlay playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div ref={guideRef} className="h-48 w-72 rounded-xl border-2 border-white/60 shadow-lg sm:h-56 sm:w-80" />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-4">
            <button
              type="button"
              onClick={() => void captureAndProcess()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_0_20px_#ea580c] transition hover:scale-105"
            >
              <div className="h-12 w-12 rounded-full border-4 border-orange-600" />
            </button>
            <button
              type="button"
              onClick={() => { stopCamera(); setState("idle"); }}
              className="flex h-10 items-center rounded-full bg-white/20 px-4 text-sm font-medium text-white backdrop-blur hover:bg-white/30"
            >
              {getUiText(language, "Cancel")}
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {state === "processing" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent shadow-[0_0_10px_#ea580c]" />
          <p className="text-sm text-bharatlink-navy/60">
            {getUiText(language, "Scanning Aadhaar card…")}
          </p>
        </div>
      )}

      {state === "done" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-bold text-orange-600">
            {getUiText(language, "Fill in or correct the details below, then continue.")}
          </p>
          {mergeNotice && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {getUiText(language, mergeNotice)}
            </p>
          )}
          {(
            [
              { key: "fullName" as const, label: "Full Name" },
              { key: "fatherName" as const, label: "Father's Name" },
              { key: "dob" as const, label: "Date of Birth" },
              { key: "gender" as const, label: "Gender" },
              { key: "address" as const, label: "Address" },
              { key: "pincode" as const, label: "Pincode" },
              { key: "aadhaarNumber" as const, label: "Aadhaar Number" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-bharatlink-navy/70">
                {getFieldLabel(language, label)}
              </label>
              <input
                type="text"
                value={manualFields[key] ?? extracted[key] ?? ""}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="glass-card w-full rounded-xl border border-orange-500/20 px-4 py-2.5 text-sm text-bharatlink-navy outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
              />
            </div>
          ))}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void saveAndContinue()}
                className="glow-coral flex-1 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-500 hover:to-amber-500 hover:scale-[1.02]"
              >
                {getUiText(language, "Save & continue")}
              </button>
              <button
                type="button"
                onClick={() => { setState("idle"); setScanSide("front"); setExtracted({}); setBackExtracted({}); setManualFields({}); }}
                className="rounded-full border border-bharatlink-sand px-5 py-3 text-sm font-medium text-bharatlink-navy hover:bg-white"
              >
                {getUiText(language, "Rescan")}
              </button>
            </div>
            {!backExtracted.aadhaarNumber && (
              <button
                type="button"
                onClick={() => {
                  setScanSide("back");
                  setState("idle");
                  void startCamera();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-500/30 px-6 py-2.5 text-sm font-bold text-orange-600 transition hover:bg-orange-500/10"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
                {getUiText(language, "Scan back side")}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
