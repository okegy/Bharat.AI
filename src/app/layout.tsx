import type { Metadata } from "next";
import { ClearVaultUnlockOnSignOut } from "@/components/BharatLink/ClearVaultUnlockOnSignOut";
import { CustomCursor } from "@/components/BharatLink/CustomCursor";
import { GlobalVoiceNavigator } from "@/components/BharatLink/GlobalVoiceNavigator";
import { PwaRegistry } from "@/components/BharatLink/PwaRegistry";
import { LanguageProvider } from "@/lib/app-language";
import { ClerkProvider } from "@clerk/nextjs";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "BharatLink — Connecting every voice to the care it needs",
  description:
    "BharatLink helps citizens access government schemes, fill forms, and navigate portals — voice-first, in 13 Indian languages, for free.",
  keywords: ["government schemes", "Indian languages", "form filling", "PM-KISAN", "BharatLink", "AI assistant"],
  openGraph: {
    title: "BharatLink",
    description: "Connecting every voice, every language, to the care and services they need.",
    type: "website",
  },
  manifest: "/manifest.json",
  themeColor: "#ea580c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
        <body className="min-h-screen font-sans bg-ambient-mesh">
          <LanguageProvider>
            <PwaRegistry />
            <CustomCursor />
            <ClearVaultUnlockOnSignOut />
            {children}
            <GlobalVoiceNavigator />
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
