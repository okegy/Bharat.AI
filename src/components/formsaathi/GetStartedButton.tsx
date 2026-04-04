"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useAppLanguage } from "@/lib/app-language";
import { getUiText } from "@/lib/ui-text";

const btnClass =
  "inline-flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-saathi-forest px-8 text-base font-semibold text-white shadow-lg shadow-saathi-forest/25 transition hover:bg-saathi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saathi-forest";

export function GetStartedButton() {
  const { isSignedIn, isLoaded } = useUser();
  const { language } = useAppLanguage();
  const href = isLoaded && isSignedIn ? "/onboarding" : "/sign-in";

  return (
    <Link href={href} className={btnClass}>
      {getUiText(language, "Get Started")}
    </Link>
  );
}
