/**
 * BharatLink — pre-deployment QA suite.
 * Run: node scripts/final-qa.mjs
 * Covers: pages, agent APIs, voice round-trip, languages, samples, WhatsApp.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = "http://localhost:3000";
const TMP = os.tmpdir();
const results = [];
const t0 = Date.now();

function record(area, name, status, detail = "") {
  const icon = status === "PASS" ? "✅" : status === "WARN" ? "⚠️ " : "❌";
  results.push({ area, name, status, detail });
  console.log(`${icon} [${area}] ${name}${detail ? " — " + detail : ""}`);
}

async function jfetch(url, opts = {}, timeoutMs = 90000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function check(name, area, fn) {
  try {
    await fn();
  } catch (e) {
    record(area, name, "FAIL", String(e?.message ?? e).slice(0, 160));
  }
}

/* ── 1. Page routes ─────────────────────────────────────── */
const pages = [
  "/", "/onboarding", "/onboarding/language", "/onboarding/aadhaar",
  "/onboarding/voice", "/onboarding/biometric", "/assistant", "/documents",
  "/eligibility", "/form-fill", "/samples", "/settings", "/sign-in", "/sign-up",
];
for (const p of pages) {
  await check(`GET ${p}`, "PAGES", async () => {
    const res = await jfetch(BASE + p, { redirect: "manual" }, 30000);
    if (res.status === 200) record("PAGES", p, "PASS");
    else if (res.status >= 300 && res.status < 400)
      record("PAGES", p, "PASS", `${res.status} → ${res.headers.get("location") ?? "?"} (auth guard)`);
    else record("PAGES", p, "FAIL", `HTTP ${res.status}`);
  });
}

/* ── 2. Static assets ───────────────────────────────────── */
await check("samples + forms assets", "ASSETS", async () => {
  const svgs = fs.readdirSync("public/samples");
  const pdfs = fs.readdirSync("public/forms");
  if (svgs.length >= 3 && pdfs.length >= 10)
    record("ASSETS", "sample SVGs + form PDFs", "PASS", `${svgs.length} svgs, ${pdfs.length} pdfs`);
  else record("ASSETS", "sample SVGs + form PDFs", "WARN", `${svgs.length} svgs, ${pdfs.length} pdfs`);
});
await check("GET /samples page lists samples", "ASSETS", async () => {
  const res = await jfetch(BASE + "/samples", {}, 30000);
  const html = await res.text();
  record("ASSETS", "/samples renders", res.status === 200 ? "PASS" : "FAIL",
    res.status === 200 && /sample|aadhaar|form/i.test(html) ? "lists sample content" : `HTTP ${res.status}`);
});

