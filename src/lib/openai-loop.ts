/**
 * OpenAI-compatible agentic loop — shared by OpenRouter, Groq, and Ollama
 * brains. Runs the full tool-calling turn: model → tool_calls → executeTool
 * → repeat.
 *
 * Multi-key support: pass `apiKeys` and every key is tried against the model
 * chain — each key has its own rate pool, so keys from separate accounts
 * stack capacity instead of just adding redundancy.
 */

import { executeTool, type ToolContext } from "@/lib/agent-tools";
import type { ProfileData } from "@/lib/profile-vault";
import type { MissionPlan } from "@/lib/agent-state";

export interface LoopMessage {
  role: string;
  content: unknown;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AgentEmitter = (e: { event: string; data: unknown }) => void;

export interface OpenAILoopParams {
  baseUrl: string;
  apiKey: string;
  /** Additional keys — tried in order when earlier ones are rate-limited. */
  apiKeys?: string[];
  model: string;
  /** Extra models to try when the primary is rate-limited (429/TPM). */
  altModels?: string[];
  system: string;
  messages: LoopMessage[];
  tools: OpenAITool[];
  toolCtx: ToolContext;
  profileSnapshot: ProfileData;
  emit?: AgentEmitter;
  actionLabel?: (tool: string) => string;
  describe?: (tool: string, result: unknown) => string | undefined;
  maxTokens?: number;
}

export interface OpenAILoopResult {
  reply: string;
  profileUpdates?: Record<string, string>;
  filledFormData?: Record<string, string>;
  nextAction: unknown;
  toolsUsed: string[];
  plan?: MissionPlan;
  model: string;
}

interface ChatChoice {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

export async function runOpenAILoop(opts: OpenAILoopParams): Promise<OpenAILoopResult | null> {
  const messages: LoopMessage[] = [
    { role: "system", content: opts.system },
    ...opts.messages,
  ];
  let profileUpdates: Record<string, string> | undefined;
  let filledFormData: Record<string, string> | undefined;
  const toolsUsed: string[] = [];
  let nextAction: unknown;
  const maxTokens = opts.maxTokens ?? 1500;

  const keys = [...new Set([opts.apiKey, ...(opts.apiKeys ?? [])])].filter(Boolean);
  const modelChain = [...new Set([opts.model, ...(opts.altModels ?? [])])];
  // Keys × models cross-product: every combination is a separate rate pool.
  const attempts: Array<{ key: string; model: string }> = [];
  for (const key of keys) {
    for (const model of modelChain) {
      attempts.push({ key, model });
    }
  }
  let servedModel = opts.model;

  async function chatAttempt(model: string, key: string): Promise<Response> {
    return fetch(opts.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: opts.tools,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
    });
  }

  async function tryOnce(): Promise<ChatChoice | null> {
    for (const { key, model } of attempts) {
      let res: Response;
      try {
        res = await chatAttempt(model, key);
      } catch (err) {
        console.error("[openai-loop]", model, "fetch failed", err);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("[openai-loop]", model, res.status, errText.slice(0, 200));
        if (res.status === 429 || res.status >= 500) {
          // One fast retry, then move to the next pool (key or model)
          await new Promise((r) => setTimeout(r, 1200));
          try {
            res = await chatAttempt(model, key);
          } catch {
            continue;
          }
          if (!res.ok) continue;
        } else {
          // 400/401/403 — configuration issue, but a DIFFERENT key may still
          // work, so keep trying the remaining combinations.
          continue;
        }
      }

      servedModel = model;
      return (await res.json()) as ChatChoice;
    }
    return null;
  }

  for (let i = 0; i < 10; i++) {
    const data = await tryOnce();
    if (!data) return null;

    const assistantMsg = data.choices?.[0]?.message;
    if (!assistantMsg) return null;

    if (assistantMsg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? "",
        tool_calls: assistantMsg.tool_calls,
      });

      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

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
            opts.toolCtx.plan = r.plan as MissionPlan;
          }
          if ("clientAction" in r) {
            const a = r as Record<string, unknown>;
            if (a.clientAction === "open_camera")
              nextAction = { type: "open_camera", purpose: a.purpose };
            else if (a.clientAction === "start_screen_share")
              nextAction = { type: "start_screen_share" };
            else if (a.clientAction === "navigate") nextAction = { type: "navigate", url: a.url };
            else if (a.clientAction === "listen_voice")
              nextAction = { type: "listen_voice", prompt: a.prompt };
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
            nextAction = {
              type: "generate_pdf_client",
              filledFields: { ...opts.profileSnapshot, ...agentFields },
            };
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    return {
      reply: assistantMsg.content?.trim() ?? "",
      profileUpdates,
      filledFormData,
      nextAction: nextAction ?? { type: "none" },
      toolsUsed: [...new Set(toolsUsed)],
      plan: opts.toolCtx.plan,
      model: servedModel,
    };
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
