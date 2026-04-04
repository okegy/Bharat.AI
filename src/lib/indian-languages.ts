/** Thirteen UI languages including English (FormSaathi product list). */

export const INDIAN_LANGUAGES = [
  { code: "en", script: "English", label: "English" },
  { code: "hi", script: "हिन्दी", label: "Hindi" },
  { code: "bn", script: "বাংলা", label: "Bangla" },
  { code: "te", script: "తెలుగు", label: "Telugu" },
  { code: "mr", script: "मराठी", label: "Marathi" },
  { code: "ta", script: "தமிழ்", label: "Tamil" },
  { code: "gu", script: "ગુજરાતી", label: "Gujarati" },
  { code: "kn", script: "ಕನ್ನಡ", label: "Kannada" },
  { code: "ml", script: "മലയാളം", label: "Malayalam" },
  { code: "pa", script: "ਪੰਜਾਬੀ", label: "Punjabi" },
  { code: "or", script: "ଓଡ଼ିଆ", label: "Odia" },
  { code: "as", script: "অসমীয়া", label: "Assamese" },
  { code: "ur", script: "اردو", label: "Urdu" },
] as const;

export type IndianLanguageCode = (typeof INDIAN_LANGUAGES)[number]["code"];

export function isValidLanguageCode(
  code: string | null,
): code is IndianLanguageCode {
  if (!code) return false;
  return INDIAN_LANGUAGES.some((l) => l.code === code);
}

export function getLanguageByCode(code: string) {
  return INDIAN_LANGUAGES.find((l) => l.code === code);
}
