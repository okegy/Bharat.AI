import type { IndianLanguageCode } from "@/lib/indian-languages";

/** OpenAI-compatible chat completions endpoint. */
export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/**
 * BCP-47 codes used for voice + translation prompts.
 * Odia uses `od-IN` on provider side where applicable.
 */
export const VOICE_LANG: Record<IndianLanguageCode, string> = {
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
  or: "od-IN",
  as: "as-IN",
  ur: "ur-IN",
};

export function getVoiceLangCode(code: IndianLanguageCode): string {
  return VOICE_LANG[code] ?? "en-IN";
}

export function getVoiceLangCodeFromBcp47(bcp: string): string {
  if (bcp === "or-IN") return "od-IN";
  return bcp;
}

/** English display name for translation / TTS instructions */
export const VOICE_LANG_LABEL: Record<string, string> = {
  "en-IN": "Indian English",
  "hi-IN": "Hindi",
  "bn-IN": "Bengali",
  "te-IN": "Telugu",
  "mr-IN": "Marathi",
  "ta-IN": "Tamil",
  "gu-IN": "Gujarati",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "pa-IN": "Punjabi",
  "od-IN": "Odia",
  "as-IN": "Assamese",
  "ur-IN": "Urdu",
};

export function getVoiceLangLabel(code: string): string {
  return VOICE_LANG_LABEL[code] ?? code;
}

/**
 * Default vision model; override with OPENROUTER_VISION_MODEL.
 * @see https://openrouter.ai/models (filter: vision)
 */
export const DEFAULT_OPENROUTER_VISION_MODEL = "openai/gpt-4o-mini";

export function getOpenRouterVisionModel(): string {
  return (
    process.env.OPENROUTER_VISION_MODEL ?? DEFAULT_OPENROUTER_VISION_MODEL
  );
}

/** @see https://openrouter.ai/models (input_modalities: audio) */
export const DEFAULT_OPENROUTER_STT_MODEL = "google/gemini-2.5-flash";

export function getOpenRouterSttModel(): string {
  return process.env.OPENROUTER_STT_MODEL ?? DEFAULT_OPENROUTER_STT_MODEL;
}

/** @see https://openrouter.ai/models (output_modalities: audio) */
export const DEFAULT_OPENROUTER_TTS_MODEL = "openai/gpt-audio";

export function getOpenRouterTtsModel(): string {
  return process.env.OPENROUTER_TTS_MODEL ?? DEFAULT_OPENROUTER_TTS_MODEL;
}

export const DEFAULT_OPENROUTER_TRANSLATE_MODEL = "openai/gpt-4o-mini";

export function getOpenRouterTranslateModel(): string {
  return (
    process.env.OPENROUTER_TRANSLATE_MODEL ??
    DEFAULT_OPENROUTER_TRANSLATE_MODEL
  );
}

export function getOpenRouterTtsVoice(): string {
  return process.env.OPENROUTER_TTS_VOICE ?? "alloy";
}

export function getOpenRouterAudioOutputFormat(): string {
  return process.env.OPENROUTER_TTS_FORMAT ?? "wav";
}

/** Agent brain model — handles tool calling, vision, multilingual reasoning. */
export const DEFAULT_OPENROUTER_AGENT_MODEL = "google/gemini-2.5-flash";

export function getOpenRouterAgentModel(): string {
  return process.env.OPENROUTER_AGENT_MODEL ?? DEFAULT_OPENROUTER_AGENT_MODEL;
}
