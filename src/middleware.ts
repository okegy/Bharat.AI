import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/dashboard(.*)",
  "/eligibility(.*)",
  "/scheme(.*)",
  "/documents(.*)",
  "/assistant(.*)",
  "/form-fill(.*)",
]);

/** WebAuthn rp.id must match the browser hostname; localhost ≠ 127.0.0.1. */
function devLocalhostCanonicalRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "development") return null;
  const host = req.nextUrl.hostname;
  if (host !== "127.0.0.1" && host !== "::1" && host !== "[::1]")
    return null;
  const url = req.nextUrl.clone();
  url.hostname = "localhost";
  return NextResponse.redirect(url);
}

export default clerkMiddleware(async (auth, req) => {
  const canonical = devLocalhostCanonicalRedirect(req);
  if (canonical) return canonical;

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
