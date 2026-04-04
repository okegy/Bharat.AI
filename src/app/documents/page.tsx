"use client";

import { TopBar } from "@/components/formsaathi/TopBar";
import { useAppLanguage } from "@/lib/app-language";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDocuments, saveDocument, deleteDocument, type CapturedDocument } from "@/lib/profile-vault";
import { getDocTypeLabel, getDocumentMetaText, getUiText } from "@/lib/ui-text";
import { useTranslation } from "react-i18next";
import { speak, stopSpeaking } from "@/lib/speech-engine";

type CaptureState = "list" | "camera" | "processing" | "preview";

const DOC_TYPES = [
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "voter-id", label: "Voter ID" },
  { value: "ration-card", label: "Ration Card" },
  { value: "income-cert", label: "Income Certificate" },
  { value: "caste-cert", label: "Caste Certificate" },
  { value: "birth-cert", label: "Birth Certificate" },
  { value: "land-record", label: "Land Records" },
  { value: "bank-passbook", label: "Bank Passbook" },
  { value: "disability-cert", label: "Disability Certificate" },
  { value: "marksheet", label: "Marksheet / Diploma" },
  { value: "other", label: "Other Document" },
];

function assessQuality(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let totalBrightness = 0;
  let sharpness = 0;
  const pixelCount = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    totalBrightness += (r + g + b) / 3;
  }
  const avgBright = totalBrightness / pixelCount;

  const step = 4 * 4;
  for (let i = step; i < data.length - step; i += 4) {
    const cur = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
    const prev = (data[i - step]! + data[i - step + 1]! + data[i - step + 2]!) / 3;
    sharpness += Math.abs(cur - prev);
  }
  const avgSharp = sharpness / (pixelCount / 4);

  let score = 50;
  if (avgBright > 60 && avgBright < 200) score += 20;
  else if (avgBright > 40 && avgBright < 220) score += 10;
  if (avgSharp > 8) score += 30;
  else if (avgSharp > 4) score += 15;
  if (w >= 1200 && h >= 800) score += 10;
  else if (w >= 800 && h >= 600) score += 5;

  return Math.min(100, Math.max(0, score));
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { language, locale } = useAppLanguage();
  const [docs, setDocs] = useState<CapturedDocument[]>([]);
  const [state, setState] = useState<CaptureState>("list");
  const [docType, setDocType] = useState("aadhaar");
  const [loading, setLoading] = useState(true);
  const [quality, setQuality] = useState(0);
  const [capturedImage, setCapturedImage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    getDocuments().then((d) => {
      setDocs(d);
      setLoading(false);
    });
  }, []);

  // Auto-speak page title on load
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (loading || hasSpoken.current) return;
    hasSpoken.current = true;
    speak(getUiText(language, "Document Vault"), language);
    return () => stopSpeaking();
  }, [loading, language]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
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
      setState("list");
    }
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const q = assessQuality(canvas);
    setQuality(q);

    if (q < 40) {
      return;
    }

    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(imageData);
    stopCamera();
    setState("preview");
  }, [stopCamera]);

  const saveAndReturn = useCallback(async () => {
    setState("processing");
    const label = getDocTypeLabel(language, docType);
    const doc: CapturedDocument = {
      id: crypto.randomUUID(),
      type: docType,
      label,
      imageData: capturedImage,
      extractedFields: {},
      capturedAt: Date.now(),
      qualityScore: quality,
    };
    await saveDocument(doc);
    setDocs((prev) => [...prev, doc]);
    setCapturedImage("");
    setQuality(0);
    setState("list");
  }, [capturedImage, docType, language, quality]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDocument(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-saathi-ink sm:text-4xl">
          {getUiText(language, "Document Vault")}
        </h1>
        <p className="mt-1 text-sm text-saathi-ink/60">
          {getUiText(
            language,
            "Capture and store documents on your device. Encrypted, never sent to any server.",
          )}
        </p>

        {state === "list" && (
          <>
            {/* Capture button */}
            <div className="mt-6 flex gap-3">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="flex-1 rounded-xl border border-saathi-sand bg-white px-4 py-2.5 text-sm text-saathi-ink outline-none focus:border-saathi-forest"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {getDocTypeLabel(language, dt.value)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="flex items-center gap-2 rounded-full bg-saathi-forest px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                {getUiText(language, "Capture")}
              </button>
            </div>

            {/* Document list */}
            {loading ? (
              <div className="mt-12 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
              </div>
            ) : docs.length === 0 ? (
              <div className="mt-12 rounded-2xl border border-dashed border-saathi-sand bg-white p-8 text-center">
                <p className="text-saathi-ink/50">
                  {getUiText(language, "No documents captured yet.")}
                </p>
                <p className="mt-1 text-xs text-saathi-ink/40">
                  {getUiText(language, "Use the camera button above to scan a document.")}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 rounded-2xl border border-saathi-sand bg-white p-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={doc.imageData}
                      alt={doc.label}
                      className="h-16 w-24 rounded-lg border border-saathi-sand object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-saathi-ink">{doc.label}</p>
                      <p className="text-xs text-saathi-ink/50">
                        {getDocumentMetaText(
                          language,
                          new Date(doc.capturedAt).toLocaleDateString(locale),
                          doc.qualityScore,
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(doc.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      {getUiText(language, "Delete")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <Link href="/dashboard" className="text-sm font-medium text-saathi-forest underline-offset-4 hover:underline">
                {`← ${getUiText(language, "Dashboard")}`}
              </Link>
            </div>
          </>
        )}

        {state === "camera" && (
          <div className="relative mt-6 overflow-hidden rounded-2xl border-2 border-dashed border-saathi-forest/30 bg-black">
            <video ref={videoRef} className="w-full" autoPlay playsInline muted />
            {/* Framing overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-52 w-80 rounded-xl border-2 border-white/60 shadow-lg sm:h-60 sm:w-96" />
            </div>
            {/* Quality indicator */}
            {quality > 0 && quality < 40 && (
              <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                {getUiText(language, "Low quality — hold steady")}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-4">
              <button
                type="button"
                onClick={capture}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg transition hover:scale-105"
              >
                <div className="h-12 w-12 rounded-full border-4 border-saathi-forest" />
              </button>
              <button
                type="button"
                onClick={() => { stopCamera(); setState("list"); }}
                className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30"
              >
                {getUiText(language, "Cancel")}
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {state === "preview" && capturedImage && (
          <div className="mt-6 space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt={t("documents.capturedDocument")}
              className="w-full rounded-2xl border border-saathi-sand"
            />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-saathi-ink">
                  {getUiText(language, "Quality:")} {quality}%
                </p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-saathi-sand">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quality >= 70 ? "bg-green-500" : quality >= 40 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${quality}%` }}
                  />
                </div>
              </div>
              <span className={`text-xs font-bold ${
                quality >= 70 ? "text-green-600" : quality >= 40 ? "text-amber-600" : "text-red-600"
              }`}>
                {quality >= 70
                  ? getUiText(language, "Good")
                  : quality >= 40
                    ? getUiText(language, "OK")
                    : getUiText(language, "Poor")}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void saveAndReturn()}
                className="flex-1 rounded-full bg-saathi-forest py-3 text-sm font-semibold text-white shadow-md transition hover:bg-saathi-ink"
              >
                {getUiText(language, "Save to vault")}
              </button>
              <button
                type="button"
                onClick={() => { setCapturedImage(""); void startCamera(); }}
                className="rounded-full border border-saathi-sand px-5 py-3 text-sm font-medium text-saathi-ink hover:bg-white"
              >
                {getUiText(language, "Retake")}
              </button>
            </div>
          </div>
        )}

        {state === "processing" && (
          <div className="mt-12 flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
            <p className="text-sm text-saathi-ink/60">
              {getUiText(language, "Encrypting & saving…")}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
