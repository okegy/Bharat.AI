"use client";

import { markLanguagePickerRepick } from "@/lib/language-storage";
import Link from "next/link";

type LanguagePickerNavLinkProps = {
  href?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Opens the post-login language screen. Sets a session flag so existing
 * localStorage language does not immediately bounce the user away.
 */
export function LanguagePickerNavLink({
  href = "/onboarding/language",
  className,
  children,
}: LanguagePickerNavLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => markLanguagePickerRepick()}
    >
      {children}
    </Link>
  );
}
