import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { ProfileData } from "@/lib/profile-vault";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import type { AgentPhase } from "@/lib/agent-state";
import {
  getOpenRouterAgentModel,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";
import { getToolDefinitions, executeTool, type ToolContext } from "@/lib/agent-tools";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const MAX_TOOL_ITERATIONS = 10;

interface ChatMessage {
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

interface RequestBody {
  messages: ChatMessage[];
  language: IndianLanguageCode;
  images?: string[];
  profileSnapshot?: ProfileData;
  phase?: AgentPhase;
  screenShareActive?: boolean;
}

function buildSystemPrompt(
  language: IndianLanguageCode,
  profile: ProfileData,
  phase: AgentPhase,
  screenShareActive: boolean,
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

  return `You are FormSaathi, a kind and patient voice assistant helping Indian citizens access government schemes and fill forms. You communicate in ${langLabel}.

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
${phaseInstructions[phase]}${screenNote}`;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!OPENROUTER_API_KEY)
    return NextResponse.json(
      { error: "Server missing OpenRouter configuration" },
      { status: 503 },
    );

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    messages: clientMessages,
    language = "en" as IndianLanguageCode,
    images,
    profileSnapshot = {},
    phase = "greeting",
    screenShareActive = false,
  } = body;

  const systemPrompt = buildSystemPrompt(
    language,
    profileSnapshot,
    phase,
    screenShareActive,
  );

  const toolCtx: ToolContext = {
    profile: profileSnapshot,
    language,
    images,
    apiKey: OPENROUTER_API_KEY,
  };

  // Build messages array: system + conversation history
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...clientMessages,
  ];

  const model = getOpenRouterAgentModel();
  const tools = getToolDefinitions();
  let profileUpdates: Record<string, string> | undefined;
  let filledFormData: Record<string, string> | undefined;
  const toolsUsed: string[] = [];
  let nextAction: unknown;

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const res = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: "auto",
          temperature: 0.4,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[agent/chat] OpenRouter error", res.status, err);
        return NextResponse.json(
          { error: "Agent request failed", detail: err.slice(0, 500) },
          { status: 502 },
        );
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
          finish_reason?: string;
        }>;
      };

      const choice = data.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) {
        return NextResponse.json(
          { error: "No response from model" },
          { status: 502 },
        );
      }

      // If the model wants to call tools
      if (assistantMsg.tool_calls?.length) {
        // Add assistant message with tool calls to history
        messages.push({
          role: "assistant",
          content: assistantMsg.content ?? "",
          tool_calls: assistantMsg.tool_calls,
        });

        // Execute each tool and add results
        for (const toolCall of assistantMsg.tool_calls) {
          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          const result = await executeTool(toolName, args, toolCtx);

          // Track profile updates
          if (toolName === "update_user_profile" && result && typeof result === "object" && "fields" in result) {
            profileUpdates = {
              ...profileUpdates,
              ...(result as { fields: Record<string, string> }).fields,
            };
          }

          // Track filled form fields
          if (toolName === "fill_form_fields" && result && typeof result === "object" && "filled" in result) {
            filledFormData = (result as { filled: Record<string, string> }).filled;
          }

          // Track client actions
          if (result && typeof result === "object" && "clientAction" in result) {
            const action = result as Record<string, unknown>;
            switch (action.clientAction) {
              case "open_camera":
                nextAction = { type: "open_camera", purpose: action.purpose };
                break;
              case "start_screen_share":
                nextAction = { type: "start_screen_share" };
                break;
              case "navigate":
                nextAction = { type: "navigate", url: action.url };
                break;
              case "listen_voice":
                nextAction = {
                  type: "listen_voice",
                  prompt: action.prompt,
                };
                break;
            }
          }

          // Generate PDF server-side immediately and return as download
          if (
            toolName === "generate_filled_pdf" &&
            result &&
            typeof result === "object" &&
            "action" in result
          ) {
            try {
              const pdfResult = result as Record<string, unknown>;
              const filledFields = (pdfResult.filledFields ?? {}) as Record<string, string>;
              // Import and generate summary PDF directly
              const { generateSummaryPdf } = await import("@/lib/pdf-generator");
              const pdfBase64 = await generateSummaryPdf(
                filledFields,
                "PM-KISAN Application — FormSaathi",
              );
              nextAction = {
                type: "download_pdf",
                base64: pdfBase64,
                filename: `formsaathi-filled-${Date.now()}.pdf`,
              };
            } catch (pdfErr) {
              console.error("[agent/chat] PDF generation failed:", pdfErr);
              nextAction = {
                type: "generate_pdf",
                ...(result as Record<string, unknown>),
              };
            }
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Continue the loop to let the model respond to tool results
        continue;
      }

      // Model gave a final text response — we're done
      const reply = assistantMsg.content?.trim() ?? "";
      return NextResponse.json({
        reply,
        profileUpdates,
        filledFormData,
        nextAction: nextAction ?? { type: "none" },
        toolsUsed: [...new Set(toolsUsed)],
        model,
      });
    }

    // Exceeded max iterations
    return NextResponse.json({
      reply: "I'm having trouble processing that. Could you try again?",
      profileUpdates,
      nextAction: { type: "none" },
      toolsUsed: [...new Set(toolsUsed)],
      model,
    });
  } catch (err) {
    console.error("[agent/chat] error:", err);
    return NextResponse.json(
      { error: "Agent request failed", detail: String(err) },
      { status: 500 },
    );
  }
}
