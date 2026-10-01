import { NextRequest, NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini-client";
import {
  getOpenRouterApiKey,
  getOpenRouterTranslateModel,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

export async function POST(request: NextRequest) {
  const OPENROUTER_API_KEY = getOpenRouterApiKey();

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

      // Gemini fallback — keeps translations alive through balance gates
      const geminiText = await geminiGenerate({
        system: "You are a translation engine. Output ONLY the translation — no commentary, no quotes.",
        userParts: [{
          type: "text",
          text: `Translate the following text from ${body.sourceLanguageCode ?? "the source language"} to ${body.targetLanguageCode}:\n\n${body.input}`,
        }],
        temperature: 0.1,
      });
      if (geminiText) {
        return NextResponse.json({ translated: geminiText.trim(), provider: "gemini" });
      }

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
