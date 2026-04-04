/**
 * FormSaathi Agent — tool definitions and server-side executors.
 *
 * Each tool has an OpenRouter-compatible definition and an executor
 * function that runs server-side within the /api/agent/chat route.
 */

import type { ProfileData } from "@/lib/profile-vault";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import {
  findEligibleSchemes,
  getSchemeById,
  type SchemeMatch,
} from "@/lib/schemes-db";
import {
  getOpenRouterAgentModel,
  getVoiceLangLabel,
  OPENROUTER_CHAT_URL,
} from "@/lib/openrouter-config";

// ─── Types ──────────────────────────────────────────────

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ToolContext {
  profile: ProfileData;
  language: IndianLanguageCode;
  images?: string[];
  apiKey: string;
}

type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown>;

interface AgentTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

// ─── Helper: call OpenRouter ────────────────────────────

async function callOpenRouter(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseJsonSafe(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

function getImageFromCtx(ctx: ToolContext, index: number): string | null {
  return ctx.images?.[index] ?? ctx.images?.[0] ?? null;
}

// ─── Tool: get_user_profile ─────────────────────────────

const getUserProfile: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "get_user_profile",
      description:
        "Get the user's current profile data including name, Aadhaar details, state, occupation, income, category, and other personal information.",
      parameters: { type: "object", properties: {} },
    },
  },
  execute: async (_args, ctx) => ctx.profile,
};

// ─── Tool: update_user_profile ──────────────────────────

const updateUserProfile: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "update_user_profile",
      description:
        "Update specific fields in the user's profile. Use this when the user provides new information (phone number, education, marital status, etc.). Only include fields that need to change.",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "object",
            description:
              "Key-value pairs to update. Valid keys: fullName, fatherName, dob, gender, aadhaarNumber, address, district, state, pincode, phone, occupation, annualIncome, category, education, bankAccount, rationCardType, landOwnership, disabilityStatus, maritalStatus, numberOfDependents",
          },
        },
        required: ["fields"],
      },
    },
  },
  execute: async (args) => {
    const VALID_KEYS = new Set([
      "fullName", "fatherName", "dob", "gender", "aadhaarNumber", "address",
      "district", "state", "pincode", "phone", "occupation", "annualIncome",
      "category", "education", "bankAccount", "rationCardType", "landOwnership",
      "disabilityStatus", "maritalStatus", "numberOfDependents",
    ]);
    const raw = args.fields as Record<string, string>;
    const fields = Object.fromEntries(
      Object.entries(raw).filter(([k]) => VALID_KEYS.has(k)),
    );
    return { updated: true, fields };
  },
};

// ─── Tool: find_eligible_schemes ────────────────────────

const findSchemes: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "find_eligible_schemes",
      description:
        "Find government schemes the user is eligible for based on their profile. Returns top matches with scores, estimated benefits, and any missing profile fields.",
      parameters: { type: "object", properties: {} },
    },
  },
  execute: async (_args, ctx) => {
    const matches: SchemeMatch[] = findEligibleSchemes(ctx.profile);
    return matches.slice(0, 10).map((m) => ({
      id: m.scheme.id,
      name: m.scheme.name,
      nameHi: m.scheme.nameHi,
      department: m.scheme.department,
      category: m.scheme.category,
      benefit: `₹${m.scheme.estimatedBenefitINR.toLocaleString("en-IN")}`,
      benefitType: m.scheme.benefitType,
      score: Math.round(m.score * 100),
      matchedRules: m.matchedRules,
      missingFields: m.missingFields,
      portalUrl: m.scheme.portalUrl,
      description: m.scheme.description,
    }));
  },
};

// ─── Tool: get_scheme_details ───────────────────────────

