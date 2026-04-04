"use client";

import { AuthFlowStep } from "@/components/formsaathi/AuthFlowStep";
import { useAppLanguage } from "@/lib/app-language";
import { formSaathiClerkAppearance } from "@/lib/clerk-auth-appearance";
import { markExpectOnboardingAfterAuth } from "@/lib/auth-flow-flags";
import { getUiText } from "@/lib/ui-text";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function SignUpPage() {
  const { language } = useAppLanguage();
  const { t } = useTranslation();

  useEffect(() => {
    markExpectOnboardingAfterAuth();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-saathi-cream px-4 py-24">
      <div className="w-full max-w-md">
        <AuthFlowStep
          step={1}
          title={t("auth.signUpTitle")}
          description={t("auth.signUpDescription")}
        />
        <SignUp
          path="/sign-up"
          routing="path"
          appearance={formSaathiClerkAppearance}
          signInUrl="/sign-in"
          forceRedirectUrl="/onboarding"
          fallbackRedirectUrl="/onboarding"
        />
      </div>
      <Link
        href="/"
        className="mt-10 text-sm font-medium text-saathi-forest/80 underline-offset-4 hover:text-saathi-forest hover:underline"
      >
        {`← ${getUiText(language, "Back to home")}`}
      </Link>
    </main>
  );
}
