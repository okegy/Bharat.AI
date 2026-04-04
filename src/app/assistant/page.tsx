"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppLanguage } from "@/lib/app-language";
import {
  listen,
  speak,
  stopSpeaking,
  isSTTAvailable,
  type ListenHandle,
} from "@/lib/speech-engine";
import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";
import { useTranslation } from "react-i18next";
import {
  createConversation,
  addUserMessage,
  addAssistantMessage,
  trimConversation,
  serializeForApi,
  type AgentConversation,
  type AgentPhase,
  type AgentChatResponse,
} from "@/lib/agent-state";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
  portalUrl?: string;
  pdfDownload?: { base64: string; filename: string };
  showUploadCard?: boolean;
  toolsUsed?: string[];
  timestamp: number;
}

type UIState = "idle" | "listening" | "thinking" | "speaking";

export default function AssistantPage() {
  const { user, isLoaded } = useUser();
  const { language } = useAppLanguage();
  const { t } = useTranslation();

  const [conv, setConv] = useState<AgentConversation | null>(null);
  const [uiMessages, setUiMessages] = useState<UIMessage[]>([]);
  const [uiState, setUiState] = useState<UIState>("idle");
  const [textInput, setTextInput] = useState("");
  const [interim, setInterim] = useState("");
  const [profile, setProfile] = useState<ProfileData>({});
  const [phase, setPhase] = useState<AgentPhase>("greeting");
  const [error, setError] = useState("");
  const [filledFormFields, setFilledFormFields] = useState<Record<string, string> | null>(null);
  const uploadedFormImageRef = useRef<string>("");

  // Screen sharing
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [screenAutoCapture, setScreenAutoCapture] = useState(true);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPurpose, setCameraPurpose] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const listenRef = useRef<ListenHandle | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);

  // Refs to avoid stale closures in intervals and callbacks
  const convRef = useRef(conv);
  const profileRef = useRef(profile);
  const phaseRef = useRef(phase);
  const uiStateRef = useRef(uiState);
  const sendingRef = useRef(false);

  useEffect(() => { convRef.current = conv; }, [conv]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { uiStateRef.current = uiState; }, [uiState]);

  // Init conversation + load profile (once on mount)
  const hasGreeted = useRef(false);
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!isLoaded || !user || hasInitialized.current) return;
    hasInitialized.current = true;
    getProfile().then((p) => {
      setProfile(p);
      const c = createConversation(language);
      setConv(c);
    });
  }, [isLoaded, user, language]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [uiMessages]);

  // Kill any lingering speech from previous pages on mount + cleanup on unmount
  useEffect(() => {
    stopSpeaking();
    return () => {
      stopSpeaking();
      listenRef.current?.abort();
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, []);

  const addUIMessage = useCallback(
    (role: "user" | "assistant", text: string, toolsUsed?: string[]) => {
      msgCounter.current += 1;
      setUiMessages((prev) => [
        ...prev,
        { id: `msg-${msgCounter.current}`, role, text, toolsUsed, timestamp: Date.now() },
      ]);
    },
    [],
  );

  // ─── Send to agent API (with concurrency guard) ───────

  const sendToAgent = useCallback(
    async (userText: string, images: string[]) => {
      const currentConv = convRef.current;
      if (!currentConv) return;
      if (sendingRef.current) return; // prevent concurrent sends
      sendingRef.current = true;

      let updated = currentConv;
      if (userText) {
        updated = addUserMessage(updated, userText, images.length ? images : undefined);
        addUIMessage("user", userText);
      }
      updated = trimConversation(updated);
      setConv(updated);
      convRef.current = updated;
      setUiState("thinking");
      setError("");

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: serializeForApi(updated),
            language,
            images: images.length ? images : undefined,
            profileSnapshot: profileRef.current,
            phase: phaseRef.current,
            screenShareActive,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as AgentChatResponse & { filledFormData?: Record<string, string> };

        // Track filled form fields for quick PDF generation
        if (data.filledFormData) {
          setFilledFormFields(data.filledFormData);
        }

        // Apply profile updates using functional updater to avoid stale state
        if (data.profileUpdates && Object.keys(data.profileUpdates).length > 0) {
          setProfile((prev) => {
            const merged = { ...prev, ...data.profileUpdates };
            saveProfile(data.profileUpdates!);
            return merged;
          });
        }

        // Update conversation with assistant reply
        const withReply = addAssistantMessage(updated, data.reply);
        setConv(withReply);
        convRef.current = withReply;

        // Show upload card if agent is asking for a form/document
        const wantsUpload = data.toolsUsed?.includes("request_camera") ||
          (phaseRef.current === "offline-scan" && !data.toolsUsed?.includes("fill_form_fields")) ||
          /upload|scan|photo|image|form.*share|tasveer|photo|chithra/i.test(data.reply);

        msgCounter.current += 1;
        setUiMessages((prev) => [
          ...prev,
          {
            id: `msg-${msgCounter.current}`,
            role: "assistant",
            text: data.reply,
            toolsUsed: data.toolsUsed,
            showUploadCard: wantsUpload,
            timestamp: Date.now(),
          },
        ]);

        // Speak the reply
        setUiState("speaking");
        speak(data.reply, language, {
          onEnd: () => setUiState("idle"),
        });

        // Handle next action from agent
        handleNextAction(data.nextAction);

        // Infer phase transitions
        if (data.toolsUsed?.includes("find_eligible_schemes")) {
          setPhase("scheme-recommend");
          phaseRef.current = "scheme-recommend";
        }
        if (data.toolsUsed?.includes("fill_form_fields")) {
          setPhase("offline-fill");
          phaseRef.current = "offline-fill";
        }
        if (data.toolsUsed?.includes("generate_filled_pdf")) {
          setPhase("complete");
          phaseRef.current = "complete";
        }
      } catch (err) {
        setUiState("idle");
        setError(String(err instanceof Error ? err.message : err));
        setTimeout(() => setError(""), 5000);
      } finally {
        sendingRef.current = false;
      }
    },
    [language, screenShareActive, addUIMessage],
  );

  // Keep a ref so intervals/callbacks always use latest sendToAgent
  const sendToAgentRef = useRef(sendToAgent);
  useEffect(() => { sendToAgentRef.current = sendToAgent; }, [sendToAgent]);

  // Auto-greet when conversation is created
  useEffect(() => {
    if (!conv || hasGreeted.current) return;
    hasGreeted.current = true;
    sendToAgent("", []);
  }, [conv, sendToAgent]);

  // ─── Handle agent actions ─────────────────────────────

  function handleNextAction(action?: Record<string, unknown>) {
    if (!action || action.type === "none") return;
    switch (action.type) {
      case "open_camera":
        setCameraPurpose(action.purpose as string);
        openCamera();
        break;
      case "start_screen_share":
        startScreenShare();
        break;
      case "stop_screen_share":
        stopScreenShare();
        break;
      case "listen_voice":
        setTimeout(() => toggleMicRef.current(), 500);
        break;
      case "download_pdf": {
        const pdfB64 = action.base64 as string;
        const pdfName = action.filename as string;
        downloadPdf(pdfB64, pdfName);
        // Also show a download button in chat
        msgCounter.current += 1;
        setUiMessages((prev) => [
          ...prev,
          {
            id: `msg-${msgCounter.current}`,
            role: "assistant",
            text: "",
            pdfDownload: { base64: pdfB64, filename: pdfName },
            timestamp: Date.now(),
          },
        ]);
        break;
      }
      case "generate_pdf":
        generatePdfFromAction(action);
        break;
      case "generate_pdf_client": {
        // Agent told us to generate PDF — we have the form image locally
        const fields = (action.filledFields ?? {}) as Record<string, string>;
        const profileClean = Object.fromEntries(
          Object.entries(profileRef.current).filter(([, v]) => v),
        ) as Record<string, string>;
        generateAndDownloadPdf({ ...profileClean, ...fields });
        break;
      }
      case "navigate": {
        const url = action.url as string;
        // Add a clickable portal link + screen share button in chat
        msgCounter.current += 1;
        setUiMessages((prev) => [
          ...prev,
          {
            id: `msg-${msgCounter.current}`,
            role: "assistant" as const,
            text: "",
            portalUrl: url,
            timestamp: Date.now(),
          },
        ]);
        // Also try opening directly (may be blocked by popup blocker)
        window.open(url, "_blank");
        // Auto-prompt screen share
        if (!screenShareActive) {
          setTimeout(() => {
            setPhase("online-guide");
            phaseRef.current = "online-guide";
            startScreenShare();
          }, 2000);
        }
        break;
      }
    }
  }

  async function generateAndDownloadPdf(fields: Record<string, string>) {
    try {
      const res = await fetch("/api/agent/fill-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formImage: uploadedFormImageRef.current || undefined,
          filledFields: fields,
          title: "Application Form — FormSaathi",
        }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const data = await res.json();
      downloadPdf(data.pdf, data.filename);

      // Build warning message for incomplete forms
      let warningText = "";
      if (data.emptyFields && data.emptyFields.length > 0) {
        const missing = (data.emptyFields as string[]).join(", ");
        warningText = `\n\n⚠️ ${data.fieldsFilled}/${data.totalFields} fields filled. Missing: ${missing}`;
      }

      msgCounter.current += 1;
      setUiMessages((prev) => [...prev, {
        id: `msg-${msgCounter.current}`, role: "assistant" as const,
        text: data.isComplete
          ? `✅ All ${data.totalFields} fields filled successfully!`
          : `⚠️ ${data.fieldsFilled}/${data.totalFields} fields filled.${warningText}`,
        pdfDownload: { base64: data.pdf, filename: data.filename },
        timestamp: Date.now(),
      }]);

      if (data.isComplete) {
        setPhase("complete");
        phaseRef.current = "complete";
      }
      // Don't set complete if incomplete — keep the download bar visible
    } catch {
      setError("PDF generation failed");
    }
  }

  function downloadPdf(base64: string, filename: string) {
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    link.click();
  }

  async function generatePdfFromAction(action: Record<string, unknown>) {
    try {
      const img = typeof action.formImage === "string" ? (action.formImage as string) : "";
      const hasForm = img.startsWith("data:") || img.length > 1000;
      const res = await fetch("/api/agent/fill-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formImage: hasForm ? img : undefined,
          filledFields: action.filledFields,
          fieldPositions: action.fieldPositions,
          title: "PM-KISAN Application — FormSaathi",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "PDF generation failed");
      }
      const data = await res.json();
      downloadPdf(data.pdf, data.filename);
      addUIMessage("assistant", "Your filled form PDF has been downloaded!");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  // ─── Mic / STT ────────────────────────────────────────

  const toggleMic = useCallback(() => {
    if (uiStateRef.current === "listening" && listenRef.current) {
      listenRef.current.stop();
      listenRef.current = null;
      setUiState("thinking");
      return;
    }

    stopSpeaking();
    setUiState("listening");
    setInterim("");

    listenRef.current = listen({
      lang: language,
      timeoutMs: 15_000,
      onInterim: (text) => setInterim(text),
      onResult: (result) => {
        setInterim("");
        setUiState("idle");
        listenRef.current = null;
        if (result.transcript.trim()) {
          const text = result.transcript.trim();
          const trySend = () => {
            if (sendingRef.current) { setTimeout(trySend, 200); return; }
            sendToAgentRef.current(text, []);
          };
          trySend();
        }
      },
      onError: (err) => {
        setInterim("");
        setUiState("idle");
        listenRef.current = null;
        setError(err);
        setTimeout(() => setError(""), 4000);
      },
      onEnd: () => {
        // Only reset if still listening (onResult/onError already handle their cases)
        if (uiStateRef.current === "listening") setUiState("idle");
      },
    });
  }, [language]);

  // Ref for toggleMic so handleNextAction can call latest version
  const toggleMicRef = useRef(toggleMic);
  useEffect(() => { toggleMicRef.current = toggleMic; }, [toggleMic]);

  // ─── Text submit ──────────────────────────────────────

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    stopSpeaking();
    const text = textInput.trim();
    setTextInput("");
    const trySend = () => {
      if (sendingRef.current) { setTimeout(trySend, 200); return; }
      sendToAgentRef.current(text, []);
    };
    trySend();
  }, [textInput]);

  // ─── Camera ───────────────────────────────────────────

  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraOpen(false);
      setError("Camera access denied");
    }
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = Math.min(video.videoWidth, 1600);
    canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    stopSpeaking();
    const trySend = () => {
      if (sendingRef.current) { setTimeout(trySend, 200); return; }
      if (cameraPurpose === "form_scan") {
        setPhase("offline-scan");
        phaseRef.current = "offline-scan";
        sendToAgentRef.current(`I scanned a form. Please detect the language, extract all fields, and fill them from my profile.`, [dataUrl]);
      } else {
        sendToAgentRef.current(`Scanned ${cameraPurpose || "document"}`, [dataUrl]);
      }
    };
    trySend();
  }

  // ─── Screen sharing ───────────────────────────────────

  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setScreenShareActive(true);

      stream.getVideoTracks()[0].onended = () => stopScreenShare();

      if (screenAutoCapture) startAutoCapture();
    } catch {
      setError("Screen sharing denied");
    }
  }

  function stopScreenShare() {
    stopAutoCapture();
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenShareActive(false);
  }

  const autoCaptureActiveRef = useRef(false);

  function startAutoCapture() {
    if (autoCaptureActiveRef.current) return;
    autoCaptureActiveRef.current = true;
    scheduleNextCapture();
  }

  function stopAutoCapture() {
    autoCaptureActiveRef.current = false;
    if (captureIntervalRef.current) {
      clearTimeout(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  }

  function scheduleNextCapture() {
    if (!autoCaptureActiveRef.current) return;
    // Wait until agent is done speaking/thinking before next capture
    captureIntervalRef.current = setTimeout(() => {
      if (!autoCaptureActiveRef.current || !screenStreamRef.current) return;
      if (sendingRef.current || uiStateRef.current === "speaking" || uiStateRef.current === "thinking") {
        // Agent still busy — check again in 2s
        scheduleNextCapture();
        return;
      }
      captureScreenFrame();
      // Schedule next after a delay
      captureIntervalRef.current = setTimeout(() => scheduleNextCapture(), 3000);
    }, 5000);
  }

  function captureScreenFrame() {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return;

    const video = document.createElement("video");
    video.srcObject = new MediaStream([track]);
    video.muted = true;

    const cleanup = () => {
      video.pause();
      video.srcObject = null;
      video.remove();
    };

    video.addEventListener("loadedmetadata", () => {
      video.play().then(() => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth || 1280, 1280);
        canvas.height = video.videoWidth
          ? Math.round((canvas.width / video.videoWidth) * video.videoHeight)
          : 720;
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        cleanup();
        // Show screenshot in chat as an image message
        addScreenshotMessage(dataUrl);
        const trySend = () => {
          if (sendingRef.current) { setTimeout(trySend, 300); return; }
          sendToAgentRef.current("Here is my current screen", [dataUrl]);
        };
        trySend();
      }).catch(cleanup);
    });
  }

  function addScreenshotMessage(dataUrl: string) {
    msgCounter.current += 1;
    setUiMessages((prev) => [
      ...prev,
      {
        id: `msg-${msgCounter.current}`,
        role: "user" as const,
        text: "",
        imageUrl: dataUrl,
        timestamp: Date.now(),
      },
    ]);
  }

  function toggleAutoCapture() {
    const next = !screenAutoCapture;
    setScreenAutoCapture(next);
    if (next && screenStreamRef.current) {
      startAutoCapture();
    } else {
      stopAutoCapture();
    }
  }

  // ─── File upload ──────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopSpeaking();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      uploadedFormImageRef.current = dataUrl;
      setPhase("offline-scan");
      phaseRef.current = "offline-scan";
      // Show the uploaded file in chat — only render as image if it's actually an image
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        addScreenshotMessage(dataUrl);
      } else {
        addUIMessage("user", `Uploaded: ${file.name}`);
      }
      // If a send is in-flight (e.g., greeting), wait for it then send
      const trySend = () => {
        if (sendingRef.current) {
          setTimeout(trySend, 200);
          return;
        }
        sendToAgentRef.current(`I uploaded a form. Please scan it, detect the language, extract all fields, and fill them from my profile.`, [dataUrl]);
      };
      trySend();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ─── Render ───────────────────────────────────────────

  if (!isLoaded || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-saathi-forest border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-saathi-sand px-4 py-3">
        <Link href="/dashboard" className="text-saathi-forest hover:underline">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-lg font-semibold text-saathi-ink">FormSaathi</h1>
          <p className="text-xs text-saathi-ink/50">
            {uiState === "listening" ? "Listening..."
              : uiState === "thinking" ? "Thinking..."
              : uiState === "speaking" ? "Speaking..."
              : "Ready to help"}
          </p>
        </div>
        {screenShareActive && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Screen sharing
          </span>
        )}
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {uiMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${
              msg.role === "user"
                ? "bg-saathi-forest text-white rounded-br-md"
                : "bg-saathi-mint/30 text-saathi-ink rounded-bl-md"
            }`}>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Screenshot"
                  className="mb-2 rounded-xl max-h-48 w-auto border border-white/20"
                />
              )}
              {msg.portalUrl && (
                <a
                  href={msg.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!screenShareActive) {
                      setTimeout(() => {
                        setPhase("online-guide");
                        phaseRef.current = "online-guide";
                        startScreenShare();
                      }, 2000);
                    }
                  }}
                  className="mb-2 flex items-center gap-2 rounded-xl bg-saathi-forest px-4 py-3 text-white text-sm font-semibold shadow-md hover:bg-saathi-ink transition"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Open Portal →
                </a>
              )}
              {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
              {msg.pdfDownload && (
                <a
                  href={`data:application/pdf;base64,${msg.pdfDownload.base64}`}
                  download={msg.pdfDownload.filename}
                  className="mb-2 flex items-center gap-3 rounded-xl bg-saathi-forest p-4 text-white shadow-md hover:bg-saathi-ink transition"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t("common.download", { defaultValue: "Download PDF" })}</p>
                    <p className="text-xs text-white/70">{msg.pdfDownload.filename}</p>
                  </div>
                </a>
              )}
              {msg.showUploadCard && (
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-saathi-forest/30 bg-white/60 p-4 transition hover:border-saathi-forest hover:bg-white">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-saathi-forest/10 text-saathi-forest">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-saathi-forest">
                      {t("common.upload", { defaultValue: "Upload" })}
                    </p>
                    <p className="text-xs text-saathi-ink/50">PDF, JPG, PNG</p>
                  </div>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <p className="mt-2 text-xs opacity-50">
                  {msg.toolsUsed.map(formatToolName).join(" · ")}
                </p>
              )}
            </div>
          </div>
        ))}
        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-saathi-forest/60 px-4 py-2.5 text-sm text-white animate-pulse">
              {interim}
            </div>
          </div>
        )}
        {uiState === "thinking" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-saathi-mint/30 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-saathi-forest/60" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-saathi-forest/60" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-saathi-forest/60" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick PDF download bar — shows whenever form fields exist (any stage) */}
      {filledFormFields && (phase === "offline-scan" || phase === "offline-fill" || phase === "offline-generate") && (
        <div className="border-t border-saathi-forest/20 bg-saathi-mint/20 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-saathi-forest">
              {t("scheme.formReady", { defaultValue: "Form ready" })}
            </p>
            <p className="text-xs text-saathi-ink/50">
              {Object.keys(filledFormFields).length} {t("scheme.fieldsFilled", { defaultValue: "fields filled" })}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                // Merge profile data with agent-filled fields for maximum coverage
                const mergedFields = { ...profileRef.current, ...filledFormFields };
                const res = await fetch("/api/agent/fill-pdf", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    formImage: uploadedFormImageRef.current || undefined,
                    filledFields: mergedFields,
                    title: "PM-KISAN Application — FormSaathi",
                  }),
                });
                if (!res.ok) throw new Error("Failed");
                const data = await res.json();
                downloadPdf(data.pdf, data.filename);
                msgCounter.current += 1;
                setUiMessages((prev) => [...prev, {
                  id: `msg-${msgCounter.current}`, role: "assistant", text: "",
                  pdfDownload: { base64: data.pdf, filename: data.filename }, timestamp: Date.now(),
                }]);
                setPhase("complete");
                phaseRef.current = "complete";
              } catch { setError("PDF generation failed"); }
            }}
            className="rounded-full bg-saathi-forest px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-saathi-ink transition"
          >
            {t("common.download", { defaultValue: "Download PDF" })} ↓
          </button>
        </div>
      )}

      {/* Camera overlay */}
      {cameraOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black">
          <video ref={videoRef} className="flex-1 object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex items-center justify-center gap-6 py-6">
            <button type="button" onClick={stopCamera} className="rounded-full bg-white/20 px-6 py-3 text-sm font-medium text-white">Cancel</button>
            <button type="button" onClick={capturePhoto} className="h-16 w-16 rounded-full border-4 border-white bg-white/30" />
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Screen share controls */}
      {screenShareActive && (
        <div className="flex items-center gap-2 border-t border-saathi-sand px-4 py-2 bg-amber-50">
          <button type="button" onClick={toggleAutoCapture} className={`rounded-full px-3 py-1 text-xs font-medium ${screenAutoCapture ? "bg-amber-200 text-amber-800" : "bg-gray-200 text-gray-700"}`}>
            {screenAutoCapture ? "Auto-capture ON" : "Auto-capture OFF"}
          </button>
          {!screenAutoCapture && (
            <button type="button" onClick={() => captureScreenFrame()} className="rounded-full bg-saathi-forest px-3 py-1 text-xs font-medium text-white">
              What should I do?
            </button>
          )}
          <button type="button" onClick={stopScreenShare} className="ml-auto rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            Stop sharing
          </button>
        </div>
      )}

      {/* Input bar — voice-first layout */}
      <div className="border-t border-saathi-sand px-4 pt-3 pb-4">
        {/* Main row: tools on sides, BIG mic button centered */}
        <div className="flex items-center justify-center gap-3">
          {/* Left tools — icon + label */}
          <div className="flex flex-col items-center gap-1">
            <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-saathi-sand/50 text-saathi-ink/50 hover:bg-saathi-sand transition">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
            </label>
            <span className="text-[11px] text-saathi-ink/60 font-medium">{t("common.upload", { defaultValue: "Upload" })}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={() => { setCameraPurpose("form_scan"); openCamera(); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-saathi-sand/50 text-saathi-ink/50 hover:bg-saathi-sand transition">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </button>
            <span className="text-[11px] text-saathi-ink/60 font-medium">{t("documents.capture", { defaultValue: "Scan" })}</span>
          </div>

          {/* CENTER: Big mic button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={toggleMic}
              disabled={uiState === "thinking" || !isSTTAvailable()}
              className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all ${
                uiState === "listening"
                  ? "animate-pulse bg-red-500 text-white shadow-red-500/40 scale-110"
                  : uiState === "speaking"
                    ? "bg-amber-400 text-white shadow-amber-400/30"
                    : "bg-saathi-forest text-white hover:bg-saathi-ink hover:scale-105 shadow-saathi-forest/30"
              } disabled:opacity-40`}
            >
              {uiState === "listening" ? (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" /></svg>
              ) : uiState === "speaking" ? (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
              ) : (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
              )}
            </button>
            <span className="text-[11px] text-saathi-ink/60 font-medium">{t("common.voice", { defaultValue: "Speak" })}</span>
          </div>

          {/* Right tools — icon + label */}
          <div className="flex flex-col items-center gap-1">
            {!screenShareActive ? (
              <button type="button" onClick={startScreenShare} className="flex h-10 w-10 items-center justify-center rounded-full bg-saathi-sand/50 text-saathi-ink/50 hover:bg-saathi-sand transition">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              </button>
            ) : (
              <button type="button" onClick={stopScreenShare} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              </button>
            )}
            <span className="text-[11px] text-saathi-ink/60 font-medium">
              {screenShareActive
                ? t("common.stop", { defaultValue: "Stop" })
                : t("common.screen", { defaultValue: "Screen" })}
            </span>
          </div>
        </div>

        {/* Mic hint / tooltip */}
        <p className={`mt-2 text-center text-xs transition-all ${
          uiState === "idle" && uiMessages.length > 1
            ? "text-saathi-forest font-medium animate-pulse"
            : "text-saathi-ink/50"
        }`}>
          {uiState === "listening"
            ? "Listening... tap to stop"
            : uiState === "thinking"
              ? "Processing..."
              : uiState === "speaking"
                ? "Speaking... tap to interrupt"
                : uiMessages.length > 1
                  ? "↑ Click mic to continue the conversation"
                  : "Tap the mic to start speaking"}
        </p>

        {/* Collapsed text input — tap to expand */}
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
            placeholder="or type here..."
            className="flex-1 rounded-full border border-transparent bg-saathi-sand/30 px-3 py-1.5 text-xs text-saathi-ink/50 outline-none transition focus:border-saathi-forest/40 focus:bg-white focus:text-saathi-ink focus:text-sm focus:py-2 focus:px-4"
            disabled={uiState === "thinking"}
          />
          {textInput.trim() && (
            <button type="button" onClick={handleTextSubmit} disabled={uiState === "thinking"} className="flex h-6 w-6 items-center justify-center rounded-full bg-saathi-forest text-white transition hover:bg-saathi-ink disabled:opacity-40">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