const getSchemeDetails: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "get_scheme_details",
      description:
        "Get full details for a specific government scheme including form fields, required documents, eligibility criteria, and portal URL.",
      parameters: {
        type: "object",
        properties: {
          scheme_id: {
            type: "string",
            description: "The scheme ID (e.g., 'ration-card-nfsa', 'pm-kisan')",
          },
        },
        required: ["scheme_id"],
      },
    },
  },
  execute: async (args) => {
    const scheme = getSchemeById(args.scheme_id as string);
    if (!scheme) return { error: "Scheme not found" };
    return {
      id: scheme.id,
      name: scheme.name,
      nameHi: scheme.nameHi,
      department: scheme.department,
      category: scheme.category,
      benefitType: scheme.benefitType,
      estimatedBenefit: `₹${scheme.estimatedBenefitINR.toLocaleString("en-IN")}`,
      description: scheme.description,
      portalUrl: scheme.portalUrl,
      _instruction: "IMPORTANT: To open this portal for the user, you MUST call the open_portal tool with the portalUrl above. Do NOT just tell the URL in text.",
      requiredDocuments: scheme.requiredDocuments,
      eligibility: scheme.eligibility.map((r) => r.label),
      formFields: scheme.formFields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        profileKey: f.profileKey,
        options: f.options,
      })),
    };
  },
};

// ─── Tool: translate_text ───────────────────────────────

const translateText: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "translate_text",
      description:
        "Translate text between languages. Use to translate form labels, instructions, or any text the user needs in their language.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to translate" },
          target_language: {
            type: "string",
            description: "Target language code (e.g., 'hi-IN', 'ta-IN', 'bn-IN')",
          },
          source_language: {
            type: "string",
            description: "Source language code (default: English)",
          },
        },
        required: ["text", "target_language"],
      },
    },
  },
  execute: async (args, ctx) => {
    const targetLabel = getVoiceLangLabel(args.target_language as string);
    const result = await callOpenRouter(ctx.apiKey, {
      model: "openai/gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You translate text accurately. Output only the translation — no quotes, labels, or explanations.",
        },
        {
          role: "user",
          content: `Translate into ${targetLabel}:\n\n${args.text}`,
        },
      ],
    });
    return { translated: result, target: args.target_language };
  },
};

// ─── Tool: scan_document ────────────────────────────────

