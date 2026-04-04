"use client";

import { BiometricSetupNavLink } from "@/components/formsaathi/BiometricSetupNavLink";
import { isWebAuthnAvailable } from "@/lib/biometric-storage";
import "@/lib/i18n";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Renders the "Set up fingerprint" link only when the device/browser
 * supports WebAuthn. Avoids showing a dead-end link on unsupported devices.
 */
export function OnboardingBiometricLink() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isWebAuthnAvailable());
  }, []);

  if (!show) return null;

  return (
    <BiometricSetupNavLink className="text-sm font-medium text-saathi-forest underline-offset-4 hover:underline">
      {t("auth.setupFingerprint")}
    </BiometricSetupNavLink>
  );
}
