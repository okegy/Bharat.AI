import {
  type IndianLanguageCode,
  isValidLanguageCode,
} from "@/lib/indian-languages";
import { fetchUserLanguage, saveUserLanguage } from "@/lib/openrouter-client";

export const STORAGE_LANGUAGE_CODE = "formsaathi_language_code";

/** Set before navigating to `/onboarding/language` to re-pick (skip auto-redirect). */
export const SESSION_LANGUAGE_REPICK = "formsaathi_language_repick";

function dispatchLanguageChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("formsaathi:languagechange"));
}

/** Call before `router.push("/onboarding/language")` so the picker stays open if a language is already saved. */
export function markLanguagePickerRepick(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_LANGUAGE_REPICK, "1");
}

export function getSelectedLanguageCode(): IndianLanguageCode | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_LANGUAGE_CODE);
  return isValidLanguageCode(raw) ? raw : null;
}

export function setSelectedLanguageCode(code: IndianLanguageCode): void {
  localStorage.setItem(STORAGE_LANGUAGE_CODE, code);
  dispatchLanguageChange();
}

export function isLanguageOnboardingComplete(): boolean {
  return getSelectedLanguageCode() !== null;
}

// ─── Full onboarding completion ─────────────────────────

const STORAGE_ONBOARDING_COMPLETE = "formsaathi_onboarding_complete";

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ONBOARDING_COMPLETE, "1");
}

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_ONBOARDING_COMPLETE) === "1";
}

export { STORAGE_ONBOARDING_COMPLETE };

/**
 * Save the user's preferred language both locally and to their Clerk account.
 * The server write is fire-and-forget so the UI stays snappy.
 */
export function setLanguageWithServerSync(code: IndianLanguageCode): void {
  setSelectedLanguageCode(code);
  void saveUserLanguage(code);
}

/**
 * On sign-in, fetch the preferred language from the user's Clerk account
 * and apply it locally (if not already set). Returns the resolved language.
 */
export async function syncLanguageFromServer(): Promise<IndianLanguageCode | null> {
  const local = getSelectedLanguageCode();
  try {
    const server = await fetchUserLanguage();
    if (server && isValidLanguageCode(server)) {
      if (!local || local !== server) {
        setSelectedLanguageCode(server);
      }
      return server;
    }
  } catch { /* network error — ignore */ }
  return local;
}
