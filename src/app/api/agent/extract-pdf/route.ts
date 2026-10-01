import { NextRequest, NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini-client";

/**
 * Reads a PDF (including scanned/image-only forms) with Gemini and returns
 * its text. Used when an uploaded PDF has no fillable AcroForm fields.
 */
export async function POST(request: NextRequest) {
  let body: { pdf?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pdf = body.pdf ?? "";
  if (!pdf.startsWith("data:application/pdf")) {
    return NextResponse.json(
      { error: "Field 'pdf' must be a PDF data URL (data:application/pdf;...)" },
      { status: 400 },
    );
  }

  const base64Part = pdf.split(",")[1] ?? "";
  if (base64Part.length > 9_000_000) {
    return NextResponse.json(
      { error: "PDF too large; try a smaller file." },
      { status: 413 },
    );
  }

  const text = await geminiGenerate({
    system:
      "You read Indian government forms and documents. Extract ALL text content from this PDF exactly as printed — every field label, heading, and value, in reading order. Output the raw text only; no commentary, no markdown.",
    userParts: [{ type: "pdf", dataUrl: pdf }],
    temperature: 0.1,
  });

  if (!text) {
    return NextResponse.json(
      { error: "Could not read this PDF — Gemini unavailable or quota exhausted." },
      { status: 502 },
    );
  }

  return NextResponse.json({ text, provider: "gemini" });
}
