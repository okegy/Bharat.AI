import { NextRequest, NextResponse } from "next/server";
import { getOpenRouterAgentModel, getOpenRouterApiKey, OPENROUTER_CHAT_URL } from "@/lib/openrouter-config";
import { geminiGenerate } from "@/lib/gemini-client";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    
    const from = data.get("From") as string;
    const bodyText = data.get("Body") as string;
    const mediaUrl = data.get("MediaUrl0") as string; // Twilio sends media URL here if it's a voice note
    const mediaContentType = data.get("MediaContentType0") as string; // audio/ogg, audio/mpeg, etc.

    let userMessage = bodyText || "";

    // 1. If it's a voice note, transcribe it using Groq Whisper API
    if (mediaUrl && mediaContentType?.startsWith("audio/")) {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        throw new Error("GROQ_API_KEY is missing for voice transcription");
      }

      // Download the audio file from Twilio
      const audioResponse = await fetch(mediaUrl);
      const audioBlob = await audioResponse.blob();
      
      const formData = new FormData();
      formData.append("file", audioBlob, "whatsapp_audio.ogg");
      formData.append("model", "whisper-large-v3");

      const transcriptionRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`
        },
        body: formData
      });

      if (transcriptionRes.ok) {
        const transcriptJson = await transcriptionRes.json();
        userMessage = transcriptJson.text;
        console.log("[WhatsApp] Transcribed Voice Note:", userMessage);
      } else {
        console.error("[WhatsApp] Transcription failed", await transcriptionRes.text());
        userMessage = "Sorry, I couldn't understand the audio message.";
      }
    }

    // 2. Process the message using OpenRouter LLM
    let aiResponseText = "Sorry, I am currently facing an issue. Please try again later.";
    
    if (userMessage) {
      const openRouterKey = getOpenRouterApiKey();
      const model = getOpenRouterAgentModel();

      const llmRes = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content: "You are the BharatLink WhatsApp AI assistant. You help citizens of India find government schemes like PM-Kisan, apply for documents, and navigate government services. Keep your answers short, friendly, formatted cleanly for WhatsApp (use *bold* instead of markdown headings), and highly relevant."
            },
            {
              role: "user",
              content: userMessage
            }
          ]
        })
      });

      if (llmRes.ok) {
        const llmJson = await llmRes.json();
        aiResponseText = llmJson.choices?.[0]?.message?.content || aiResponseText;
      } else {
        // Gemini fallback — replies keep working through balance gates
        const geminiText = await geminiGenerate({
          system: "You are the BharatLink WhatsApp AI assistant for Indian citizens. Help with government schemes (PM-KISAN, Ayushman Bharat, ration card, pensions). Keep answers short, friendly, formatted for WhatsApp (use *bold*).",
          userParts: [{ type: "text", text: userMessage }],
          temperature: 0.4,
        });
        if (geminiText) aiResponseText = geminiText;
      }
    }

    // 3. Return TwiML response to send WhatsApp message back
    const twiml = `
      <Response>
        <Message>${aiResponseText}</Message>
      </Response>
    `;

    return new NextResponse(twiml.trim(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
    
  } catch (error) {
    console.error("[WhatsApp Webhook Error]", error);
    // Even on error, return a graceful TwiML message so the user gets feedback
    const errorTwiml = `<Response><Message>Something went wrong on our end. Please try again.</Message></Response>`;
    return new NextResponse(errorTwiml.trim(), { status: 200, headers: { "Content-Type": "text/xml" }});
  }
}
