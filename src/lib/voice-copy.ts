/**
 * Voice narration strings — now backed by i18next.
 * All translations live in src/locales/*.json under the "voice" and
 * "onboardingQuestion" namespaces.
 */

import i18n from "@/lib/i18n";
import type { IndianLanguageCode } from "@/lib/indian-languages";

export type VoiceOnboardingQuestionId =
  | "fullName"
  | "gender"
  | "state"
  | "occupation"
  | "annualIncome"
  | "category";

function tLang(lang: IndianLanguageCode, key: string, opts?: Record<string, unknown>): string {
  return i18n.t(key, { lng: lang, ...opts }) as string;
}

export function getOnboardingQuestionText(
  code: IndianLanguageCode,
  id: VoiceOnboardingQuestionId,
): string {
  return tLang(code, `onboardingQuestion.${id}`);
}

export function getSchemeVoiceName(
  code: IndianLanguageCode,
  name: string,
  nameHi: string,
): string {
  if (code === "hi") return nameHi;
  return name;
}

export function getEligibilityAnnounceText(
  code: IndianLanguageCode,
  count: number,
  topSchemeNames: string[],
  totalBenefitFormatted: string,
): string {
  return tLang(code, "voice.eligibilityAnnounce", {
    count,
    names: topSchemeNames.join(", "),
    total: totalBenefitFormatted,
  });
}

export function getSchemeFormNarrationIntro(
  code: IndianLanguageCode,
  schemeName: string,
): string {
  return tLang(code, "voice.formNarrationIntro", { scheme: schemeName });
}

export function getSchemeFormNotFilledYet(code: IndianLanguageCode): string {
  return tLang(code, "voice.notFilledYet");
}

export function getSchemeAskField(code: IndianLanguageCode, fieldLabel: string): string {
  return tLang(code, "voice.askField", { field: fieldLabel });
}

export function getSchemeReviewPrompt(
  code: IndianLanguageCode,
  linesJoined: string,
): string {
  return tLang(code, "voice.reviewPrompt", { lines: linesJoined });
}

export function getSchemeReviewBlank(code: IndianLanguageCode): string {
  return tLang(code, "voice.reviewBlank");
}

export function getSchemeSubmitSuccess(code: IndianLanguageCode, ref: string): string {
  return tLang(code, "voice.submitSuccess", { ref });
}
