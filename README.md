# FormSaathi

**Government forms, in your language.**

FormSaathi is a voice-first AI assistant that helps Indian citizens navigate government schemes, fill offline forms, and get guided help through online applications — all in their preferred language.

Built for people who find government paperwork intimidating. You speak, FormSaathi listens, fills, and guides.

<p align="center">
  <a href="https://form-saathi-one.vercel.app">
    <img src="docs/landing.png" alt="FormSaathi Landing Page" width="800" />
  </a>
</p>

<p align="center">
  <a href="https://form-saathi-one.vercel.app"><strong>Try it live</strong></a>
</p>

---

## The Problem

Millions of Indians are eligible for government welfare schemes but never apply because:
- Forms are in languages they can't read
- The process is confusing and bureaucratic
- Online portals are hard to navigate
- They don't know which schemes they qualify for

## What FormSaathi Does

**One assistant that handles the entire journey — by voice.**

### 1. Speak Your Language
Pick from 13 Indian languages. Everything changes — the UI, the voice, the forms. Supported languages: English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, and Urdu.

### 2. Scan Your Aadhaar
Point your camera at your Aadhaar card (front and back). AI reads it and pulls out your name, father's name, DOB, gender, address, Aadhaar number — all encrypted and stored only on your device.

### 3. Answer 3 Questions
The assistant asks what Aadhaar can't tell us: your occupation, income bracket, and social category. That's it. Everything else comes from the scan.

### 4. Find Your Schemes
Based on your profile, FormSaathi matches you against 50+ central government schemes — PM-KISAN, ration cards, crop insurance, pensions, scholarships, housing, and more. It tells you what you qualify for and how much you could receive.

### 5. Fill Offline Forms
Upload or scan a physical government form. The AI:
- Detects the form language (works with Hindi, English, Bengali, Tamil, and more)
- Extracts every field
- Auto-fills from your profile
- Asks for anything missing — by voice
- Generates a filled PDF you can download and submit

### 6. Get Guided Through Online Applications
When you want to apply on a government portal:
- FormSaathi opens the website for you
- You share your screen
- The assistant sees what's on screen and speaks step-by-step instructions
- It dictates your Aadhaar number slowly, in groups of 4
- It tells you exactly what to type in each field
- It reminds you to use the mic icon on your keyboard for voice typing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Clerk (Google OAuth) |
| AI Agent | Gemini 2.5 Flash via OpenRouter |
| TTS | OpenAI GPT-Audio via OpenRouter |
| STT | Gemini 2.5 Flash via OpenRouter |
| Vision/OCR | Gemini 2.5 Flash via OpenRouter |
| PDF Generation | pdf-lib |
| Encryption | Web Crypto API (AES-GCM) |
| Storage | IndexedDB (on-device only) |
| i18n | i18next + react-i18next |
| Styling | Tailwind CSS |

## Architecture

```
Client (React)                     Server (Next.js API Routes)
+------------------+              +----------------------------+
|                  |              |                            |
|  Voice Chat UI   |---POST----->|  /api/agent/chat           |
|  - Mic (STT)     |              |  - Builds system prompt    |
|  - Speaker (TTS) |<--reply-----|  - Calls Gemini 2.5 Flash  |
|  - Camera        |              |  - Executes 15 tools       |
|  - Screen Share  |              |  - Returns text + actions  |
|                  |              |                            |
|  Encrypted Vault |              |  /api/agent/scan-form      |
|  (IndexedDB)     |              |  /api/agent/fill-pdf       |
|                  |              |  /api/agent/screen-guide   |
|                  |              |  /api/openrouter/*          |
+------------------+              +----------------------------+
```

**Key design decisions:**
- **Server-side agentic loop** — API key stays on server, tools execute server-side
- **No server-side user data** — everything encrypted in IndexedDB on the device
- **Single model for everything** — Gemini 2.5 Flash handles text, vision, tool calling, and multilingual reasoning
- **Voice-first UX** — big mic button, auto-TTS on every page, text input is secondary

## Agent Tools (15)

| Tool | What it does |
|------|-------------|
| `get_user_profile` | Read profile from vault |
| `update_user_profile` | Save new fields to vault |
| `find_eligible_schemes` | Match profile against 50+ schemes |
| `get_scheme_details` | Get scheme info, portal URL, form fields |
| `translate_text` | Translate between any supported languages |
| `scan_document` | Vision OCR on Aadhaar cards, forms, documents |
| `detect_form_language` | Identify form language and script |
| `extract_form_fields` | Pull all field labels, types, and positions from a form |
| `fill_form_fields` | Match extracted fields to profile using multilingual alias table |
| `generate_filled_pdf` | Create filled PDF for download |
| `analyze_screenshot` | Understand what's on a government website |
| `generate_guidance` | Speak step-by-step instructions for online forms |
| `request_camera` | Ask user to open camera |
| `request_screen_share` | Prompt screen sharing |
| `request_voice_input` | Ask user to speak |

## Privacy

- All personal data is encrypted with AES-GCM and stored only in your browser's IndexedDB
- Encryption key lives in localStorage — if cleared, data is unrecoverable (by design)
- No user data is stored on any server
- Aadhaar images are processed via OpenRouter's API and never stored
- Sign-out clears all session state and onboarding flags

## Getting Started

### Prerequisites
- Node.js 18+
- Clerk account (for auth)
- OpenRouter API key

### Setup

```bash
git clone https://github.com/RinN0Sekai/FormSaathi.git
cd FormSaathi
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
OPENROUTER_API_KEY=sk-or-v1-...
```

Run:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supported Government Schemes (50+)

Ration Card (NFSA), PM-KISAN, PM Fasal Bima Yojana, PM Awas Yojana (Urban & Rural), Sukanya Samriddhi Yojana, PM Matru Vandana Yojana, National Pension Scheme, Ayushman Bharat, PM Ujjwala Yojana, Soil Health Card Scheme, National Scholarship Portal, PM Mudra Yojana, Stand-Up India, Skill India, and many more.

## License

MIT
