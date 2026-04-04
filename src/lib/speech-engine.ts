/**
 * Voice I/O engine — OpenRouter audio models (primary) with Web Speech API fallback.
 *
 * TTS: OpenRouter streaming audio → base64 → HTMLAudioElement.
 * STT: MediaRecorder → WAV → OpenRouter input_audio → transcript.
 *
 * If OpenRouter fails (network, provider), falls back to browser
 * speechSynthesis / SpeechRecognition.
 */

import type { IndianLanguageCode } from "@/lib/indian-languages";
import {
  getVoiceLangCode,
  getVoiceLangCodeFromBcp47,
} from "@/lib/openrouter-config";
import { openrouterSTT, openrouterTTS } from "@/lib/openrouter-client";
import i18n from "@/lib/i18n";

// ─── Language helpers ─────────────────────────────────

const LANG_BCP47: Record<IndianLanguageCode, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  te: "te-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
  ur: "ur-IN",
};

export function getBcp47(code: IndianLanguageCode): string {
  return LANG_BCP47[code] ?? "en-IN";
}

function resolveBcp47(lang: IndianLanguageCode | string): string {
  return typeof lang === "string" && lang.includes("-")
    ? lang
    : getBcp47(lang as IndianLanguageCode);
}

function resolveVoiceLangCode(lang: IndianLanguageCode | string): string {
  if (typeof lang === "string" && lang.includes("-")) {
    return getVoiceLangCodeFromBcp47(lang);
  }
  return getVoiceLangCode(lang as IndianLanguageCode);
}

// ─── WAV encoding (reliable STT input) ─────────────────

function encodeWavFromFloat32(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const v = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  v.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  v.setUint16(32, numChannels * bytesPerSample, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, dataLength, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buffer;
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const AudioCtx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: 16000 });
  try {
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    const target = 16000;
    const offline = new OfflineAudioContext(1, decoded.duration * target, target);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    const pcm = rendered.getChannelData(0);
    const wavBuf = encodeWavFromFloat32(pcm, target);
    return new Blob([wavBuf], { type: "audio/wav" });
  } finally {
    ctx.close();
  }
}

// ─── TTS (OpenRouter → browser fallback) ─────────────

let currentAudio: HTMLAudioElement | null = null;
/** Incremented on every speak() call — stale async TTS calls check this to avoid overlapping playback. */
let speakGeneration = 0;

export function isTTSAvailable(): boolean {
  return typeof window !== "undefined";
}

export function stopSpeaking(): void {
  speakGeneration += 1; // invalidate any in-flight TTS calls
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return speechSynthesis.speaking;
  }
  return false;
}

export type TTSVoiceMatchLevel = "exact" | "language" | "none";

export function ensureTTSVoicesLoaded(): Promise<void> {
  return Promise.resolve();
}

export function getTTSVoiceSupport(
  _lang: IndianLanguageCode | string = "en",
): {
  bcp47: string;
  matchLevel: TTSVoiceMatchLevel;
} {
  const bcp47 = resolveBcp47(_lang);
  return { bcp47, matchLevel: "exact" };
}

export function speak(
  text: string,
  lang: IndianLanguageCode | string = "en",
  opts?: { rate?: number; onEnd?: () => void },
): void {
  if (!text || typeof window === "undefined") return;
  stopSpeaking();

  const voiceCode = resolveVoiceLangCode(lang);
  const bcp = resolveBcp47(lang);
  const myGeneration = speakGeneration; // capture current generation

  // OpenRouter TTS (openai/gpt-audio) as primary — high quality multilingual.
  // Falls back to browser speechSynthesis if API fails.
  void (async () => {
    try {
      const result = await openrouterTTS(text, voiceCode, {
        pace: opts?.rate,
      });

      // If a newer speak() call happened while we were waiting, abort
      if (speakGeneration !== myGeneration) return;

      if (!result.audio) throw new Error("empty audio");

      const audioSrc = `data:${result.mime};base64,${result.audio}`;
      const audio = new Audio(audioSrc);
      currentAudio = audio;
      audio.playbackRate = 1;

      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        opts?.onEnd?.();
      };
      audio.onerror = () => {
        if (currentAudio === audio) currentAudio = null;
        if (speakGeneration !== myGeneration) return;
        browserSpeak(text, bcp, opts);
      };

      await audio.play();
    } catch {
      if (speakGeneration !== myGeneration) return;
      browserSpeak(text, bcp, opts);
    }
  })();
}

function browserSpeak(
  text: string,
  bcp: string,
  opts?: { rate?: number; onEnd?: () => void },
): void {
  if (!("speechSynthesis" in window)) {
    opts?.onEnd?.();
    return;
  }

  const run = () => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = bcp;
    utt.rate = opts?.rate ?? 0.95;
    utt.pitch = 1;

    const voices = speechSynthesis.getVoices();
    const norm = (s: string) => s.replace(/_/g, "-").toLowerCase();
    const bcpLo = norm(bcp);
    const base = bcpLo.split("-")[0] ?? bcpLo;
    const voice =
      voices.find((v) => norm(v.lang) === bcpLo) ??
      voices.find((v) => norm(v.lang).startsWith(`${base}-`));
    if (voice) utt.voice = voice;

    utt.onend = () => opts?.onEnd?.();
    utt.onerror = () => opts?.onEnd?.();

    // Defer to next tick so cancel() from stopSpeaking() settles first
    setTimeout(() => speechSynthesis.speak(utt), 50);
  };

  if (speechSynthesis.getVoices().length > 0) {
    run();
  } else {
    let started = false;
    const once = () => {
      if (started) return;
      started = true;
      speechSynthesis.removeEventListener("voiceschanged", once);
      clearTimeout(fb);
      run();
    };
    speechSynthesis.addEventListener("voiceschanged", once);
    const fb = setTimeout(once, 600);
  }
}

