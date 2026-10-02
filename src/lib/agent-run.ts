/**
 * BharatLink agent orchestrator — one conversation turn.
 *
 * Brain chain (first success wins, every failure degrades gracefully):
 *   1. OpenRouter (gpt-4o-mini)       — premium path, used when balance > 0
 *   2. Groq (llama-3.3-70b-versatile) — free, fast, fresh quota pool
 *   3. Gemini (native function-calling loop, gemini-agent.ts)
 *   4. Gemini text-only reply
 *   5. Graceful spoken message — raw provider errors never reach the user
 */

import type { ProfileData } from "@/lib/profile-vault";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import type { AgentPhase, MissionPlan } from "@/lib/agent-state";
import { getToolDefinitions } from "@/lib/agent-tools";
import {
  getOpenRouterAgentModel,
  getOpenRouterApiKey,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";
import { geminiGenerate } from "@/lib/gemini-client";
import { runGeminiAgentTurn } from "@/lib/gemini-agent";
import {
  runOpenAILoop,
  type AgentEmitter,
  type LoopMessage,
} from "@/lib/openai-loop";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** GROQ_API_KEY, GROQ_API_KEY_2 … _9 — every key is its own free rate pool. */
function getGroqKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 10; i++) {
    const name = i === 0 ? "GROQ_API_KEY" : `GROQ_API_KEY_${i}`;
    const v = (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");
    if (v) out.push(v);
  }
  return out;
}
const GROQ_MODEL = process.env.GROQ_AGENT_MODEL?.trim() || "openai/gpt-oss-120b";

/** After OpenRouter refuses, stop trying it for 5 minutes. */
let openrouterCooldownUntil = 0;

