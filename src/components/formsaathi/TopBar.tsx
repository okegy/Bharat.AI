"use client";

import { BiometricSetupNavLink } from "@/components/formsaathi/BiometricSetupNavLink";
import { LanguagePickerNavLink } from "@/components/formsaathi/LanguagePickerNavLink";
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-saathi-sand/80 bg-saathi-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-saathi-ink"
        >
          FormSaathi
        </Link>
        <div className="flex items-center gap-4">
          {isLoaded && isSignedIn ? (
            <>
              <LanguagePickerNavLink className="text-sm font-medium text-saathi-ink/80 underline-offset-4 transition hover:text-saathi-forest hover:underline">
                {getUiText(language, "Language")}
              </LanguagePickerNavLink>
              {showBiometric ? (
                <BiometricSetupNavLink className="text-sm font-medium text-saathi-ink/80 underline-offset-4 transition hover:text-saathi-forest hover:underline">
                  {getUiText(language, "Fingerprint")}
                </BiometricSetupNavLink>
              ) : null}
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 ring-2 ring-saathi-mint/60",
                  },
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
