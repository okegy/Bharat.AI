import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterSttModel,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

function formatFromMime(mime: string): string {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "wav";
}

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

  const formData = await request.formData();
  const audioFile = formData.get("audio") as Blob | null;
  const languageCode = (formData.get("languageCode") as string) ?? "";

  if (!audioFile?.size)
    return NextResponse.json({ error: "audio file required" }, { status: 400 });

  const buf = Buffer.from(await audioFile.arrayBuffer());
  const base64Audio = buf.toString("base64");
  const audioFormat = formatFromMime(audioFile.type || "audio/wav");

  const model = getOpenRouterSttModel();

  const langLabel = languageCode ? getVoiceLangLabel(languageCode) : "";
  const scriptHint = languageCode?.startsWith("en")
    ? "You MUST output in English using Latin script only."
    : langLabel
      ? `You MUST output in ${langLabel} using its native script.`
      : "";

  const textHint = languageCode
    ? `Transcribe this audio. The speaker is using ${langLabel || languageCode}. ${scriptHint} Output only the spoken words — no translation to other languages, no labels, no quotation marks.`
    : `Transcribe this audio. Output only the spoken words — no translation, labels, or quotation marks.`;

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: textHint },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: audioFormat,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[openrouter/stt]", res.status, err);
      return NextResponse.json(
        { error: "STT request failed", detail: err.slice(0, 500), model },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    let transcript = "";
    if (typeof content === "string") transcript = content.trim();
    else if (Array.isArray(content)) {
      transcript = content
        .map((p) =>
          typeof p === "object" &&
          p &&
          "text" in p &&
            typeof (p as { text?: string }).text === "string"
            ? (p as { text: string }).text
            : "",
        )
        .join("")
        .trim();
    }

    transcript = transcript.replace(/^["']|["']$/g, "").trim();

    return NextResponse.json({
      transcript,
      language_code: languageCode,
      model,
    });
  } catch (err) {
    console.error("[openrouter/stt] fetch failed", err);
    return NextResponse.json(
      { error: "STT request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
