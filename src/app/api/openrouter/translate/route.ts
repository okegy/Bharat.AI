import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterTranslateModel,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Server missing OpenRouter configuration" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    input: string;
    sourceLanguageCode?: string;
    targetLanguageCode: string;
  };

  if (!body.input?.trim() || !body.targetLanguageCode)
    return NextResponse.json(
      { error: "input and targetLanguageCode required" },
      { status: 400 },
    );

  const targetLabel = getVoiceLangLabel(body.targetLanguageCode);
  const sourceNote =
    body.sourceLanguageCode && body.sourceLanguageCode !== "auto"
      ? `Source locale hint: ${body.sourceLanguageCode}.`
      : "Source: English (India) app strings.";

  const model = getOpenRouterTranslateModel();

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You translate UI text for a government-forms app. Output only the translation — no quotes, labels, or explanations.",
          },
          {
            role: "user",
            content: `${sourceNote} Translate into ${targetLabel}:\n\n${body.input}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[openrouter/translate]", res.status, err);
      return NextResponse.json(
        { error: "Translate failed", detail: err.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const out = data.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({
      translated_text: out || body.input,
      model,
    });
  } catch (err) {
    console.error("[openrouter/translate]", err);
    return NextResponse.json(
      { error: "Translate request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