export interface AgentChatMessage {
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

export interface AgentRunInput {
  apiKey: string;
  messages: AgentChatMessage[];
  language: IndianLanguageCode;
  images?: string[];
  profileSnapshot: ProfileData;
  phase: AgentPhase;
  screenShareActive: boolean;
  plan?: MissionPlan;
}

export interface AgentRunResult {
  reply: string;
  profileUpdates?: Record<string, string>;
  filledFormData?: Record<string, string>;
  nextAction: unknown;
  toolsUsed: string[];
  model: string;
  plan?: MissionPlan;
}

export type AgentEvent =
  | { event: "status"; data: { message: string } }
  | { event: "tool_start"; data: { tool: string; action: string } }
  | { event: "tool_end"; data: { tool: string; action: string; summary?: string } };

function buildSystemPrompt(
  language: IndianLanguageCode,
  profile: ProfileData,
  phase: AgentPhase,
  screenShareActive: boolean,
  plan?: MissionPlan,
): string {
  const langLabel = getVoiceLangLabel(
    language.includes("-") ? language : `${language}-IN`,
  );

  const profileSummary = Object.entries(profile)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const phaseInstructions: Record<AgentPhase, string> = {
    greeting:
      "Welcome the user warmly. Tell them you can help with: finding government schemes they qualify for, filling offline forms, or guiding them through online applications. Ask what they need help with.",
    "profile-review":
      "Review the user's profile and ask for any missing important fields like phone, education, marital status. Be conversational.",
    "path-choice":
      "Ask if the user has a physical form to fill (offline) or wants to apply on a government website (online). Explain both options briefly.",
    "scheme-recommend":
      "Use find_eligible_schemes to show the user what they qualify for. Explain each scheme's benefit in simple terms. Ask if they want to apply for any. CRITICAL: When the user says they want to apply for a scheme, you MUST call these tools in order: 1) get_scheme_details to get the portalUrl, 2) open_portal tool with that URL. Do NOT just tell the user the URL in text — you MUST call the open_portal tool. After calling open_portal, tell the user: 'I have added the portal link below. Please click the green Open Portal button to open the website. Once it opens, I will start screen sharing to guide you through the form.' ALWAYS mention they need to click the button.",
    "offline-scan":
      `The user uploaded a form. Execute this EXACT sequence — do NOT stop or respond until all steps are done:

STEP 1: Call detect_form_language on the image.
STEP 2: Call extract_form_fields on the image.
STEP 3: Call fill_form_fields with the extracted fields.
STEP 4: Check the result of fill_form_fields:
  - Look at the "missing" array. If it has items, list them and ASK the user for those fields ONE at a time.
  - Look at the "filled" object. Tell the user how many fields were auto-filled.
  - If "missing" is empty, IMMEDIATELY proceed to STEP 5.
STEP 5: Call generate_filled_pdf to create the downloadable PDF.

NEVER say "the form is filled" without calling generate_filled_pdf.
NEVER wait for the user to ask for the PDF — generate it automatically.
If there ARE missing fields, ask for them FIRST, then generate the PDF once the user provides them.`,
    "offline-fill":
      "The user is providing missing field values. After they give a value, update the filled fields and ask for the next missing one. Once ALL missing fields are collected OR if the user says to skip/proceed/continue without them ('bhar do', 'chhod do', 'aage badho', 'skip', 'proceed', 'fill without'), IMMEDIATELY call generate_filled_pdf with whatever fields are filled so far. Do NOT keep asking if the user wants to skip — just generate the PDF.",
    "offline-generate":
      "Call generate_filled_pdf NOW to create the PDF. Tell the user their filled form PDF is being downloaded.",
    "online-guide":
      "You are guiding the user through a government website via screen sharing. CRITICAL RULES: 1) You CANNOT type or click anything — you can ONLY see the screen and give spoken instructions. 2) Never ask the user to tell you any details — you ALREADY have their profile data. Just tell them what to type directly. 3) Read the exact values from the user's profile and dictate them. 4) For long numbers like Aadhaar, dictate SLOWLY in groups of 4 digits, then REPEAT the full number. Example: 'Please type your Aadhaar number: 4767... 1659... 1624. I repeat: 4-7-6-7, 1-6-5-9, 1-6-2-4.' 5) Remind them they can tap the mic icon on their keyboard to speak instead of typing. 6) Be very specific: 'Type Riya Raja Tiwari in the Name field' not 'Fill in your name'. 7) For captchas, tell the user to read and type it themselves. 8) Guide one field at a time, wait for the next screenshot to confirm before moving on.",
    complete:
      "The task is done. Ask if they need help with anything else.",
  };

  const screenNote = screenShareActive
    ? "\nScreen sharing is ACTIVE. You will receive periodic screenshots. Analyze them and guide the user."
    : "";

  const missionNote = plan
    ? `\n\nMISSION IN PROGRESS — ${plan.goal}
${plan.steps.map((s, i) => `${i + 1}. [${s.status.toUpperCase()}] ${s.label}`).join("\n")}

Work ONLY on the ACTIVE step right now, using tools. The moment a step's work is finished, call update_plan with that step number and status "done" — the next step becomes active automatically. Then immediately start working on it.
Keep replies short and focused on the current step. NEVER call create_plan again for this mission. If the user asks something unrelated to the mission, answer it helpfully first (tools are allowed), then steer back to the active step. When ALL steps are done, congratulate the user and summarize what was accomplished.`
    : "\n\nWhen the user states a goal that needs several actions (e.g., 'apply for PM-KISAN', 'scan my form then fill it', or anything needing 2+ phases of work), FIRST call create_plan with a one-line goal and 3-6 short concrete steps, THEN immediately start executing step 1 with tools.";

  return `You are BharatLink, a kind and patient voice assistant helping Indian citizens access government schemes and fill forms. You communicate in ${langLabel}.

RULES:
- Always respond in ${langLabel}. Never switch languages unless the user does.
- Keep responses short (1-3 sentences). They will be read aloud via text-to-speech.
- Ask one question at a time. Be patient and clear.
- Never fabricate information. Use the user's profile data when available.
- When helping with forms, be thorough — check every field.
- IMPORTANT: When guiding on a government website, you can ONLY SEE the screen — you CANNOT type, click, or interact with it. Never say "I will fill this" or "I can enter this for you". Always say "Please type..." or "Please click...". Tell the user the exact value to type from their profile.
- When the user wants to apply for a scheme, ALWAYS call open_portal with the portal URL — this opens the website AND auto-prompts screen sharing. Never just say "please share your screen" or tell the URL in text — use the open_portal tool so it happens automatically.
- When dictating numbers (Aadhaar, phone, pincode), read them SLOWLY in groups, then REPEAT. Example: "4-7-6-7, 1-6-5-9, 1-6-2-4. I repeat: 4767, 1659, 1624."

USER PROFILE:
${profileSummary || "No profile data yet."}

CURRENT PHASE: ${phase}
${phaseInstructions[phase]}${screenNote}${missionNote}`;
}

/** Human action line shown live in the UI while a tool runs. */
const TOOL_ACTION_LABELS: Record<string, string> = {
  get_user_profile: "Reading your profile vault",
  update_user_profile: "Updating your profile",
  find_eligible_schemes: "Checking which schemes you qualify for",
  get_scheme_details: "Looking up scheme details",
  translate_text: "Translating",
  scan_document: "Reading your document",
  detect_form_language: "Detecting the form's language",
  extract_form_fields: "Extracting form fields",
  fill_form_fields: "Filling fields from your profile",
  generate_filled_pdf: "Generating your filled PDF",
  analyze_screenshot: "Looking at your screen",
  generate_guidance: "Preparing step-by-step guidance",
  get_application_form: "Finding the application form",
  request_camera: "Asking for the camera",
  request_screen_share: "Requesting screen share",
  open_portal: "Opening the government portal",
  request_voice_input: "Listening for your answer",
  create_plan: "Planning the mission",
  update_plan: "Updating mission progress",
};

/** One-line result summary spoken/shown when a tool finishes. */
function describeToolResult(name: string, result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown>;
  const count = (v: unknown) => (Array.isArray(v) ? v.length : undefined);

  switch (name) {
    case "find_eligible_schemes": {
      const n = Array.isArray(result)
        ? result.length
        : (count(r.matches) ?? count(r.schemes) ?? count(r.results));
      return n !== undefined ? `Found ${n} matching scheme${n === 1 ? "" : "s"}` : undefined;
    }
    case "extract_form_fields": {
      const n = count(r.fields);
      return n !== undefined ? `Extracted ${n} field${n === 1 ? "" : "s"}` : undefined;
    }
    case "fill_form_fields": {
      const filled = count(r.filled);
      const missing = count(r.missing);
      if (filled !== undefined) {
        return `Filled ${filled} field${filled === 1 ? "" : "s"}${missing ? `, ${missing} still missing` : ""}`;
      }
      return undefined;
    }
    case "generate_filled_pdf":
      return "Filled PDF ready to download";
    case "detect_form_language":
      return typeof r.languageName === "string"
        ? `Form is in ${r.languageName}`
        : typeof r.language === "string"
          ? `Form language: ${r.language}`
          : undefined;
    case "get_application_form":
      return typeof r.formName === "string" ? `Form ready: ${r.formName}` : undefined;
    case "update_plan":
      return typeof r.message === "string" ? r.message : undefined;
    default:
      return undefined;
  }
}

function toLoopMessages(messages: AgentChatMessage[]): LoopMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    tool_calls: m.tool_calls,
    tool_call_id: m.tool_call_id,
    name: m.name,
  }));
}

