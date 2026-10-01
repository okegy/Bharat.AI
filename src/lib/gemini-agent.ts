/**
 * Gemini native function-calling agent loop — full agentic brain on the free
 * tier. Used as the automatic fallback when OpenRouter is unavailable
 * (balance gate / outage), so missions, scheme lookups, and form fills keep
 * working with zero cost.
 */

import { executeTool, type ToolContext } from "@/lib/agent-tools";
import type { ProfileData } from "@/lib/profile-vault";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ITERATIONS = 10;

export function getAgentGeminiKey(): string {
  return (process.env.GEMINI_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}

/** Structural mirrors of agent-run's shapes (avoids an import cycle). */
export interface LoopMessage {
  role: string;
  content: unknown;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

type OpenAITool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type AgentEmitter = (e: { event: string; data: unknown }) => void;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
  [key: string]: unknown;
}

/** Gemini rejects unknown schema fields — strip OpenAI-only ones. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (typeof schema !== "object" || schema === null) return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties" || k === "$schema") continue;
    out[k] = k === "properties" || k === "items" ? toGeminiSchema(v) : v;
  }
  return out;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === "object" && "text" in p && typeof (p as { text?: unknown }).text === "string"
          ? (p as { text: string }).text
          : "",
      )
      .join("");
  }
  return "";
}

function toParts(content: unknown): GeminiPart[] {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  if (Array.isArray(content)) {
    return content.map((p) => {
      const part = p as { type?: string; text?: string; image_url?: { url?: string } };
      if (part.type === "text" && part.text) return { text: part.text } as GeminiPart;
      const url = part.image_url?.url;
      if (url?.startsWith("data:")) {
        const comma = url.indexOf(",");
        const mime = url.slice(5, url.indexOf(";")) || "image/jpeg";
        return { inlineData: { mimeType: mime, data: url.slice(comma + 1) } } as GeminiPart;
      }
      return { text: "" } as GeminiPart;
    });
  }
  return [];
}

function convertMessages(messages: LoopMessage[]): {
  system: string;
  contents: Array<{ role: string; parts: GeminiPart[] }>;
} {
  let system = "";
  const contents: Array<{ role: string; parts: GeminiPart[] }> = [];
  const idToName = new Map<string, string>();

  for (const m of messages) {
    if (m.role === "system") {
      system += textOf(m.content) + "\n";
      continue;
    }
    if (m.role === "user") {
      const parts = toParts(m.content);
      if (parts.length) contents.push({ role: "user", parts });
      continue;
    }
    if (m.role === "assistant") {
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        const parts: GeminiPart[] = [];
        const text = textOf(m.content);
        if (text) parts.push({ text });
        for (const tc of m.tool_calls) {
          idToName.set(tc.id, tc.function.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            args = {};
          }
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
        contents.push({ role: "model", parts });
        continue;
      }
      const text = textOf(m.content);
      if (text) contents.push({ role: "model", parts: [{ text }] });
      continue;
    }
    if (m.role === "tool") {
      const name = idToName.get(m.tool_call_id ?? "") ?? "unknown_tool";
      let result: unknown = m.content;
      if (typeof m.content === "string") {
        try {
          result = JSON.parse(m.content);
        } catch {
          result = { output: m.content };
        }
      }
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name, response: { result } } }],
      });
      continue;
    }
  }
  return { system, contents };
}

export async function runGeminiAgentTurn(opts: {
  system: string;
  messages: LoopMessage[];
  tools: OpenAITool[];
  toolCtx: ToolContext;
  profileSnapshot: ProfileData;
  emit?: AgentEmitter;
  actionLabel?: (tool: string) => string;
  describe?: (tool: string, result: unknown) => string | undefined;
}): Promise<{
  reply: string;
  profileUpdates?: Record<string, string>;
  filledFormData?: Record<string, string>;
  nextAction: unknown;
  toolsUsed: string[];
  plan?: MissionPlanShape;
  model: string;
} | null> {
  const key = getAgentGeminiKey();
  if (!key) return null;

  // Failover chain — individual Gemini models flap under load (503); the
  // aliases rotate availability. First success wins.
  const MODELS = [
    ...new Set([
      process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-flash-lite-latest",
    ]),
  ];
  let servedModel = MODELS[0];

  async function callGeminiWithFailover(
    body: Record<string, unknown>,
  ): Promise<{ candidates?: Array<{ content?: { parts?: GeminiPart[] } }> } | null> {
    for (const model of MODELS) {
      try {
        const res = await fetch(
          `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (res.ok) {
          servedModel = model;
          return (await res.json()) as {
            candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
          };
        }
        console.error("[gemini-agent]", model, res.status, (await res.text()).slice(0, 200));
      } catch (err) {
        console.error("[gemini-agent]", model, "failed", err);
      }
    }
    return null;
  }
  const { system, contents } = convertMessages(opts.messages);
  const functionDeclarations = opts.tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: toGeminiSchema(t.function.parameters) as Record<string, unknown>,
  }));

  let profileUpdates: Record<string, string> | undefined;
  let filledFormData: Record<string, string> | undefined;
  const toolsUsed: string[] = [];
  let nextAction: unknown;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const body: Record<string, unknown> = {
      contents,
      tools: [{ function_declarations: functionDeclarations }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    if (system.trim()) body.systemInstruction = { parts: [{ text: system }] };

    const data = await callGeminiWithFailover(body);
    if (!data) return null;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const fnCalls = parts
      .map((p) => p.functionCall)
      .filter((fc): fc is { name: string; args?: Record<string, unknown> } => !!fc);
    const text = parts
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text as string)
      .join("")
      .trim();

    if (fnCalls.length === 0) {
      if (!text && i === 0) return null; // empty first response — let caller degrade
      return {
        reply: text || "I'm here! Could you say that once more?",
        profileUpdates,
        filledFormData,
        nextAction: nextAction ?? { type: "none" },
        toolsUsed: [...new Set(toolsUsed)],
        plan: opts.toolCtx.plan,
        model: servedModel,
      };
    }

    contents.push({ role: "model", parts });

    for (const fc of fnCalls) {
      const toolName = fc.name;
      const args = (fc.args ?? {}) as Record<string, unknown>;
      toolsUsed.push(toolName);

      const action = opts.actionLabel?.(toolName) ?? "Working";
      opts.emit?.({ event: "tool_start", data: { tool: toolName, action } });
      const result = await executeTool(toolName, args, opts.toolCtx);
      opts.emit?.({
        event: "tool_end",
        data: { tool: toolName, action, summary: opts.describe?.(toolName, result) },
      });

      if (result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        if (toolName === "update_user_profile" && "fields" in r) {
          profileUpdates = { ...profileUpdates, ...(r.fields as Record<string, string>) };
        }
        if (toolName === "fill_form_fields" && "filled" in r) {
          filledFormData = r.filled as Record<string, string>;
        }
        if ((toolName === "create_plan" || toolName === "update_plan") && "plan" in r) {
          opts.toolCtx.plan = r.plan as MissionPlanShape;
        }
        if ("clientAction" in r) {
          const a = r as Record<string, unknown>;
          if (a.clientAction === "open_camera") nextAction = { type: "open_camera", purpose: a.purpose };
          else if (a.clientAction === "start_screen_share") nextAction = { type: "start_screen_share" };
          else if (a.clientAction === "navigate") nextAction = { type: "navigate", url: a.url };
          else if (a.clientAction === "listen_voice") nextAction = { type: "listen_voice", prompt: a.prompt };
          else if (a.clientAction === "download_form")
            nextAction = {
              type: "download_form",
              formName: a.formName,
              formNameHi: a.formNameHi,
              downloadPath: a.downloadPath,
            };
        }
        if (toolName === "generate_filled_pdf" && "action" in r) {
          const agentFields = (r.filledFields ?? {}) as Record<string, string>;
          nextAction = { type: "generate_pdf_client", filledFields: { ...opts.profileSnapshot, ...agentFields } };
        }
      }

      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: toolName, response: { result } } }],
      });
    }
  }

  return {
    reply: "I'm having trouble processing that. Could you try again?",
    profileUpdates,
    nextAction: nextAction ?? { type: "none" },
    toolsUsed: [...new Set(toolsUsed)],
    plan: opts.toolCtx.plan,
    model: servedModel,
  };
}

interface MissionPlanShape {
  goal: string;
  steps: { label: string; status: "pending" | "active" | "done" }[];
}