const scanDocument: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "scan_document",
      description:
        "Analyze an image using vision AI. Can scan Aadhaar cards (front/back), forms, or any document. Returns extracted text and structured fields.",
      parameters: {
        type: "object",
        properties: {
          image_index: {
            type: "number",
            description: "Index of the image in the current message (0-based, default 0)",
          },
          task: {
            type: "string",
            enum: ["aadhaar_front", "aadhaar_back", "form_scan", "general"],
            description: "What type of document to scan",
          },
        },
        required: ["task"],
      },
    },
  },
  execute: async (args, ctx) => {
    const image = getImageFromCtx(ctx, (args.image_index as number) ?? 0);
    if (!image) return { error: "No image provided" };

    const task = args.task as string;
    let systemPrompt: string;
    let userPrompt: string;

    switch (task) {
      case "aadhaar_front":
        systemPrompt = `Extract visible fields from this Indian Aadhaar card FRONT side. Return JSON: { fullName, fatherName, dob, gender, aadhaarNumber, address, pincode, district, state }. Use "" for missing fields. Only include digits you clearly see for Aadhaar number.`;
        userPrompt = "Extract Aadhaar card front fields.";
        break;
      case "aadhaar_back":
        systemPrompt = `Extract visible fields from this Indian Aadhaar card BACK side. Return JSON: { aadhaarNumber, vid, address, pincode, qrData }. The back typically has the Aadhaar number, VID (Virtual ID), and sometimes address. Use "" for missing fields.`;
        userPrompt = "Extract Aadhaar card back fields.";
        break;
      case "form_scan":
        systemPrompt = `You are analyzing a scanned government form image. Extract ALL field labels and any pre-filled values. Return JSON: { language: string, fields: [{ label: string, labelEnglish: string, value: string, type: "text"|"checkbox"|"date"|"number"|"select", required: boolean, x: number, y: number, width: number, height: number }] }. Coordinates should be approximate percentages (0-100) of image dimensions. Translate all labels to English in labelEnglish.`;
        userPrompt = "Extract all form fields from this image.";
        break;
      default:
        systemPrompt = `Extract all visible text and structured information from this document image. Return a JSON object with relevant fields.`;
        userPrompt = "Read and extract information from this document.";
    }

    const raw = await callOpenRouter(ctx.apiKey, {
      model: getOpenRouterAgentModel(),
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    try {
      return parseJsonSafe(raw);
    } catch {
      return { rawText: raw };
    }
  },
};

// ─── Tool: detect_form_language ─────────────────────────

const detectFormLanguage: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "detect_form_language",
      description:
        "Detect the language and script of a scanned form image. Returns the primary language, script name, and confidence.",
      parameters: {
        type: "object",
        properties: {
          image_index: {
            type: "number",
            description: "Index of the image (default 0)",
          },
        },
      },
    },
  },
  execute: async (args, ctx) => {
    const image = getImageFromCtx(ctx, (args.image_index as number) ?? 0);
    if (!image) return { error: "No image provided" };

    const raw = await callOpenRouter(ctx.apiKey, {
      model: getOpenRouterAgentModel(),
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Identify the primary language of this form/document. Return JSON: { language: string (ISO 639-1 code), languageName: string, script: string, confidence: number (0-1) }. Common Indian languages: hi (Hindi/Devanagari), bn (Bengali), te (Telugu), mr (Marathi/Devanagari), ta (Tamil), gu (Gujarati), kn (Kannada), ml (Malayalam), pa (Punjabi/Gurmukhi), or (Odia), as (Assamese), ur (Urdu/Nastaliq), en (English/Latin).`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "What language is this form written in?" },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    try {
      return parseJsonSafe(raw);
    } catch {
      return { language: "unknown", rawText: raw };
    }
  },
};

// ─── Tool: extract_form_fields ──────────────────────────

const extractFormFields: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "extract_form_fields",
      description:
        "Extract all field labels, types, and positions from a scanned form image. Returns structured data for each form field including its English translation and approximate position.",
      parameters: {
        type: "object",
        properties: {
          image_index: { type: "number", description: "Index of the image (default 0)" },
          form_language: {
            type: "string",
            description: "Known language of the form (e.g., 'hi', 'en', 'ta')",
          },
        },
      },
    },
  },
  execute: async (args, ctx) => {
    const image = getImageFromCtx(ctx, (args.image_index as number) ?? 0);
    if (!image) return { error: "No image provided" };

    const langHint = args.form_language
      ? `The form is in ${getVoiceLangLabel((args.form_language as string) + "-IN") || args.form_language}.`
      : "";

    const raw = await callOpenRouter(ctx.apiKey, {
      model: getOpenRouterAgentModel(),
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Extract every fillable field from this government form image. ${langHint}
Return JSON: { fields: [{ label: string, labelEnglish: string, value: string, type: "text"|"checkbox"|"date"|"number"|"select", required: boolean, x: number, y: number, width: number, height: number }] }.
- label: the field label exactly as printed on the form
- labelEnglish: accurate English translation of the label
- value: any pre-filled text, or "" if blank
- type: infer from field appearance
- x, y, width, height: approximate position as percentage of image (0-100)
Be thorough — include every single field, even small ones.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all form fields." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    try {
      return parseJsonSafe(raw);
    } catch {
      return { rawText: raw };
    }
  },
};

// ─── Tool: fill_form_fields ─────────────────────────────

const PROFILE_KEY_ALIASES: Record<string, keyof ProfileData> = {
  "full name": "fullName",
  "name": "fullName",
  "applicant name": "fullName",
  "father name": "fatherName",
  "father's name": "fatherName",
  "date of birth": "dob",
  "dob": "dob",
  "birth date": "dob",
  "gender": "gender",
  "sex": "gender",
  "aadhaar": "aadhaarNumber",
  "aadhaar number": "aadhaarNumber",
  "aadhar number": "aadhaarNumber",
  "uid": "aadhaarNumber",
  "address": "address",
  "residential address": "address",
  "permanent address": "address",
  "district": "district",
  "state": "state",
  "pin code": "pincode",
  "pincode": "pincode",
  "zip code": "pincode",
  "mobile": "phone",
  "phone": "phone",
  "mobile number": "phone",
  "phone number": "phone",
  "contact number": "phone",
  "occupation": "occupation",
  "annual income": "annualIncome",
  "income": "annualIncome",
  "yearly income": "annualIncome",
  "category": "category",
  "caste": "category",
  "social category": "category",
  "education": "education",
  "qualification": "education",
  "bank account": "bankAccount",
  "account number": "bankAccount",
  "ration card": "rationCardType",
  "ration card type": "rationCardType",
  "land": "landOwnership",
  "land ownership": "landOwnership",
  "disability": "disabilityStatus",
  "marital status": "maritalStatus",
  "dependents": "numberOfDependents",
  "number of dependents": "numberOfDependents",
};

const fillFormFields: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "fill_form_fields",
      description:
        "Match extracted form fields to user profile data. Returns which fields can be auto-filled and which are missing.",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            description:
              "Array of extracted form fields with labelEnglish and label",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                labelEnglish: { type: "string" },
                value: { type: "string" },
              },
            },
          },
        },
        required: ["fields"],
      },
    },
  },
  execute: async (args, ctx) => {
    const fields = args.fields as Array<{
      label: string;
      labelEnglish: string;
      value: string;
    }>;
    const filled: Record<string, string> = {};
    const missing: string[] = [];

    for (const field of fields) {
      const englishLabel = (field.labelEnglish || field.label).toLowerCase().trim();

      // Try alias table match (exact first, then substring with min length)
      let profileKey: keyof ProfileData | undefined;
      // Exact match
      if (PROFILE_KEY_ALIASES[englishLabel]) {
        profileKey = PROFILE_KEY_ALIASES[englishLabel];
      }
      // Substring match with min alias length to avoid false positives
      if (!profileKey) {
        for (const [alias, key] of Object.entries(PROFILE_KEY_ALIASES)) {
          if (alias.length >= 4 && englishLabel.includes(alias)) {
            profileKey = key;
            break;
          }
        }
      }

      if (profileKey && ctx.profile[profileKey]) {
        filled[field.label] = ctx.profile[profileKey]!;
      } else if (field.value) {
        filled[field.label] = field.value;
      } else {
        missing.push(field.labelEnglish || field.label);
      }
    }

    return { filled, missing, totalFields: fields.length };
  },
};

// ─── Tool: generate_filled_pdf ──────────────────────────

const generateFilledPdf: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "generate_filled_pdf",
      description:
        "Generate a PDF with the scanned form as background and filled field values overlaid. Returns a base64-encoded PDF for download.",
      parameters: {
        type: "object",
        properties: {
          form_image_base64: {
            type: "string",
            description: "Base64 data URL of the scanned form image",
          },
          filled_fields: {
            type: "object",
            description: "Map of field labels to filled values",
          },
          field_positions: {
            type: "array",
            description:
              "Array of { label, x, y, width, height } with positions as percentages",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
              },
            },
          },
        },
        required: ["form_image_base64", "filled_fields"],
      },
    },
  },
  execute: async (args, ctx) => {
    // PDF generation is handled by the /api/agent/fill-pdf endpoint
    // The LLM can't pass actual base64 data — always use ctx.images from the upload
    const rawArg = (args.form_image_base64 as string) || "";
    const isRealBase64 = rawArg.startsWith("data:image/") || rawArg.length > 1000;
    const formImage = isRealBase64 ? rawArg : ctx.images?.[0] || "";
    return {
      action: "generate_pdf",
      formImage,
      filledFields: args.filled_fields,
      fieldPositions: args.field_positions,
    };
  },
};

// ─── Tool: analyze_screenshot ───────────────────────────

const analyzeScreenshot: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "analyze_screenshot",
      description:
        "Analyze a screenshot of a government website to identify form fields, buttons, and navigation. Use this during online application guidance when screen sharing is active.",
      parameters: {
        type: "object",
        properties: {
          image_index: { type: "number", description: "Screenshot image index (default 0)" },
          current_url: { type: "string", description: "Current page URL if known" },
          target_scheme_id: {
            type: "string",
            description: "The scheme being applied for, if known",
          },
        },
      },
    },
  },
  execute: async (args, ctx) => {
    const image = getImageFromCtx(ctx, (args.image_index as number) ?? 0);
    if (!image) return { error: "No screenshot provided" };

    const schemeContext = args.target_scheme_id
      ? ` The user is trying to apply for scheme: ${args.target_scheme_id}.`
      : "";

    const raw = await callOpenRouter(ctx.apiKey, {
      model: getOpenRouterAgentModel(),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are helping a user navigate a government website.${schemeContext} Analyze this screenshot and describe:
1. What page/step this is
2. What form fields are visible and which ones need to be filled
3. What buttons or links the user should click next
4. Any errors or warnings visible
Return JSON: { pageDescription: string, visibleFields: string[], suggestedAction: string, nextSteps: string[] }`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this screenshot and tell me what to do." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    try {
      return parseJsonSafe(raw);
    } catch {
      return { pageDescription: raw };
    }
  },
};

