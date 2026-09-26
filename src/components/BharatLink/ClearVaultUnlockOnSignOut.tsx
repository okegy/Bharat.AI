"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { clearVaultSessionUnlock } from "@/lib/biometric-storage";
import {
  STORAGE_LANGUAGE_CODE,
  STORAGE_ONBOARDING_COMPLETE,
  SESSION_LANGUAGE_REPICK,
} from "@/lib/language-storage";
import {
  STORAGE_PASSKEY_REGISTERED,
  STORAGE_PASSKEY_SKIPPED,
  SESSION_BIOMETRIC_SETUP_INTENT,
} from "@/lib/biometric-storage";

/**
 * Clears all session and onboarding state on sign-out so the next
 * sign-in gets a fresh onboarding flow.
 */
function clearAllSessionState(): void {
  if (typeof window === "undefined") return;

  // Vault session
  clearVaultSessionUnlock();

  // Language + onboarding
  localStorage.removeItem(STORAGE_LANGUAGE_CODE);
  localStorage.removeItem(STORAGE_ONBOARDING_COMPLETE);
  sessionStorage.removeItem(SESSION_LANGUAGE_REPICK);

  // Biometric flags
  localStorage.removeItem(STORAGE_PASSKEY_REGISTERED);
  localStorage.removeItem(STORAGE_PASSKEY_SKIPPED);
  sessionStorage.removeItem(SESSION_BIOMETRIC_SETUP_INTENT);
}

/**
 * Resets onboarding + vault session when the user signs out so the next
 * sign-in starts fresh from language selection.
 */
export function ClearVaultUnlockOnSignOut() {
  const { isSignedIn, isLoaded } = useAuth();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      wasSignedIn.current = true;
      return;
    }
    if (wasSignedIn.current) {
      clearAllSessionState();
      wasSignedIn.current = false;
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
