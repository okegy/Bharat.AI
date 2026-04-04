/** localStorage keys — credential data stays on this device only. */

export const STORAGE_PASSKEY_REGISTERED = "formsaathi_passkey_registered";
export const STORAGE_PASSKEY_SKIPPED = "formsaathi_passkey_skipped";
export const STORAGE_CREDENTIAL_ID = "formsaathi_webauthn_credential_id";

/** Set before opening `/onboarding/biometric` so the screen stays usable after onboarding (skip/register). */
export const SESSION_BIOMETRIC_SETUP_INTENT =
  "formsaathi_biometric_setup_intent";

export function markBiometricSetupIntent(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_BIOMETRIC_SETUP_INTENT, "1");
}

export function isPasskeyRegisteredOnDevice(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_PASSKEY_REGISTERED) === "1";
}

export function isBiometricOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(STORAGE_PASSKEY_REGISTERED) === "1" ||
    localStorage.getItem(STORAGE_PASSKEY_SKIPPED) === "1"
  );
}

export function markPasskeyRegistered(): void {
  localStorage.setItem(STORAGE_PASSKEY_REGISTERED, "1");
  localStorage.removeItem(STORAGE_PASSKEY_SKIPPED);
}

export function markPasskeySkipped(): void {
  localStorage.setItem(STORAGE_PASSKEY_SKIPPED, "1");
}

const SESSION_VAULT_UNLOCKED_AT = "formsaathi_vault_unlocked_at";

/** Re-verify passkey after this idle period (per browser tab session). */
const VAULT_UNLOCK_MAX_AGE_MS = 30 * 60 * 1000;

function base64UrlToArrayBuffer(b64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out.buffer;
}

export function markVaultSessionUnlocked(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_VAULT_UNLOCKED_AT, String(Date.now()));
}

export function clearVaultSessionUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_VAULT_UNLOCKED_AT);
}

export function isVaultSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(SESSION_VAULT_UNLOCKED_AT);
  if (!raw) return false;
  const at = parseInt(raw, 10);
  if (Number.isNaN(at)) return false;
  if (Date.now() - at > VAULT_UNLOCK_MAX_AGE_MS) {
    sessionStorage.removeItem(SESSION_VAULT_UNLOCKED_AT);
    return false;
  }
  return true;
}

/**
 * Whether vault-backed screens should require a fresh passkey verification
 * this session. Skipped-passkey users are not prompted.
 */
export function needsVaultBiometricUnlock(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPasskeyRegisteredOnDevice()) return false;
  if (!localStorage.getItem(STORAGE_CREDENTIAL_ID)) return false;
  return !isVaultSessionUnlocked();
}

/**
 * Unlocks vault-backed UI for this tab session after the user completes
 * fingerprint / face / screen lock on a registered passkey.
 *
 * Uses the exact credential ID that was saved during registration so the
 * browser knows which passkey to use — the same one the user set up.
 *
 * `userVerification: "required"` forces the browser to trigger the actual
 * biometric sensor (fingerprint / Face ID / screen lock).  If that fails
 * on the specific device we retry with "preferred" as a fallback.
 *
 * `transports` is intentionally omitted in `allowCredentials` so the
 * browser is free to look for the credential across all transport types
 * (platform authenticator, hybrid, etc.), matching however it was stored.
 */
export async function verifyDevicePasskey(): Promise<void> {
  if (!isWebAuthnAvailable()) {
    throw new Error("WebAuthn is not available in this browser.");
  }
  const idB64 = localStorage.getItem(STORAGE_CREDENTIAL_ID);
  if (!idB64) {
    throw new Error(
      "No passkey on this device. Set up fingerprint from Settings.",
    );
  }
  const credentialId = base64UrlToArrayBuffer(idB64) as BufferSource;
  const rpId = relyingPartyId();

  const levels: UserVerificationRequirement[] = ["required", "preferred"];
  let lastError: unknown;

  for (const userVerification of levels) {
    try {
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: randomChallenge(),
          rpId,
          allowCredentials: [{ id: credentialId, type: "public-key" }],
          userVerification,
          timeout: 60_000,
        },
      });
      if (cred) {
        markVaultSessionUnlocked();
        return;
      }
    } catch (e) {
      lastError = e;
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        throw new Error(webAuthnErrorMessage(e));
      }
    }
  }
  throw new Error(webAuthnErrorMessage(lastError));
}

/**
 * Clears the stored passkey so the user can re-register or bypass the lock.
 */
export function resetStoredPasskey(): void {
  localStorage.removeItem(STORAGE_CREDENTIAL_ID);
  localStorage.removeItem(STORAGE_PASSKEY_REGISTERED);
  localStorage.removeItem(STORAGE_PASSKEY_SKIPPED);
  clearVaultSessionUnlock();
}

