import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterApiKey,
  getOpenRouterVisionModel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

const DEMO_FIXTURES: Record<string, Record<string, string>> = {
  aadhaar: {
    Name: "Demo User",
    "Aadhaar Number": "123456789012",
    DOB: "01/01/1990",
    Address: "New Delhi",
  },
  dl: {
    Name: "Demo Driver",
    "DL No": "DL1420110012345",
    DOB: "15/08/1988",
    Address: "Bengaluru",
  },
  pan: {
    Name: "Demo Pan",
    "PAN Number": "ABCDE1234F",
  },
};

function demoFixtureFromName(name: string): Record<string, string> | null {
  const n = name.toLowerCase();
  if (n.includes("aadhaar")) return DEMO_FIXTURES.aadhaar;
  if (n.includes("driver") || n.includes("licence") || n.includes("license"))
    return DEMO_FIXTURES.dl;
  if (n.includes("pan")) return DEMO_FIXTURES.pan;
  return null;
}

function parseJsonObject(raw: string): Record<string, string> {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = (fence ? fence[1] : raw).trim();
  const parsed = JSON.parse(jsonStr) as unknown;
  if (!parsed || typeof parsed !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
    else if (typeof v === "number") out[k] = String(v);
  }
  return out;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const OCR_SYSTEM = `Extract identity fields from this Indian ID document image.
Return strictly one JSON object of string values. Prefer these keys when present:
Name, Aadhaar Number, PAN Number, DL No, DOB, Address, Gender.
Use empty string for missing fields. Never invent ID numbers.`;

async function extractWithGroq(dataUrl: string): Promise<Record<string, string> | null> {
  const groqKey = (process.env.GROQ_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!groqKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      messages: [
        { role: "system", content: OCR_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all visible identity fields as JSON." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[ocr/parse] Groq", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return parseJsonObject(content);
  } catch {
    return null;
  }
}

async function extractWithOpenRouter(dataUrl: string): Promise<Record<string, string> | null> {
  const key = getOpenRouterApiKey();
  if (!key) return null;
  const model = getOpenRouterVisionModel();

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: OCR_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all visible identity fields as JSON." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[ocr/parse] OpenRouter", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return parseJsonObject(content);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const demo = demoFixtureFromName(file.name);
  if (demo) {
    return NextResponse.json(demo);
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    const groq = await extractWithGroq(dataUrl);
    if (groq && Object.keys(groq).length) return NextResponse.json(groq);

    const openrouter = await extractWithOpenRouter(dataUrl);
    if (openrouter && Object.keys(openrouter).length) return NextResponse.json(openrouter);

    return NextResponse.json(
      { error: "Could not extract fields from image" },
      { status: 502 },
    );
  } catch (err) {
    console.error("[ocr/parse]", err);
    return NextResponse.json(
      { error: "OCR request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