// ─── STT (MediaRecorder → WAV → OpenRouter → browser fallback) ──

export function isSTTAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator.mediaDevices?.getUserMedia === "function") return true;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export interface ListenResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface ListenOptions {
  lang?: IndianLanguageCode | string;
  continuous?: boolean;
  onInterim?: (text: string) => void;
  onResult?: (result: ListenResult) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  timeoutMs?: number;
}

export interface ListenHandle {
  /** Stop recording and send to OpenRouter for transcription. */
  stop: () => void;
  /** Discard recording without transcribing. */
  abort: () => void;
}

export function listen(options: ListenOptions = {}): ListenHandle | null {
  if (typeof window === "undefined") return null;

  const lang = options.lang ?? "en";
  const voiceCode = resolveVoiceLangCode(lang);

  if (typeof navigator.mediaDevices?.getUserMedia === "function") {
    return listenViaOpenRouter(options, voiceCode);
  }

  return listenViaBrowser(options, resolveBcp47(lang));
}

function listenViaOpenRouter(
  options: ListenOptions,
  voiceCode: string,
): ListenHandle | null {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let aborted = false;
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let streamRef: MediaStream | null = null;

  const cleanup = () => {
    if (timeout) clearTimeout(timeout);
    streamRef?.getTracks().forEach((t) => t.stop());
    streamRef = null;
  };

  const processAudio = async (chunks: Blob[]) => {
    if (chunks.length === 0) {
      options.onError?.(i18n.t("voice.noAudioRecorded") as string);
      options.onEnd?.();
      return;
    }

    options.onInterim?.(i18n.t("common.processing") as string);

    const rawBlob = new Blob(chunks, { type: "audio/webm" });
    try {
      let audioBlob: Blob;
      try {
        audioBlob = await blobToWav(rawBlob);
      } catch {
        audioBlob = rawBlob;
      }
      const result = await openrouterSTT(audioBlob, voiceCode);
      if (!aborted && result.transcript) {
        options.onResult?.({
          transcript: result.transcript.trim(),
          confidence: 0.9,
          isFinal: true,
        });
      } else if (!aborted) {
        options.onError?.(i18n.t("voice.couldNotRecognise") as string);
      }
    } catch (err) {
      if (!aborted) {
        console.error("[speech-engine] STT failed", err);
        options.onError?.(i18n.t("voice.voiceRecognitionFailed") as string);
      }
    }
    options.onEnd?.();
  };

  navigator.mediaDevices
    .getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
    .then((stream) => {
      if (aborted || stopped) {
        stream.getTracks().forEach((t) => t.stop());
        if (!aborted) void processAudio([]);
        else options.onEnd?.();
        return;
      }

      streamRef = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        cleanup();
        if (aborted) {
          options.onEnd?.();
          return;
        }
        void processAudio(audioChunks);
      };

      mediaRecorder.start(250);

      if (options.timeoutMs) {
        timeout = setTimeout(() => {
          if (mediaRecorder?.state === "recording") {
            stopped = true;
            mediaRecorder.stop();
          }
        }, options.timeoutMs);
      }
    })
    .catch((err) => {
      options.onError?.(err.message ?? (i18n.t("voice.microphoneDenied") as string));
      options.onEnd?.();
    });

  return {
    stop: () => {
      if (stopped || aborted) return;
      stopped = true;
      if (timeout) clearTimeout(timeout);
      if (mediaRecorder?.state === "recording") {
        mediaRecorder.stop();
      }
    },
    abort: () => {
      if (aborted) return;
      aborted = true;
      if (timeout) clearTimeout(timeout);
      if (mediaRecorder?.state === "recording") {
        mediaRecorder.stop();
      } else {
        cleanup();
        options.onEnd?.();
      }
    },
  };
}

// ─── Browser SpeechRecognition fallback ───────────────

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface RecognizerResultEvent {
  readonly results: ArrayLike<SpeechRecognitionResultLike | undefined>;
}

interface RecognizerErrorEvent {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: RecognizerResultEvent) => void) | null;
  onerror: ((ev: RecognizerErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function listenViaBrowser(
  options: ListenOptions,
  bcp: string,
): ListenHandle | null {
  const Cls = getRecognitionClass();
  if (!Cls) {
    options.onError?.(i18n.t("voice.speechNotSupported") as string);
    return null;
  }

  const recognition = new Cls();
  recognition.lang = bcp;
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;

  let timeout: ReturnType<typeof setTimeout> | null = null;

  recognition.onresult = (event: RecognizerResultEvent) => {
    const list = event.results;
    const chunk = list[list.length - 1];
    if (!chunk) return;

    let best: SpeechRecognitionAlternativeLike | null = null;
    let bestScore = -1;
    for (let i = 0; i < chunk.length; i++) {
      const a = chunk[i];
      if (!a) continue;
      const conf = a.confidence ?? 0;
      const len = a.transcript.trim().length;
      const score = conf > 0 ? conf + len * 0.001 : len;
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (!best) return;

    if (chunk.isFinal) {
      options.onResult?.({
        transcript: best.transcript.trim(),
        confidence: best.confidence ?? 0,
        isFinal: true,
      });
    } else {
      options.onInterim?.(best.transcript);
    }
  };

  recognition.onerror = (event: RecognizerErrorEvent) => {
    if (event.error === "no-speech" || event.error === "aborted") return;
    options.onError?.(event.error);
  };

  recognition.onend = () => {
    if (timeout) clearTimeout(timeout);
    options.onEnd?.();
  };

  recognition.start();

  if (options.timeoutMs) {
    timeout = setTimeout(() => recognition.stop(), options.timeoutMs);
  }

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}
