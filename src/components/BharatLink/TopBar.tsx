"use client";

import { BiometricSetupNavLink } from "@/components/BharatLink/BiometricSetupNavLink";
import { CursorToggle } from "@/components/BharatLink/CursorToggle";
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
    <header className="fixed inset-x-0 top-0 z-50 glass-nav">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-bharatlink-navy flex items-center gap-2"
        >
          <span className="h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_10px_#ea580c] animate-pulse" />
          <span>BharatLink</span>
        </Link>
        <div className="flex items-center gap-3">
          <CursorToggle />
          <LanguagePickerNavLink className="text-sm font-semibold text-bharatlink-navy/80 underline-offset-4 transition hover:text-orange-600 hover:underline">
            {getUiText(language, "Language")}
          </LanguagePickerNavLink>
          {showBiometric ? (
            <BiometricSetupNavLink className="text-sm font-semibold text-bharatlink-navy/80 underline-offset-4 transition hover:text-orange-600 hover:underline">
              {getUiText(language, "Fingerprint")}
            </BiometricSetupNavLink>
          ) : null}
          {isLoaded && isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 ring-2 ring-orange-500/40 shadow-sm",
                },
              }}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
