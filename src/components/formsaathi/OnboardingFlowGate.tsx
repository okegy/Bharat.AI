"use client";

import {
  hasPlatformBiometric,
  isBiometricOnboardingComplete,
  isWebAuthnAvailable,
  markPasskeySkipped,
} from "@/lib/biometric-storage";
import "@/lib/i18n";
import { isLanguageOnboardingComplete, isOnboardingComplete } from "@/lib/language-storage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Flow: `/onboarding` → language → biometric → aadhaar → voice → dashboard.
 *
 * On devices without WebAuthn or without a platform biometric sensor the
 * biometric step is auto-skipped so the user is never shown a confusing
 * "Set up biometric" screen they cannot complete.
 *
 * Once all gates pass, the user is sent straight to `/onboarding/voice`.
 */
export function OnboardingFlowGate({
}: {
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Already completed onboarding — go straight to assistant
    if (isOnboardingComplete()) {
      router.replace("/assistant");
      return;
    }

    if (!isLanguageOnboardingComplete()) {
      router.replace("/onboarding/language");
      return;
    }

    async function resolveBiometric() {
      try {
        if (isBiometricOnboardingComplete()) {
          router.replace("/onboarding/aadhaar");
          return;
        }

        const webauthn = isWebAuthnAvailable();
        let platform = false;
        if (webauthn) {
          // Race against a timeout — some browsers hang on this call
          platform = await Promise.race([
            hasPlatformBiometric(),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
          ]);
        }

        if (!webauthn || !platform) {
          markPasskeySkipped();
          router.replace("/onboarding/aadhaar");
        } else {
          router.replace("/onboarding/biometric");
        }
      } catch {
        // If anything fails, skip biometric and move on
        markPasskeySkipped();
        router.replace("/onboarding/aadhaar");
      }
    }

    resolveBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable navigation; avoid effect loops
  }, []);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg items-center justify-center px-6 pt-28 text-center text-sm text-saathi-ink/60">
      {t("auth.continuingOnboarding")}
    </div>
  );
}
