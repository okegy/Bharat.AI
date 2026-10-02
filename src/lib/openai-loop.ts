/**
 * OpenAI-compatible agentic loop — shared by OpenRouter and Groq brains.
 * Runs the full tool-calling turn: model → tool_calls → executeTool → repeat.
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
  model: string;
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

  for (let i = 0; i < 10; i++) {
    let res: Response;
    try {
      res = await fetch(opts.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          tools: opts.tools,
          tool_choice: "auto",
          temperature: 0.4,
          max_tokens: maxTokens,
        }),
      });
    } catch (err) {
      console.error("[openai-loop]", opts.model, "fetch failed", err);
      return null;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[openai-loop]", opts.model, res.status, errText.slice(0, 200));
      // One fast retry on transient throttling/errors
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          res = await fetch(opts.baseUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${opts.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: opts.model,
              messages,
              tools: opts.tools,
              tool_choice: "auto",
              temperature: 0.4,
              max_tokens: maxTokens,
            }),
          });
        } catch {
          return null;
        }
        if (!res.ok) return null;
      } else {
        return null;
      }
    }

    const data = (await res.json()) as {
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
    };
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
      model: opts.model,
    };
  }

  return {
    reply: "I'm having trouble processing that. Could you try again?",
    profileUpdates,
    nextAction: nextAction ?? { type: "none" },
    toolsUsed: [...new Set(toolsUsed)],
    plan: opts.toolCtx.plan,
    model: opts.model,
  };
}
