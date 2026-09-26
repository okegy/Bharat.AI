"use client";

import Link from "next/link";

import { useAppLanguage } from "@/lib/app-language";
import { getUiText } from "@/lib/ui-text";

const btnClass =
  "inline-flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-bharatlink-tealDark px-8 text-base font-semibold text-white shadow-lg shadow-bharatlink-tealDark/25 transition hover:bg-bharatlink-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bharatlink-tealDark";

export function GetStartedButton() {
  const { language } = useAppLanguage();
  const href = "/onboarding";

  return (
    <Link href={href} className={btnClass}>
      {getUiText(language, "Get Started")}
    </Link>
  );
}
