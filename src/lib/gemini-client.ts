/**
 * Direct Google Gemini client — bypasses OpenRouter's balance gates for
 * vision, PDF reading, and text generation on the free-tier API key.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}

export type GeminiInputPart =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string }
  | { type: "pdf"; dataUrl: string };

function toGeminiParts(parts: GeminiInputPart[]): Record<string, unknown>[] {
  return parts.map((part) => {
    if (part.type === "text") return { text: part.text };
    const dataUrl = part.dataUrl;
    const commaIdx = dataUrl.indexOf(",");
    const meta = dataUrl.slice(0, commaIdx);
    const mimeMatch = meta.match(/data:([^;]+)/);
    return {
      inline_data: {
        mime_type: mimeMatch?.[1] ?? "application/octet-stream",
        data: dataUrl.slice(commaIdx + 1),
      },
    };
  });
}

/**
 * Single-turn generateContent. Returns extracted text, or null on any
 * failure (missing key, quota, network) so callers can degrade gracefully.
 */
export async function geminiGenerate(opts: {
  system?: string;
  userParts: GeminiInputPart[];
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string | null> {
  const key = getGeminiApiKey();
  if (!key) return null;

  // gemini-3.5-flash — newest generation this key's project can generate with
  // (gemini-2.5-* is deprecated for new keys; -latest aliases hit 503 demand spikes)
  const model = opts.model ?? (process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash");
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: toGeminiParts(opts.userParts) }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  try {
    const res = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      console.error("[gemini]", model, res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const out = data.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    return out || null;
  } catch (err) {
    console.error("[gemini] request failed", err);
    return null;
  }
}