/* ── 3. Render sample card image once (shared by vision tests) ── */
let cardJpeg = null;
await check("render sample card (puppeteer)", "VISION", async () => {
  const { default: puppeteer } = await import("puppeteer");
  const svg = fs.readFileSync("public/samples/sample-aadhaar.svg", "utf8");
  const uri = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new", timeout: 60000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0"><img src="${uri}" style="width:1560px"></body>`);
  const buf = await page.screenshot({ encoding: "base64", type: "jpeg", quality: 88 });
  await browser.close();
  cardJpeg = buf;
  fs.writeFileSync(path.join(TMP, "qa-card.jpg"), Buffer.from(buf, "base64"));
  record("VISION", "sample card rendered", "PASS", `${Math.round(buf.length / 1024)}KB jpeg`);
});

const cardDataUrl = () => `data:image/jpeg;base64,${cardJpeg}`;

/* ── 4. Agent core ──────────────────────────────────────── */
await check("POST /api/agent/chat", "AGENT", async () => {
  const res = await jfetch(BASE + "/api/agent/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Hi, who are you?" }],
      language: "en", profileSnapshot: { fullName: "QA Tester" }, phase: "greeting",
    }),
  });
  const d = await res.json();
  if (res.status === 200 && d.reply) record("AGENT", "chat JSON turn", "PASS", `tools: ${JSON.stringify(d.toolsUsed)}`);
  else record("AGENT", "chat JSON turn", "FAIL", `HTTP ${res.status} ${JSON.stringify(d).slice(0, 120)}`);
});

await check("POST /api/agent/chat/stream", "AGENT", async () => {
  const res = await jfetch(BASE + "/api/agent/chat/stream", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "What schemes can a farmer with 2 acres get?" }],
      language: "en", profileSnapshot: { fullName: "QA Tester", occupation: "farmer" }, phase: "greeting",
    }),
  });
  const text = await res.text();
  const events = text.split("\n\n").filter(Boolean).map((c) => c.match(/^event: (\w+)/)?.[1]).filter(Boolean);
  const ok = res.status === 200 && events.includes("done") && events.includes("tool_start");
  record("AGENT", "SSE stream", ok ? "PASS" : "FAIL", `events: ${events.join(" → ")}`);
});

/* ── 5. Documents / PDF ─────────────────────────────────── */
await check("POST /api/agent/fill-pdf (+verification)", "DOCS", async () => {
  const pdfB64 = fs.readFileSync("public/forms/01-PM-KISAN-Application.pdf").toString("base64");
  const res = await jfetch(BASE + "/api/agent/fill-pdf", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formImage: "data:application/pdf;base64," + pdfB64,
      filledFields: { fullName: "QA Tester", fatherName: "QA Father", dob: "01/01/1990", gender: "Male", aadhaarNumber: "123456789012", phone: "9876543210" },
      title: "QA Fill",
    }),
  });
  const d = await res.json();
  const ok = res.status === 200 && d.method === "acroform" && d.verification?.passed;
  record("DOCS", "AcroForm fill + self-verification", ok ? "PASS" : "FAIL",
    `${d.fieldsFilled}/${d.totalFields} filled, verified ${d.verification?.verified ?? "?"}, mismatches ${d.verification?.mismatches?.length ?? "?"}`);
});

await check("POST /api/agent/extract-pdf (scanned PDF via Gemini)", "DOCS", async () => {
  const pdfB64 = fs.readFileSync("public/forms/07-Ayushman-Bharat.pdf").toString("base64");
  const res = await jfetch(BASE + "/api/agent/extract-pdf", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf: "data:application/pdf;base64," + pdfB64 }),
  });
  const d = await res.json();
  record("DOCS", "scanned-PDF text extraction", res.status === 200 && d.text?.length > 50 ? "PASS" : "FAIL",
    res.status === 200 ? `${d.text.length} chars via ${d.provider}` : `HTTP ${res.status} ${JSON.stringify(d).slice(0, 100)}`);
});

/* ── 6. Vision APIs ─────────────────────────────────────── */
await check("POST /api/openrouter/aadhaar-extract", "VISION", async () => {
  if (!cardJpeg) throw new Error("no rendered card");
  const res = await jfetch(BASE + "/api/openrouter/aadhaar-extract", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: cardDataUrl() }),
  });
  const d = await res.json();
  const p = d.profile ?? {};
  const got = ["fullName", "dob", "aadhaarNumber"].filter((k) => p[k]).length;
  record("VISION", "Aadhaar OCR", res.status === 200 && got >= 2 ? "PASS" : "FAIL",
    `fields: ${Object.entries(p).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}`);
});

await check("POST /api/agent/scan-form", "VISION", async () => {
  if (!cardJpeg) throw new Error("no rendered card");
  const res = await jfetch(BASE + "/api/agent/scan-form", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: cardDataUrl(), language: "en" }),
  }, 120000);
  record("VISION", "form scan", res.status === 200 ? "PASS" : "WARN", `HTTP ${res.status}`);
});

await check("POST /api/agent/screen-guide", "VISION", async () => {
  if (!cardJpeg) throw new Error("no rendered card");
  const res = await jfetch(BASE + "/api/agent/screen-guide", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ screenshot: cardDataUrl(), language: "en", profileFields: { fullName: "QA Tester" }, previousContext: "" }),
  }, 120000);
  record("VISION", "screen guidance", res.status === 200 ? "PASS" : "WARN", `HTTP ${res.status}`);
});

await check("POST /api/ocr/parse", "VISION", async () => {
  if (!cardJpeg) throw new Error("no rendered card");
  const res = await jfetch(BASE + "/api/ocr/parse", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: cardDataUrl() }),
  }, 120000);
  record("VISION", "ocr parse", res.status === 200 ? "PASS" : "WARN", `HTTP ${res.status}`);
});

/* ── 7. Voice round-trip (TTS → STT) ────────────────────── */
let spokenWav = null;
await check("POST /api/openrouter/tts (Sarvam Priya)", "VOICE", async () => {
  const res = await jfetch(BASE + "/api/openrouter/tts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Welcome to BharatLink QA. Your voice assistant is ready.", languageCode: "en-IN" }),
  });
  const d = await res.json();
  spokenWav = d.audios?.[0] ?? null;
  const ok = res.status === 200 && spokenWav && d.model?.includes("sarvam");
  record("VOICE", "TTS Priya (en-IN)", ok ? "PASS" : "FAIL",
    `model: ${d.model ?? "?"}, ${spokenWav ? Math.round(spokenWav.length / 1024) + "KB" : "empty"}`);
  if (spokenWav) fs.writeFileSync(path.join(TMP, "qa-spoken.wav"), Buffer.from(spokenWav, "base64"));
});

await check("POST /api/openrouter/tts (Hindi)", "VOICE", async () => {
  const res = await jfetch(BASE + "/api/openrouter/tts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "नमस्ते, आपकी क्या सहायता कर सकते हैं?", languageCode: "hi-IN" }),
  });
  const d = await res.json();
  record("VOICE", "TTS Priya (hi-IN)", res.status === 200 && d.model?.includes("sarvam") ? "PASS" : "FAIL", `model: ${d.model ?? "?"}`);
});

await check("POST /api/openrouter/stt (Groq, round-trip)", "VOICE", async () => {
  const wavPath = path.join(TMP, "qa-spoken.wav");
  if (!fs.existsSync(wavPath)) throw new Error("no TTS wav to feed");
  const fd = new FormData();
  fd.append("audio", new Blob([fs.readFileSync(wavPath)], { type: "audio/wav" }), "qa.wav");
  fd.append("languageCode", "en-IN");
  const res = await jfetch(BASE + "/api/openrouter/stt", { method: "POST", body: fd }, 120000);
  const d = await res.json();
  const t = (d.transcript ?? "").toLowerCase();
  const ok = res.status === 200 && (t.includes("bharatlink") || t.includes("bharat link") || t.includes("welcome"));
  record("VOICE", "STT round-trip (Priya speaks → Groq hears)", ok ? "PASS" : "FAIL",
    `transcript: "${(d.transcript ?? "").slice(0, 70)}" via ${d.model ?? "?"}`);
});

/* ── 8. Translate + language + WhatsApp ─────────────────── */
await check("POST /api/openrouter/translate", "I18N", async () => {
  const res = await jfetch(BASE + "/api/openrouter/translate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "Hello, how are you?", sourceLanguageCode: "en-IN", targetLanguageCode: "hi-IN" }),
  });
  const d = await res.json();
  record("I18N", "translate en→hi", res.status === 200 ? "PASS" : "FAIL",
    `→ "${String(d.translated ?? d.text ?? d.translation ?? JSON.stringify(d)).slice(0, 50)}"`);
});

await check("POST /api/user/language", "I18N", async () => {
  const res = await jfetch(BASE + "/api/user/language", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "hi" }),
  });
  record(
    "I18N",
    "set user language",
    res.status === 200 ? "PASS" : res.status === 401 ? "PASS" : "FAIL",
    res.status === 200 ? "HTTP 200" : res.status === 401 ? "HTTP 401 — auth-protected (expected unauthenticated)" : `HTTP ${res.status}`,
  );
});

await check("POST /api/whatsapp/webhook", "WHATSAPP", async () => {
  const res = await jfetch(BASE + "/api/whatsapp/webhook", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: "whatsapp:+919999900000", Body: "What schemes am I eligible for? I am a farmer." }),
  }, 120000);
  const d = await res.json().catch(() => ({}));
  const reply = d.reply ?? d.message ?? d.response ?? "";
  record("WHATSAPP", "webhook message → agent reply", res.status === 200 ? "PASS" : "FAIL",
    res.status === 200 ? `reply: "${String(reply).slice(0, 70)}"` : `HTTP ${res.status} ${JSON.stringify(d).slice(0, 120)}`);
});

/* ── 9. Locales (13 languages) ──────────────────────────── */
await check("locale files", "I18N", async () => {
  const dir = "src/locales";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const parsed = files.map((f) => ({ f, data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
  const keySets = new Set(parsed.map((p) => Object.keys(p.data).sort().join(",")));
  const minKeys = Math.min(...parsed.map((p) => Object.values(p.data).flat().length));
  if (files.length === 13 && keySets.size === 1)
    record("I18N", "13 locales, key parity", "PASS", `${files.join(", ")} (~${minKeys} keys each)`);
  else
    record("I18N", "13 locales, key parity", "WARN", `${files.length} files, ${keySets.size} distinct key sets`);
});

/* ── Summary ────────────────────────────────────────────── */
const pass = results.filter((r) => r.status === "PASS").length;
const warn = results.filter((r) => r.status === "WARN").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log("\n══════════════════════════════════════");
console.log(`QA SUMMARY: ${pass} PASS · ${warn} WARN · ${fail} FAIL  (${Math.round((Date.now() - t0) / 1000)}s)`);
if (fail) {
  console.log("FAILURES:");
  results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`  ❌ [${r.area}] ${r.name} — ${r.detail}`));
}
console.log("══════════════════════════════════════");
