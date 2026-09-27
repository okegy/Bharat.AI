"use client";

import Link from "next/link";

import { useAppLanguage } from "@/lib/app-language";
import { getUiText } from "@/lib/ui-text";

const btnClass =
  "glow-coral inline-flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-orange-600 hover:bg-orange-500 px-8 text-base font-bold text-white shadow-xl shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500";

export function GetStartedButton() {
  const { language } = useAppLanguage();
  const href = "/onboarding";

  return (
    <Link href={href} className={btnClass}>
      {getUiText(language, "Get Started")}
    </Link>
  );
}
