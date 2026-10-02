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
  const models = [
    ...new Set(
      [
        opts.model ?? undefined,
        process.env.GEMINI_MODEL?.trim() || undefined,
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.8-flash",
        "gemini-flash-lite-latest",
      ].filter((m): m is string => !!m),
    ),
  ];
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

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          // 429s are per-minute quota windows — one short backoff usually clears
          await new Promise((r) => setTimeout(r, 2500));
        }
        const res = await fetch(
          `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (res.status === 429 && attempt === 0) {
          console.error("[gemini]", model, "429 — retrying after backoff");
          continue;
        }
        if (!res.ok) {
          console.error("[gemini]", model, res.status, (await res.text()).slice(0, 300));
          break;
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
        if (out) return out;
      } catch (err) {
        console.error("[gemini]", model, "request failed", err);
        break;
      }
    }
  }
  return null;
}
