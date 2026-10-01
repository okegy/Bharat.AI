"""Wire VaultBell + hub link + access logging into existing pages (all additive)."""
import io, os

def rw(path, fn):
    s = io.open(path, encoding="utf-8").read()
    orig = s
    s = fn(s)
    if s != orig:
        io.open(path, "w", encoding="utf-8", newline="\n").write(s)
        print("patched:", path)
    else:
        print("no change:", path)

# ── 0. remove the garbage patch script ──
g = "scripts/patch-vault-hub.py"
if os.path.exists(g):
    os.remove(g)
    print("removed garbage:", g)

# ── 1. TopBar: bell + import ──
def topbar(s):
    imp = 'import { CursorToggle } from "@/components/BharatLink/CursorToggle";'
    if "VaultBell" not in s:
        assert imp in s, "topbar import anchor"
        s = s.replace(imp, imp + '\nimport { VaultBell } from "@/components/BharatLink/VaultBell";', 1)
    idx = s.find('href="/settings"')
    assert idx > 0, "topbar settings link not found"
    link_start = s.rfind("<Link", 0, idx)
    assert link_start > 0, "topbar Link start not found"
    if "<VaultBell />" not in s:
        s = s[:link_start] + "<VaultBell />\n        " + s[link_start:]
    return s
rw("src/components/BharatLink/TopBar.tsx", topbar)

# ── 2. Dashboard: Vault Hub card before the assistant CTA ──
def dashboard(s):
    anchor = "        {/* BharatLink Assistant CTA */}"
    assert anchor in s, "dashboard CTA anchor"
    if "/dashboard/vault" not in s:
        card = """        {/* Vault Hub CTA */}
        <section className="mb-8">
          <Link
            href="/dashboard/vault"
            className="group flex items-center gap-4 rounded-2xl glass-card border border-orange-500/30 p-5 shadow-lg shadow-orange-500/10 hover:border-orange-500/60 transition"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/30 glow-coral">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75M6.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-bharatlink-navy group-hover:text-orange-600 transition">Vault Hub — reminders &amp; access log</p>
              <p className="text-sm text-bharatlink-navy/60">
                Renewal dates, document access timeline, and every vault entry in one place
              </p>
            </div>
            <svg className="h-5 w-5 text-orange-600 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </section>

""" + anchor
        s = s.replace(anchor, card, 1)
    return s
rw("src/app/dashboard/page.tsx", dashboard)

# ── 3. Access logging (additive one-liners) ──
LOG_IMPORT = 'import { logVaultAccess } from "@/lib/vault-log";'

def assistant(s):
    imp = 'import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";'
    if "logVaultAccess" not in s:
        assert imp in s, "assistant import anchor"
        s = s.replace(imp, imp + "\n" + LOG_IMPORT, 1)
    anchor = "    getProfile().then((p) => {"
    assert anchor in s, "assistant getProfile anchor"
    return s.replace(
        anchor,
        anchor + '\n      void logVaultAccess({ source: "/assistant", dataCategory: "profile", action: "read" });',
        1,
    )
rw("src/app/assistant/page.tsx", assistant)

def settings(s):
    if "logVaultAccess" not in s:
        anchor = 'import { CursorToggle } from "@/components/BharatLink/CursorToggle";'
        assert anchor in s, "settings import anchor"
        s = s.replace(anchor, anchor + "\n" + LOG_IMPORT, 1)
        anchor2 = "    (async () => {\n      try {"
        assert anchor2 in s, "settings load anchor"
        s = s.replace(
            anchor2,
            anchor2
            + '\n        void logVaultAccess({ source: "/settings", dataCategory: "profile, documents, family, references", action: "read" });',
            1,
        )
    return s
rw("src/app/settings/page.tsx", settings)

def aadhaar(s):
    imp = 'import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";'
    if "logVaultAccess" not in s:
        assert imp in s, "aadhaar import anchor"
        s = s.replace(imp, imp + "\n" + LOG_IMPORT, 1)
        anchor = "    await saveProfile(merged);"
        assert anchor in s, "aadhaar save anchor"
        s = s.replace(
            anchor,
            anchor
            + '\n    void logVaultAccess({ source: "/onboarding/aadhaar", dataCategory: "profile (Aadhaar scan)", action: "write" });',
            1,
        )
    return s
rw("src/app/onboarding/aadhaar/page.tsx", aadhaar)

def voice(s):
    imp = 'import { getProfile, saveProfile, type ProfileData } from "@/lib/profile-vault";'
    if "logVaultAccess" not in s:
        assert imp in s, "voice import anchor"
        s = s.replace(imp, imp + "\n" + LOG_IMPORT, 1)
        anchor = "        saveProfile(final).then(() => {"
        assert anchor in s, "voice save anchor"
        s = s.replace(
            anchor,
            '        void logVaultAccess({ source: "/onboarding/voice", dataCategory: "profile (voice answers)", action: "write" });\n'
            + anchor,
            1,
        )
    return s
rw("src/app/onboarding/voice/page.tsx", voice)

print("ALL VAULT WIRING OK")
