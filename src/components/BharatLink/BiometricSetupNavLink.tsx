"use client";

import { markBiometricSetupIntent } from "@/lib/biometric-storage";
import Link from "next/link";

type BiometricSetupNavLinkProps = {
  href?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Opens WebAuthn biometric setup. Sets a session flag so users who already
 * skipped or finished onboarding are not bounced off `/onboarding/biometric`.
 */
export function BiometricSetupNavLink({
  href = "/onboarding/biometric",
  className,
  children,
}: BiometricSetupNavLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => markBiometricSetupIntent()}
    >
      {children}
    </Link>
  );
}
