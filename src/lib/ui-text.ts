/**
 * Thin wrappers over i18next for backwards-compat.
 * All translations now live in src/locales/*.json.
 * Components can import `useTranslation` from react-i18next directly
 * or keep using these helpers during migration.
 */

import i18n from "@/lib/i18n";
import type { IndianLanguageCode } from "@/lib/indian-languages";

function t(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(key, { lng: i18n.language, ...opts }) as string;
}

function tLang(lang: IndianLanguageCode, key: string, opts?: Record<string, unknown>): string {
  return i18n.t(key, { lng: lang, ...opts }) as string;
}

export function getUiText(_language: IndianLanguageCode, key: string): string {
  const KEY_MAP: Record<string, string> = {
    "Loading…": "common.loading",
    "Language": "nav.language",
    "Fingerprint": "nav.fingerprint",
    "Home": "nav.home",
    "Get Started": "common.getStarted",
    "Back to home": "nav.backToHome",
    "Change language": "nav.changeLanguage",
    "Dashboard": "nav.dashboard",
    "Documents": "nav.documents",
    "Find schemes": "nav.findSchemes",
    "Voice profile": "nav.voiceProfile",
    "Update answers": "nav.updateAnswers",
    "View all →": "dashboard.viewAll",
    "Recent applications": "dashboard.recentApplications",
    "Ref:": "dashboard.ref",
    "submitted": "status.submitted",
    "approved": "status.approved",
    "rejected": "status.rejected",
    "pending": "status.pending",
    "Profile completeness": "dashboard.profileCompleteness",
    "Eligible schemes": "dashboard.eligibleSchemes",
    "Read aloud": "eligibility.readAloud",
    "Stop": "common.stop",
    "No matching schemes found.": "eligibility.noMatching",
    "Complete your profile to see more →": "eligibility.completeProfile",
    "Apply now →": "eligibility.applyNow",
    "Missing info:": "eligibility.missingInfo",
    "Document Vault": "documents.documentVault",
    "Capture and store documents on your device. Encrypted, never sent to any server.": "documents.vaultDescription",
    "Capture": "documents.capture",
    "No documents captured yet.": "documents.noDocuments",
    "Use the camera button above to scan a document.": "documents.useCameraButton",
    "Delete": "common.delete",
    "Cancel": "common.cancel",
    "Low quality — hold steady": "documents.lowQuality",
    "Quality:": "documents.quality",
    "Good": "common.good",
    "OK": "common.ok",
    "Poor": "common.poor",
    "Save to vault": "documents.saveToVault",
    "Retake": "documents.retake",
    "Encrypting & saving…": "documents.encryptingAndSaving",
    "Optional · Aadhaar Scan": "aadhaar.optionalScan",
    "Scan your Aadhaar card": "aadhaar.scanCard",
    "Open camera": "aadhaar.openCamera",
    "Skip — enter details manually later →": "aadhaar.skipManual",
    "Scanning Aadhaar card…": "aadhaar.scanning",
    "Fill in or correct the details below, then continue.": "aadhaar.fillOrCorrect",
    "Save & continue": "aadhaar.saveAndContinue",
    "Rescan": "aadhaar.rescan",
    "Choose your language": "onboarding.chooseLanguage",
    "The app uses this language for screens and voice.": "onboarding.languageSubtitle",
    "Question": "onboarding.questionProgress",
    "Tap a choice, type, or use the microphone.": "onboarding.tapChoiceOrMic",
    "Next": "common.next",
    "Listening…": "onboarding.listening",
    "Hear again": "onboarding.hearAgain",
    "Previous": "common.previous",
    "Skip voice onboarding →": "onboarding.skipVoice",
    "Biometric lock": "auth.protectedDetails",
    "Unlock with biometrics": "auth.unlockToContinue",
    "Use your device's biometrics — such as your fingerprint — to open your saved profile and applications on this device.": "auth.unlockDescription",
    "Unlock with fingerprint": "auth.unlockWithDevice",
    "Waiting…": "auth.waiting",
    "Narrate form": "scheme.narrateForm",
    "Stop narration": "scheme.stopNarration",
    "Fill missing by voice": "scheme.fillMissing",
    "Please enter:": "scheme.pleaseEnter",
    "Done": "common.done",
    "Auto": "common.auto",
    "Voice": "common.voice",
    "Select…": "common.select",
    "Required documents": "scheme.requiredDocuments",
    "Upload": "common.upload",
    "Review & submit": "scheme.reviewAndSubmit",
    "Review your application": "scheme.reviewYourApplication",
    "Confirm & submit": "scheme.confirmAndSubmit",
    "Edit": "common.edit",
    "Submitted!": "scheme.submitted",
    "Reference number": "scheme.referenceNumber",
    "Saved to your Family Vault": "scheme.savedToVault",
    "More schemes": "scheme.moreSchemes",
    "Official portal": "scheme.officialPortal",
    "Back": "common.back",
    "Device may not have a natural voice for this language. Speech can sound incorrect here.": "voice.speechNotSupported",
    "Try text input or another browser/device with this language installed.": "voice.voiceRecognitionFailed",
    "Step 2 of 3": "onboarding.step2of3",
    "Next in onboarding: WebAuthn fingerprint on this device (optional skip), then your FormSaathi home.": "onboarding.nextOnboarding",
    "Point the camera at your Aadhaar card. One photo is sent to a vision API (OpenRouter) to read visible text. You can edit every field before saving; saved data stays only in your encrypted on-device vault.": "aadhaar.cameraDesc",
    "Capture & vault": "aadhaar.captureAndVault",
    "Processing…": "common.processing",
    "Could not recognise speech. Please try again.": "voice.couldNotRecognise",
  };

  const i18nKey = KEY_MAP[key];
  if (i18nKey) return tLang(_language, i18nKey);
  return key;
}

