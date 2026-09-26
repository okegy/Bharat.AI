"use client";

import { BiometricSetupNavLink } from "@/components/BharatLink/BiometricSetupNavLink";
import { LanguagePickerNavLink } from "@/components/BharatLink/LanguagePickerNavLink";
import { useAppLanguage } from "@/lib/app-language";
import { isWebAuthnAvailable } from "@/lib/biometric-storage";
import { getUiText } from "@/lib/ui-text";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

export function TopBar() {
  const { isSignedIn, isLoaded } = useUser();
  const { language } = useAppLanguage();
  const [showBiometric, setShowBiometric] = useState(false);

  useEffect(() => {
    setShowBiometric(isWebAuthnAvailable());
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-bharatlink-sand/80 bg-bharatlink-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-bharatlink-navy"
        >
          BharatLink
        </Link>
        <div className="flex items-center gap-4">
          <LanguagePickerNavLink className="text-sm font-medium text-bharatlink-navy/80 underline-offset-4 transition hover:text-bharatlink-tealDark hover:underline">
            {getUiText(language, "Language")}
          </LanguagePickerNavLink>
          {showBiometric ? (
            <BiometricSetupNavLink className="text-sm font-medium text-bharatlink-navy/80 underline-offset-4 transition hover:text-bharatlink-tealDark hover:underline">
              {getUiText(language, "Fingerprint")}
            </BiometricSetupNavLink>
          ) : null}
          {isLoaded && isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 ring-2 ring-bharatlink-tealLight/60",
                },
              }}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