// ─── Tool: generate_guidance ────────────────────────────

const generateGuidance: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "generate_guidance",
      description:
        "Generate a spoken instruction for the user about what to do next on a government website. The instruction will be read aloud via TTS.",
      parameters: {
        type: "object",
        properties: {
          field_name: { type: "string", description: "The field or button to interact with" },
          field_value: {
            type: "string",
            description: "The value to enter (if applicable)",
          },
          page_context: {
            type: "string",
            description: "Brief description of what's on screen",
          },
        },
        required: ["field_name", "page_context"],
      },
    },
  },
  execute: async (args, ctx) => {
    const langLabel = getVoiceLangLabel(
      ctx.language.includes("-") ? ctx.language : `${ctx.language}-IN`,
    );
    const raw = await callOpenRouter(ctx.apiKey, {
      model: getOpenRouterAgentModel(),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Generate a brief, clear spoken instruction in ${langLabel} for the user. They are navigating a government website and need help. Keep it to 1-2 sentences. The instruction will be read aloud.`,
        },
        {
          role: "user",
          content: `Page context: ${args.page_context}\nField/button: ${args.field_name}${args.field_value ? `\nValue to enter: ${args.field_value}` : ""}\n\nGenerate a spoken instruction.`,
        },
      ],
    });
    return { instruction: raw };
  },
};

// ─── Client-action tools ────────────────────────────────

const requestCamera: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "request_camera",
      description:
        "Ask the user to open their camera to scan a document. Use for Aadhaar card scanning or form scanning.",
      parameters: {
        type: "object",
        properties: {
          purpose: {
            type: "string",
            enum: ["aadhaar_front", "aadhaar_back", "form_scan", "document"],
            description: "What the camera capture is for",
          },
        },
        required: ["purpose"],
      },
    },
  },
  execute: async (args) => ({
    clientAction: "open_camera",
    purpose: args.purpose,
  }),
};

const requestScreenShare: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "request_screen_share",
      description:
        "Ask the user to start screen sharing so you can see and guide them through a government website. Use when they choose online application.",
      parameters: { type: "object", properties: {} },
    },
  },
  execute: async () => ({
    clientAction: "start_screen_share",
  }),
};

const openPortal: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "open_portal",
      description:
        "Open a government scheme portal URL in a new browser tab AND automatically prompt screen sharing. Use this IMMEDIATELY when the user wants to apply for a scheme online — call get_scheme_details first to get the portal URL, then call this tool. This replaces the need to call request_screen_share separately.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The portal URL to open (from get_scheme_details portalUrl)",
          },
          scheme_name: {
            type: "string",
            description: "Name of the scheme (for user confirmation)",
          },
        },
        required: ["url"],
      },
    },
  },
  execute: async (args) => ({
    clientAction: "navigate",
    url: args.url,
    schemeName: args.scheme_name,
  }),
};

const requestVoiceInput: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "request_voice_input",
      description:
        "Ask the user to speak their answer. Use when you need specific information from them (name, address, etc.).",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "What to ask the user to say",
          },
          field_name: {
            type: "string",
            description: "Which profile/form field this is for",
          },
        },
        required: ["prompt"],
      },
    },
  },
  execute: async (args) => ({
    clientAction: "listen_voice",
    prompt: args.prompt,
    fieldName: args.field_name,
  }),
};

// ─── Tool Registry ──────────────────────────────────────

// ─── Tool: get_application_form ─────────────────────────

const AVAILABLE_FORMS: Array<{
  id: string;
  name: string;
  nameHi: string;
  keywords: string[];
  path: string;
}> = [
  { id: "pm-kisan", name: "PM-KISAN Application", nameHi: "पीएम-किसान आवेदन पत्र", keywords: ["kisan", "pm-kisan", "pm kisan", "किसान", "farmer"], path: "/forms/01-PM-KISAN-Application.pdf" },
  { id: "ration-card", name: "Ration Card (NFSA)", nameHi: "राशन कार्ड आवेदन पत्र", keywords: ["ration", "nfsa", "राशन", "food"], path: "/forms/02-Ration-Card-NFSA.pdf" },
  { id: "pmay-urban", name: "PM Awas Yojana (Urban)", nameHi: "पीएम आवास योजना (शहरी)", keywords: ["awas", "housing", "urban", "आवास", "शहरी", "pmay"], path: "/forms/03-PM-Awas-Yojana-Urban.pdf" },
  { id: "pmay-rural", name: "PM Awas Yojana (Rural)", nameHi: "पीएम आवास योजना (ग्रामीण)", keywords: ["awas", "housing", "rural", "gramin", "आवास", "ग्रामीण", "pmay"], path: "/forms/04-PM-Awas-Yojana-Rural.pdf" },
  { id: "sukanya", name: "Sukanya Samriddhi Yojana", nameHi: "सुकन्या समृद्धि योजना", keywords: ["sukanya", "samriddhi", "girl", "सुकन्या", "बालिका"], path: "/forms/05-Sukanya-Samriddhi.pdf" },
  { id: "fasal-bima", name: "PM Fasal Bima Yojana", nameHi: "पीएम फसल बीमा योजना", keywords: ["fasal", "bima", "crop", "insurance", "फसल", "बीमा"], path: "/forms/06-PM-Fasal-Bima.pdf" },
  { id: "ayushman", name: "Ayushman Bharat (PMJAY)", nameHi: "आयुष्मान भारत योजना", keywords: ["ayushman", "bharat", "pmjay", "health", "आयुष्मान", "स्वास्थ्य"], path: "/forms/07-Ayushman-Bharat.pdf" },
  { id: "ujjwala", name: "PM Ujjwala Yojana", nameHi: "पीएम उज्ज्वला योजना", keywords: ["ujjwala", "gas", "cylinder", "lpg", "उज्ज्वला", "गैस"], path: "/forms/08-PM-Ujjwala.pdf" },
  { id: "nps", name: "National Pension Scheme", nameHi: "राष्ट्रीय पेंशन योजना", keywords: ["pension", "nps", "retirement", "पेंशन", "निवृत्ति"], path: "/forms/09-National-Pension.pdf" },
  { id: "mudra", name: "PM Mudra Yojana", nameHi: "पीएम मुद्रा योजना", keywords: ["mudra", "loan", "business", "मुद्रा", "ऋण", "व्यापार"], path: "/forms/10-PM-Mudra-Yojana.pdf" },
];

const getApplicationForm: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "get_application_form",
      description:
        "Search for and provide a downloadable government application form. Use when the user asks for a specific scheme's form, wants to download a form, or needs a blank form to fill. Returns a download link the user can click.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The scheme name or keywords to search for (e.g., 'PM Kisan', 'ration card', 'आवास योजना', 'pension')",
          },
        },
        required: ["query"],
      },
    },
  },
  execute: async (args) => {
    const query = ((args.query as string) || "").toLowerCase();
    // Find matching form by keywords
    const match = AVAILABLE_FORMS.find((f) =>
      f.keywords.some((kw) => query.includes(kw)) ||
      f.name.toLowerCase().includes(query) ||
      f.id.includes(query)
    );
    if (match) {
      return {
        found: true,
        formName: match.name,
        formNameHi: match.nameHi,
        downloadPath: match.path,
        clientAction: "download_form",
        message: `${match.name} form is ready for download.`,
      };
    }
    // Return all available forms if no match
    return {
      found: false,
      availableForms: AVAILABLE_FORMS.map((f) => ({ name: f.name, nameHi: f.nameHi, id: f.id })),
      message: "Form not found. Here are the available forms.",
    };
  },
};

const TOOLS: AgentTool[] = [
  getUserProfile,
  updateUserProfile,
  findSchemes,
  getSchemeDetails,
  translateText,
  scanDocument,
  detectFormLanguage,
  extractFormFields,
  fillFormFields,
  generateFilledPdf,
  analyzeScreenshot,
  generateGuidance,
  getApplicationForm,
  requestCamera,
  requestScreenShare,
  openPortal,
  requestVoiceInput,
];

const TOOL_MAP = new Map<string, AgentTool>(
  TOOLS.map((t) => [t.definition.function.name, t]),
);

/** Get all tool definitions for the OpenRouter tools parameter. */
export function getToolDefinitions(): ToolDefinition[] {
  return TOOLS.map((t) => t.definition);
}

/** Execute a tool by name. Returns the result or an error object. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = TOOL_MAP.get(name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    return await tool.execute(args, ctx);
  } catch (err) {
    console.error(`[agent-tools] ${name} failed:`, err);
    return { error: `Tool ${name} failed: ${String(err)}` };
  }
}
