import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { ProfileData } from "@/lib/profile-vault";
import {
  DEFAULT_OPENROUTER_VISION_MODEL,
  getOpenRouterVisionModel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

const EXTRACT_KEYS: (keyof ProfileData)[] = [
  "fullName",
  "fatherName",
  "dob",
  "gender",
  "aadhaarNumber",
  "address",
  "pincode",
  "district",
  "state",
];

const SYSTEM = `You help users digitize their own Indian Aadhaar card for offline form filling.
Read only text clearly visible on the card image. If the image is not an Aadhaar card or text is unreadable, return empty strings for all fields.
Never guess or fabricate numbers. For Aadhaar number, only include digits you clearly see (often 12 digits, sometimes shown grouped); omit if uncertain.
Return strictly one JSON object with these string keys only: fullName, fatherName, dob, gender, aadhaarNumber, address, pincode, district, state.
Use "" for missing fields. For dob prefer DD/MM/YYYY as printed. Normalize gender to common English labels (Male, Female, Other) when clear.`;

const USER_TEXT =
  "Extract visible Aadhaar fields from this image into the JSON schema described in your instructions.";

function normalizeImageUrl(image: string): string | null {
  const trimmed = image.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (/^[a-z0-9+/=\s]+$/i.test(trimmed) && trimmed.length > 100) {
    return `data:image/jpeg;base64,${trimmed.replace(/\s/g, "")}`;
  }
  return null;
}

function parseJsonFromContent(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

function coerceProfile(parsed: unknown): ProfileData {
  if (!parsed || typeof parsed !== "object")
    return {};
  const src = parsed as Record<string, unknown>;
  const out: ProfileData = {};
  for (const key of EXTRACT_KEYS) {
    const v = src[key as string];
    if (typeof v === "string") {
      const s = v.trim();
      if (s) out[key] = s;
    }
  }
  if (out.aadhaarNumber) {
    const digits = out.aadhaarNumber.replace(/\D/g, "");
    if (digits.length === 12) out.aadhaarNumber = digits;
    else if (digits.length >= 4) out.aadhaarNumber = digits;
    else delete out.aadhaarNumber;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!OPENROUTER_API_KEY) {
    console.error("[openrouter/aadhaar-extract] OPENROUTER_API_KEY missing");
    return NextResponse.json(
      { error: "Server missing OpenRouter configuration" },
      { status: 503 },
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageUrl = body.image ? normalizeImageUrl(body.image) : null;
  if (!imageUrl) {
    return NextResponse.json(
      { error: "Field 'image' must be a data URL (data:image/...;base64,...)" },
      { status: 400 },
    );
  }

  const base64Part = imageUrl.split(",")[1] ?? "";
  if (base64Part.length > 6_500_000) {
    return NextResponse.json(
      { error: "Image too large; try a lower resolution photo." },
      { status: 413 },
    );
  }

  const model = getOpenRouterVisionModel();

  const payloadBase = {
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: USER_TEXT },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
  } as const;

  try {
    let res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payloadBase,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const retryWithoutFormat =
        (res.status === 400 || res.status === 422) &&
        /response_format|json_object|structured/i.test(errText);
      if (retryWithoutFormat) {
        res = await fetch(OPENROUTER_CHAT_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payloadBase }),
        });
      }
      if (!res.ok) {
        const finalErr = retryWithoutFormat ? await res.text() : errText;
        console.error(
          "[openrouter/aadhaar-extract] OpenRouter error",
          res.status,
          finalErr,
        );
        return NextResponse.json(
          {
            error: "Vision request failed",
            detail: finalErr.slice(0, 500),
            modelTried: model,
          },
          { status: 502 },
        );
      }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "No completion content from model" },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromContent(content);
    } catch (e) {
      console.error("[openrouter/aadhaar-extract] JSON parse", e, content.slice(0, 200));
      return NextResponse.json(
        { error: "Could not parse model response" },
        { status: 502 },
      );
    }

    const profile = coerceProfile(parsed);
    return NextResponse.json({ profile, modelUsed: model });
  } catch (err) {
    console.error("[openrouter/aadhaar-extract] fetch failed", err);
    return NextResponse.json(
      {
        error: "OpenRouter request failed",
        detail: String(err),
        hint:
          model !== DEFAULT_OPENROUTER_VISION_MODEL
            ? undefined
            : `Default model is ${DEFAULT_OPENROUTER_VISION_MODEL}; set OPENROUTER_VISION_MODEL if this provider rejects json_object or vision.`,
      },
      { status: 500 },
    );
  }
}
