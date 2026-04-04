import type { Metadata } from "next";
import { ClearVaultUnlockOnSignOut } from "@/components/formsaathi/ClearVaultUnlockOnSignOut";
import { LanguageProvider } from "@/lib/app-language";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FormSaathi — Government forms, in your language",
  description:
    "Speak your need. FormSaathi checks schemes, fills portals, and walks you through documents—voice-first, in Indian languages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInForceRedirectUrl="/onboarding"
      signUpForceRedirectUrl="/onboarding"
      signInFallbackRedirectUrl="/onboarding"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
        <body className="min-h-screen font-sans">
          <LanguageProvider>
            <ClearVaultUnlockOnSignOut />
            {children}
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
