"use client";

import { clearExpectOnboardingAfterAuth } from "@/lib/auth-flow-flags";
import { TopBar } from "@/components/formsaathi/TopBar";
import { useEffect } from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    clearExpectOnboardingAfterAuth();
  }, []);

  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