export function getStatusLabel(language: IndianLanguageCode, status: string): string {
  return tLang(language, `status.${status}`);
}

export function getCategoryLabel(language: IndianLanguageCode, value: string): string {
  const result = tLang(language, `category.${value}`);
  return result === `category.${value}` ? value : result;
}

export function getBenefitLabel(language: IndianLanguageCode, value: string): string {
  const result = tLang(language, `benefit.${value}`);
  return result === `benefit.${value}` ? value : result;
}

export function getFieldLabel(language: IndianLanguageCode, label: string): string {
  const result = tLang(language, `field.${label}`);
  return result === `field.${label}` ? label : result;
}

export function getStepText(language: IndianLanguageCode, step: number, total: number): string {
  return tLang(language, "onboarding.stepOf", { step, total });
}

export function getQuestionProgressText(language: IndianLanguageCode, current: number, total: number): string {
  return tLang(language, "onboarding.questionProgress", { current, total });
}

export function getWelcomeText(language: IndianLanguageCode, name: string): string {
  return tLang(language, "dashboard.welcome", { name });
}

export function getDashboardSummaryText(language: IndianLanguageCode, count: number): string {
  if (count === 0) return tLang(language, "dashboard.summaryZero");
  return tLang(language, "dashboard.summary", { count });
}

export function getMatchesCountText(language: IndianLanguageCode, count: number): string {
  return tLang(language, "dashboard.matchesCount", { count });
}

export function getEligibilityHeaderText(language: IndianLanguageCode, count: number, totalBenefit: string): string {
  return tLang(language, "eligibility.headerText", { count, total: totalBenefit });
}

export function getAutoFilledBannerText(language: IndianLanguageCode, autoFilled: number, total: number): string {
  return tLang(language, "scheme.autoFilled", { filled: autoFilled, total });
}

export function getFillMissingByVoiceText(language: IndianLanguageCode, count: number): string {
  return tLang(language, "scheme.fillMissingCount", { count });
}

export function getDocumentMetaText(_language: IndianLanguageCode, date: string, quality: number): string {
  return `${date} · ${t("documents.quality")} ${quality}%`;
}

export function getSchemeSubmittedText(language: IndianLanguageCode, schemeName: string): string {
  return tLang(language, "scheme.schemeSubmitted", { name: schemeName });
}

export function getSubmittingText(language: IndianLanguageCode, schemeName: string): string {
  return tLang(language, "scheme.submitting", { name: schemeName });
}

export function getDocTypeLabel(language: IndianLanguageCode, value: string): string {
  const result = tLang(language, `docType.${value}`);
  return result === `docType.${value}` ? value : result;
}

export function getMatchLabel(language: IndianLanguageCode): string {
  return tLang(language, "dashboard.matchLabel");
}