/**
 * Checks whether this device/browser supports WebAuthn at all.
 * Returns false on browsers without the API or outside a secure context.
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    window.isSecureContext
  );
}

/**
 * Checks whether this device has a built-in biometric sensor (fingerprint,
 * face, or screen-lock) usable as a platform authenticator.
 *
 * Returns `false` on devices without a sensor so the UI can auto-skip or
 * hide the biometric setup entirely instead of showing a confusing prompt.
 */
export async function hasPlatformBiometric(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function userHandleFromClerkId(userId: string): BufferSource {
  const encoded = new TextEncoder().encode(userId);
  const len = Math.min(encoded.byteLength, 64);
  const out = new Uint8Array(len);
  out.set(encoded.subarray(0, len));
  return out as BufferSource;
}

function randomChallenge(): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  crypto.getRandomValues(new Uint8Array(buf));
  return buf;
}

function relyingPartyId(): string {
  return window.location.hostname;
}

function webAuthnErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "The prompt was cancelled or timed out. Try again when you can complete fingerprint, face, or screen lock.";
      case "NotSupportedError":
        return "This browser or device does not support the requested security key setup. Try another browser, or use Skip.";
      case "SecurityError":
        return "WebAuthn needs the site address to stay consistent. Open the app at http://localhost:3000 (not 127.0.0.1) — in development we redirect there automatically. In production use your real https URL everywhere.";
      case "InvalidStateError":
        return "A passkey for this account may already exist on this device. Remove it from system / browser passkey settings, or use Skip.";
      case "AbortError":
        return "Setup was interrupted. Please try again.";
      default:
        return err.message || err.name;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong.";
}

/**
 * Creates a WebAuthn credential using the device's platform authenticator
 * (fingerprint / face / screen-lock) when available, falling back to any
 * authenticator the browser supports.
 *
 * Strategy:
 * 1. If platform biometric is available → use `authenticatorAttachment: "platform"`.
 * 2. Otherwise → omit `authenticatorAttachment` so any authenticator works.
 *
 * Each strategy uses `userVerification: "preferred"` first (widest compat),
 * then retries with `"required"` in case the device specifically needs it.
 *
 * `NotAllowedError` (user cancelled) and `InvalidStateError` (credential
 * already exists) bail immediately — no point retrying a different selector.
 */
export async function registerDevicePasskey(params: {
  userId: string;
  username: string;
  displayName: string;
}): Promise<void> {
  if (!isWebAuthnAvailable()) {
    throw new Error("WebAuthn is not available in this browser.");
  }

  const rpId = relyingPartyId();
  const hasPlatform = await hasPlatformBiometric();

  const base: PublicKeyCredentialCreationOptions = {
    challenge: randomChallenge(),
    rp: { name: "FormSaathi", id: rpId },
    user: {
      id: userHandleFromClerkId(params.userId),
      name: params.username.slice(0, 64),
      displayName: params.displayName.slice(0, 64),
    },
    pubKeyCredParams: [
      { type: "public-key" as const, alg: -7 },
      { type: "public-key" as const, alg: -257 },
    ],
    timeout: 120_000,
    attestation: "none" as const,
    authenticatorSelection: undefined,
  };

  type AuthSel =
    PublicKeyCredentialCreationOptions["authenticatorSelection"];

  const attempts: AuthSel[] = hasPlatform
    ? [
        {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "discouraged",
        },
        {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        {
          userVerification: "preferred",
          residentKey: "discouraged",
        },
      ]
    : [
        {
          userVerification: "preferred",
          residentKey: "discouraged",
        },
        {
          userVerification: "required",
          residentKey: "discouraged",
        },
      ];

  let lastError: unknown;

  for (const authenticatorSelection of attempts) {
    try {
      const cred = (await navigator.credentials.create({
        publicKey: {
          ...base,
          challenge: randomChallenge(),
          authenticatorSelection,
        },
      })) as PublicKeyCredential | null;

      if (!cred) {
        throw new Error(
          "Registration was cancelled or not supported on this device.",
        );
      }

      localStorage.setItem(
        STORAGE_CREDENTIAL_ID,
        arrayBufferToBase64Url(cred.rawId),
      );
      markPasskeyRegistered();
      markVaultSessionUnlocked();
      return;
    } catch (e) {
      lastError = e;
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        throw new Error(webAuthnErrorMessage(e));
      }
      if (e instanceof DOMException && e.name === "InvalidStateError") {
        throw new Error(webAuthnErrorMessage(e));
      }
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(webAuthnErrorMessage(e));
      }
    }
  }

  throw new Error(webAuthnErrorMessage(lastError));
}
