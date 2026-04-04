/**
 * Client-side conversation state for the FormSaathi agent.
 * All state lives in React state / memory — no server persistence.
 */

import type { IndianLanguageCode } from "@/lib/indian-languages";

export type AgentPhase =
  | "greeting"
  | "profile-review"
  | "path-choice"
  | "scheme-recommend"
  | "offline-scan"
  | "offline-fill"
  | "offline-generate"
  | "online-guide"
  | "complete";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ActiveFormData {
  formImageBase64?: string;
  detectedLanguage?: string;
  extractedFields?: ExtractedFormField[];
  filledFields?: Record<string, string>;
  missingFields?: string[];
}

export interface ExtractedFormField {
  label: string;
  labelEnglish: string;
  value: string;
  type: string;
  required: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type AgentNextAction =
  | { type: "open_camera"; purpose: string }
  | { type: "start_screen_share" }
  | { type: "stop_screen_share" }
  | { type: "listen_voice"; prompt?: string }
  | { type: "download_pdf"; base64: string; filename: string }
  | { type: "navigate"; url: string }
  | { type: "none" };

export interface AgentConversation {
  id: string;
  messages: ChatMessage[];
  phase: AgentPhase;
  language: IndianLanguageCode;
  activeSchemeId?: string;
  activeFormData?: ActiveFormData;
  screenShareActive?: boolean;
  createdAt: number;
}

export interface AgentChatResponse {
  reply: string;
  profileUpdates?: Record<string, string>;
  nextAction?: AgentNextAction;
  toolsUsed?: string[];
}

let conversationCounter = 0;

export function createConversation(language: IndianLanguageCode): AgentConversation {
  conversationCounter += 1;
  return {
    id: `conv-${Date.now()}-${conversationCounter}`,
    messages: [],
    phase: "greeting",
    language,
    createdAt: Date.now(),
  };
}

export function addUserMessage(
  conv: AgentConversation,
  text: string,
  images?: string[],
): AgentConversation {
  const content: ContentPart[] = [{ type: "text", text }];
  if (images?.length) {
    for (const img of images) {
      content.push({ type: "image_url", image_url: { url: img } });
    }
  }

  return {
    ...conv,
    messages: [
      ...conv.messages,
      { role: "user", content: content.length === 1 ? text : content },
    ],
  };
}

export function addAssistantMessage(
  conv: AgentConversation,
  text: string,
): AgentConversation {
  return {
    ...conv,
    messages: [...conv.messages, { role: "assistant", content: text }],
  };
}

/** Truncate conversation to last N messages to keep token usage reasonable.
 *  Avoids cutting mid-tool-call sequence (orphaned tool results). */
export function trimConversation(
  conv: AgentConversation,
  maxMessages = 40,
): AgentConversation {
  if (conv.messages.length <= maxMessages) return conv;
  let cutIndex = conv.messages.length - maxMessages;
  // Don't start mid-tool-call: skip past any orphaned "tool" role messages
  while (cutIndex < conv.messages.length && conv.messages[cutIndex].role === "tool") {
    cutIndex++;
  }
  return {
    ...conv,
    messages: conv.messages.slice(cutIndex),
  };
}

/** Prepare the messages payload for the API call. */
export function serializeForApi(conv: AgentConversation): ChatMessage[] {
  return conv.messages.map((m) => {
    const out: ChatMessage = { role: m.role, content: m.content };
    if (m.tool_calls) out.tool_calls = m.tool_calls;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });
}
