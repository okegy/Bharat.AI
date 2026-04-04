"use client";

import { SESSION_EXPECT_ONBOARDING } from "@/lib/auth-flow-flags";
import { isOnboardingComplete } from "@/lib/language-storage";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Clerk sometimes falls back to the dashboard "Application home" (`/`) after OAuth.
 * If the user started from our sign-in/up page, send them to `/onboarding`.
 */
export function ResumeOnboardingRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_EXPECT_ONBOARDING) !== "1") return;
    sessionStorage.removeItem(SESSION_EXPECT_ONBOARDING);
    router.replace(isOnboardingComplete() ? "/assistant" : "/onboarding");
  }, [isLoaded, isSignedIn, router]);

  return null;
}
