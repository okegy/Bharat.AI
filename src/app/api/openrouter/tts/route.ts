import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterAudioOutputFormat,
  getOpenRouterTtsModel,
  getOpenRouterTtsVoice,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";
import { collectStreamingAudioBase64 } from "@/lib/openrouter-stream-audio";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

/** Wrap raw PCM16 samples in a WAV header so the browser can play it. */
function pcm16ToWav(pcmData: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataLength = pcmData.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // PCM format chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  header.writeUInt16LE(numChannels * bytesPerSample, 32);
  header.writeUInt16LE(16, 34);           // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmData]);
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

  const { text, languageCode } = (await request.json()) as {
    text: string;
    languageCode: string;
    speaker?: string;
    pace?: number;
  };

  if (!text?.trim() || !languageCode)
    return NextResponse.json(
      { error: "text and languageCode required" },
      { status: 400 },
    );

  const slice = text.slice(0, 2500);
  const label = getVoiceLangLabel(languageCode);
  const model = getOpenRouterTtsModel();
  const voice = getOpenRouterTtsVoice();
  // Streaming ONLY supports pcm16 — wav/mp3 are rejected with stream:true
  const streamFormat = "pcm16";

  const userPrompt =
    `You are a warm, natural-sounding voice assistant speaking ${label} to an Indian citizen. ` +
    `Read the following text aloud as natural speech. ` +
    `Do NOT read punctuation marks, symbols, special characters, or formatting — just speak the words naturally. ` +
    `Do NOT add any preamble, commentary, or translation. Just speak the content:\n\n${slice}`;

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: userPrompt }],
        modalities: ["text", "audio"],
        audio: { voice, format: streamFormat },
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[openrouter/tts]", res.status, err);
      return NextResponse.json(
        { error: "TTS request failed", detail: err.slice(0, 500), model },
        { status: 502 },
      );
    }

    const { audioB64 } = await collectStreamingAudioBase64(res);
    if (!audioB64)
      return NextResponse.json(
        { error: "Empty audio from model", model },
        { status: 502 },
      );

    // Convert PCM16 base64 to WAV base64 for browser playback
    const pcmBuf = Buffer.from(audioB64, "base64");
    const sampleRate = 24000; // OpenAI audio models output 24kHz
    const wavBuf = pcm16ToWav(pcmBuf, sampleRate);

    return NextResponse.json({
      audios: [wavBuf.toString("base64")],
      model,
      format: "wav",
    });
  } catch (err) {
    console.error("[openrouter/tts] failed", err);
    return NextResponse.json(
      { error: "TTS request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
