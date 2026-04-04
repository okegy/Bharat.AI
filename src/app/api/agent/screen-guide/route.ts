import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import {
  getOpenRouterAgentModel,
  getVoiceLangLabel,
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

  let body: {
    screenshot: string;
    schemeId?: string;
    previousContext?: string;
    language: IndianLanguageCode;
    profileFields?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.screenshot)
    return NextResponse.json(
      { error: "screenshot required" },
      { status: 400 },
    );

  const langLabel = getVoiceLangLabel(
    body.language.includes("-") ? body.language : `${body.language}-IN`,
  );
  const model = getOpenRouterAgentModel();

  const profileContext = body.profileFields
    ? `\nUser's data that may need to be entered: ${JSON.stringify(body.profileFields)}`
    : "";

  const prevContext = body.previousContext
    ? `\nPrevious step context: ${body.previousContext}`
    : "";

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are a patient voice assistant guiding an Indian citizen through a government website. Respond in ${langLabel}.

Analyze the screenshot and provide:
1. A brief spoken instruction (1-2 sentences in ${langLabel}) telling the user exactly what to do next
2. Identify any form fields that need to be filled
3. Suggest the next action (click button, type text, scroll, etc.)

Return JSON: {
  "instruction": "<spoken instruction in ${langLabel}>",
  "detectedFields": ["field1", "field2"],
  "suggestedAction": "<what to do next>",
  "fieldValues": { "fieldName": "value from user profile" }
}

If the user needs to type, remind them they can use the mic icon on their phone keyboard to speak instead of typing.${profileContext}${prevContext}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What should I do on this screen?",
              },
              {
                type: "image_url",
                image_url: { url: body.screenshot },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[agent/screen-guide]", res.status, err);
      return NextResponse.json(
        { error: "Guide request failed", detail: err.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Parse JSON from response
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : content;

    try {
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({ ...parsed, model });
    } catch {
      // If not JSON, treat the whole response as the instruction
      return NextResponse.json({
        instruction: content,
        detectedFields: [],
        suggestedAction: "",
        model,
      });
    }
  } catch (err) {
    console.error("[agent/screen-guide]", err);
    return NextResponse.json(
      { error: "Guide request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
