import { NextRequest, NextResponse } from "next/server";
import type { ProfileData } from "@/lib/profile-vault";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import type { AgentPhase, MissionPlan } from "@/lib/agent-state";
import { getOpenRouterApiKey } from "@/lib/openrouter-config";
import { runAgentTurn, type AgentChatMessage } from "@/lib/agent-run";

/**
 * JSON transport — the agent logic (OpenRouter loop with token caps, the full
 * Gemini agentic fallback, tool tracking) lives in src/lib/agent-run.ts and is
 * shared with the SSE stream route.
 */
export async function POST(request: NextRequest) {
  const OPENROUTER_API_KEY = getOpenRouterApiKey();
  if (!OPENROUTER_API_KEY)
    return NextResponse.json(
      { error: "Server missing OpenRouter configuration" },
      { status: 503 },
    );

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

  try {
    const result = await runAgentTurn({
      apiKey: OPENROUTER_API_KEY,
      messages: body.messages ?? [],
      language: body.language ?? ("en" as IndianLanguageCode),
      images: body.images,
      profileSnapshot: body.profileSnapshot ?? {},
      phase: body.phase ?? "greeting",
      screenShareActive: body.screenShareActive ?? false,
      plan: body.plan,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[agent/chat] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent request failed" },
      { status: 502 },
    );
  }
}
