import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterAgentModel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!OPENROUTER_API_KEY)
    return NextResponse.json(
      { error: "Server missing OpenRouter configuration" },
      { status: 503 },
    );

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image)
    return NextResponse.json({ error: "image required" }, { status: 400 });

  const model = getOpenRouterAgentModel();

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are analyzing a scanned government form image. Do two things:
1. Detect the primary language of the form.
2. Extract every fillable field.

Return a single JSON object:
{
  "language": "<ISO 639-1 code>",
  "languageName": "<language name>",
  "fields": [
    {
      "label": "<label as printed>",
      "labelEnglish": "<English translation>",
      "value": "<pre-filled value or empty string>",
      "type": "text|checkbox|date|number|select",
      "required": true/false,
      "x": <percentage 0-100>,
      "y": <percentage 0-100>,
      "width": <percentage 0-100>,
      "height": <percentage 0-100>
    }
  ]
}

Be thorough — include every single field. Coordinates are approximate percentages of image dimensions (0=top/left, 100=bottom/right).`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Scan this form and extract all fields." },
              { type: "image_url", image_url: { url: body.image } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[agent/scan-form]", res.status, err);
      return NextResponse.json(
        { error: "Scan failed", detail: err.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Parse JSON from response (handle markdown fences)
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : content;

    try {
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({ ...parsed, model });
    } catch {
      return NextResponse.json(
        { error: "Could not parse scan result", rawText: content },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("[agent/scan-form]", err);
    return NextResponse.json(
      { error: "Scan request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
