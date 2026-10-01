import { NextRequest, NextResponse } from "next/server";
import type { ProfileData } from "@/lib/profile-vault";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import type { AgentPhase, MissionPlan } from "@/lib/agent-state";
import { getOpenRouterApiKey } from "@/lib/openrouter-config";
import { runAgentTurn, type AgentChatMessage } from "@/lib/agent-run";

export const runtime = "nodejs";

/**
 * SSE transport — streams live agent events (tool_start / tool_end / status)
 * as they happen, then a final `done` event carrying the same payload as the
 * JSON route's response.
 */
export async function POST(request: NextRequest) {
  const OPENROUTER_API_KEY = getOpenRouterApiKey();
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Server missing OpenRouter configuration" },
      { status: 503 },
    );
  }

  let body: {
    messages?: AgentChatMessage[];
    language?: IndianLanguageCode;
    images?: string[];
    profileSnapshot?: ProfileData;
    phase?: AgentPhase;
    screenShareActive?: boolean;
    plan?: MissionPlan;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      try {
        send("status", { message: "Thinking…" });
        const result = await runAgentTurn(
          {
            apiKey: OPENROUTER_API_KEY,
            messages: body.messages ?? [],
            language: body.language ?? ("en" as IndianLanguageCode),
            images: body.images,
            profileSnapshot: body.profileSnapshot ?? {},
            phase: body.phase ?? "greeting",
            screenShareActive: body.screenShareActive ?? false,
            plan: body.plan,
          },
          (evt) => send(evt.event, evt.data),
        );
        send("done", result);
      } catch (err) {
        send("error", {
          error: err instanceof Error ? err.message : "Agent request failed",
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by client disconnect */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
