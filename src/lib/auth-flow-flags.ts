/** Set when user opens sign-in/up so a mistaken post-OAuth landing on `/` still reaches onboarding. */

export const SESSION_EXPECT_ONBOARDING = "formsaathi_expect_onboarding_after_auth";

export function markExpectOnboardingAfterAuth(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_EXPECT_ONBOARDING, "1");
}

export function clearExpectOnboardingAfterAuth(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_EXPECT_ONBOARDING);
}