export async function runAgentTurn(
  input: AgentRunInput,
  emit?: (event: AgentEvent) => void,
): Promise<AgentRunResult> {
  const OPENROUTER_API_KEY = input.apiKey;
  const systemPrompt = buildSystemPrompt(
    input.language,
    input.profileSnapshot,
    input.phase,
    input.screenShareActive,
    input.plan,
  );

  const toolCtx = {
    profile: input.profileSnapshot,
    language: input.language,
    // OpenAI rejects non-image MIME types ("Invalid MIME type") and 502s the
    // whole agent loop — only forward actual images to vision tools.
    images: (input.images ?? []).filter(
      (img) => typeof img === "string" && img.startsWith("data:image/"),
    ),
    apiKey: OPENROUTER_API_KEY,
    plan: input.plan
      ? { goal: input.plan.goal, steps: input.plan.steps.map((s) => ({ ...s })) }
      : undefined,
  };

  const tools = getToolDefinitions();
  const loopMessages = toLoopMessages(input.messages);

  const emitBridge: AgentEmitter | undefined = emit
    ? (e) => emit({ event: e.event, data: e.data } as AgentEvent)
    : undefined;

  // ── 1. OpenRouter (premium path, skipped while on cooldown) ──
  if (Date.now() >= openrouterCooldownUntil) {
    const openrouter = await runOpenAILoop({
      baseUrl: OPENROUTER_CHAT_URL,
      apiKey: OPENROUTER_API_KEY,
      model: getOpenRouterAgentModel(),
      system: systemPrompt,
      messages: loopMessages,
      tools,
      toolCtx,
      profileSnapshot: input.profileSnapshot,
      emit: emitBridge,
      actionLabel: (t) => TOOL_ACTION_LABELS[t] ?? "Working",
      describe: describeToolResult,
    }).catch(() => null);

    if (openrouter && openrouter.reply) {
      return { ...openrouter, plan: openrouter.plan ?? toolCtx.plan };
    }
    openrouterCooldownUntil = Date.now() + 5 * 60 * 1000;
  }

  // ── 2. Groq (llama-3.3-70b) — free, fast, fresh quota pool ──
  const groqKey = (process.env.GROQ_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (groqKey) {
    const groq = await runOpenAILoop({
      baseUrl: GROQ_CHAT_URL,
      apiKey: groqKey,
      apiKeys: getGroqKeys(),
      model: GROQ_MODEL,
      altModels: ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
      system: systemPrompt,
      messages: loopMessages,
      tools,
      toolCtx,
      profileSnapshot: input.profileSnapshot,
      emit: emitBridge,
      actionLabel: (t) => TOOL_ACTION_LABELS[t] ?? "Working",
      describe: describeToolResult,
    }).catch(() => null);

    if (groq && groq.reply) {
      return { ...groq, plan: groq.plan ?? toolCtx.plan };
    }
  }

  // ── 3. Gemini agentic loop (native function-calling, free tier) ──
  try {
    const geminiTurn = await runGeminiAgentTurn({
      system: systemPrompt,
      messages: loopMessages,
      tools,
      toolCtx,
      profileSnapshot: input.profileSnapshot,
      emit: emitBridge,
      actionLabel: (t) => TOOL_ACTION_LABELS[t] ?? "Working",
      describe: describeToolResult,
    });
    if (geminiTurn && geminiTurn.reply) {
      return {
        reply: geminiTurn.reply,
        profileUpdates: geminiTurn.profileUpdates,
        filledFormData: geminiTurn.filledFormData,
        nextAction: geminiTurn.nextAction ?? { type: "none" },
        toolsUsed: geminiTurn.toolsUsed,
        model: geminiTurn.model,
        plan: geminiTurn.plan ?? toolCtx.plan,
      };
    }
  } catch (geminiErr) {
    console.error("[agent-run] gemini agentic loop failed", geminiErr);
  }

  // ── 3.5. Local Ollama (offline resilience — auto-detects a tools-capable model) ──
  const ollamaUrl = process.env.OLLAMA_URL?.trim() || "http://localhost:11434";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const tagsRes = await fetch(ollamaUrl + "/api/tags", { signal: ctrl.signal });
    clearTimeout(timer);
    if (tagsRes.ok) {
      const tags = (await tagsRes.json()) as {
        models?: Array<{ name: string; capabilities?: string[] }>;
      };
      const toolModel =
        (process.env.OLLAMA_MODEL?.trim() || undefined) ??
        tags.models?.find((m) => m.capabilities?.includes("tools"))?.name;
      if (toolModel) {
        const ollama = await runOpenAILoop({
          baseUrl: ollamaUrl + "/v1",
          apiKey: "ollama",
          model: toolModel,
          system: systemPrompt,
          messages: loopMessages,
          tools,
          toolCtx,
          profileSnapshot: input.profileSnapshot,
          emit: emitBridge,
          actionLabel: (t) => TOOL_ACTION_LABELS[t] ?? "Working",
          describe: describeToolResult,
          maxTokens: 1200,
        }).catch(() => null);

        if (ollama && ollama.reply) {
          return { ...ollama, plan: ollama.plan ?? toolCtx.plan };
        }
      }
    }
  } catch {
    /* Ollama not running or too slow — silently continue */
  }

  // ── 4. Gemini text-only reply (no tools) ──
  const geminiReply = await geminiGenerate({
    system: systemPrompt,
    userParts: loopMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        type: "text" as const,
        text: `${m.role === "user" ? "User" : "Assistant"}: ${
          typeof m.content === "string" ? m.content : ""
        }`,
      })),
    temperature: 0.4,
  });
  if (geminiReply) {
    return {
      reply: geminiReply,
      profileUpdates: undefined,
      filledFormData: undefined,
      nextAction: { type: "none" },
      toolsUsed: [],
      model: "gemini-text",
      plan: toolCtx.plan,
    };
  }

  // ── 5. Graceful — never leak provider errors to the voice UI ──
  return {
    reply:
      "I'm getting too many requests right now — everything is running on free tiers. Give me about thirty seconds, then try again.",
    profileUpdates: undefined,
    filledFormData: undefined,
    nextAction: { type: "none" },
    toolsUsed: [],
    model: "fallback",
    plan: toolCtx.plan,
  };
}
