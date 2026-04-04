/**
 * Browser helpers for OpenRouter-backed STT, TTS, and translation.
 * API keys stay on the server; these call /api/openrouter/* routes.
 */

import type { IndianLanguageCode } from "@/lib/indian-languages";
import { getVoiceLangCode } from "@/lib/openrouter-config";

export interface OpenRouterTTSResult {
  /** base64-encoded audio */
  audio: string;
  /** MIME type for data URL playback */
  mime: string;
}

export async function openrouterTTS(
  text: string,
  lang: IndianLanguageCode | string,
  opts?: { speaker?: string; pace?: number },
): Promise<OpenRouterTTSResult> {
  const languageCode =
    typeof lang === "string" && lang.includes("-")
      ? lang
      : getVoiceLangCode(lang as IndianLanguageCode);

  const res = await fetch("/api/openrouter/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      languageCode,
      speaker: opts?.speaker,
      pace: opts?.pace,
    }),
  });

  if (!res.ok) throw new Error(`TTS error ${res.status}`);
  const data = await res.json();
  const fmt =
    typeof data.format === "string" ? data.format.toLowerCase() : "wav";
  const mime =
    fmt === "mp3"
      ? "audio/mpeg"
      : fmt === "wav"
        ? "audio/wav"
        : `audio/${fmt}`;
  return { audio: data.audios?.[0] ?? "", mime };
}

export interface OpenRouterSTTResult {
  transcript: string;
  languageCode: string;
}

export async function openrouterSTT(
  audioBlob: Blob,
  lang?: IndianLanguageCode | string,
  mode: string = "transcribe",
): Promise<OpenRouterSTTResult> {
  const languageCode = lang
    ? typeof lang === "string" && lang.includes("-")
      ? lang
      : getVoiceLangCode(lang as IndianLanguageCode)
    : "";

  const isWav = audioBlob.type === "audio/wav" || audioBlob.type === "audio/wave";
  const ext = isWav ? "wav" : "webm";

  const fd = new FormData();
  fd.append("audio", audioBlob, `recording.${ext}`);
  if (languageCode) fd.append("languageCode", languageCode);
  fd.append("mode", mode);

  const res = await fetch("/api/openrouter/stt", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error(`STT error ${res.status}`);
  const data = await res.json();
  return {
    transcript: data.transcript ?? "",
    languageCode: data.language_code ?? languageCode,
  };
}

export async function openrouterTranslate(
  input: string,
  targetLang: IndianLanguageCode | string,
  sourceLang?: string,
): Promise<string> {
  const targetLanguageCode =
    typeof targetLang === "string" && targetLang.includes("-")
      ? targetLang
      : getVoiceLangCode(targetLang as IndianLanguageCode);

  const res = await fetch("/api/openrouter/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      sourceLanguageCode: sourceLang ?? "en-IN",
      targetLanguageCode,
    }),
  });

  if (!res.ok) throw new Error(`Translate error ${res.status}`);
  const data = await res.json();
  return data.translated_text ?? input;
}

export async function fetchUserLanguage(): Promise<string | null> {
  try {
    const res = await fetch("/api/user/language");
    if (!res.ok) return null;
    const data = await res.json();
    return data.language ?? null;
  } catch {
    return null;
  }
}

export async function saveUserLanguage(language: string): Promise<void> {
  await fetch("/api/user/language", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  }).catch(() => {});
}
