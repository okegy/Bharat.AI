import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFPage, rgb, StandardFonts } from "pdf-lib";

/** Map from profile keys / common field names to AcroForm field names in our demo PDF. */
const PROFILE_TO_FORM: Record<string, string> = {
  fullName: "fullName",
  fatherName: "fatherName",
  dob: "dob",
  gender: "gender",
  aadhaarNumber: "aadhaarNumber",
  phone: "phone",
  address: "address",
  district: "district",
  state: "state",
  pincode: "pincode",
  occupation: "occupation",
  annualIncome: "annualIncome",
  category: "category",
  landOwnership: "landOwnership",
  bankAccount: "bankAccount",
  ifscCode: "ifscCode",
  rationCardType: "rationCardType",
};

/** Try to match a filled field label to an AcroForm field name. */
function matchToFormField(label: string): string | null {
  const lower = label.toLowerCase();
  // Direct match
  if (PROFILE_TO_FORM[label]) return PROFILE_TO_FORM[label];

  // Pattern matching
  if (/applicant.*name|name/i.test(lower) && !/father/i.test(lower)) return "fullName";
  if (/father|husband|पिता|पति/i.test(lower)) return "fatherName";
  if (/dob|birth|जन्म/i.test(lower)) return "dob";
  if (/gender|लिंग/i.test(lower)) return "gender";
  if (/aadhaar|aadhar|आधार|uid/i.test(lower)) return "aadhaarNumber";
  if (/mobile|phone|मोबाइल|फोन/i.test(lower)) return "phone";
  if (/address|पता/i.test(lower)) return "address";
  if (/district|जिला/i.test(lower)) return "district";
  if (/state|राज्य/i.test(lower)) return "state";
  if (/pin.*code|पिन/i.test(lower)) return "pincode";
  if (/occupation|व्यवसाय/i.test(lower)) return "occupation";
  if (/income|आय/i.test(lower)) return "annualIncome";
  if (/category|जाति|वर्ग/i.test(lower)) return "category";
  if (/land|भूमि/i.test(lower)) return "landOwnership";
  if (/bank.*account|बैंक.*खाता/i.test(lower)) return "bankAccount";
  if (/ifsc/i.test(lower)) return "ifscCode";
  if (/ration|राशन/i.test(lower)) return "rationCardType";
  return null;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    formImage?: string;
    filledFields?: Record<string, string>;
    fieldPositions?: unknown[];
    title?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.filledFields || Object.keys(body.filledFields).length === 0) {
    return NextResponse.json({ error: "filledFields required" }, { status: 400 });
  }

  try {
    const base64Data = body.formImage?.includes(",")
      ? body.formImage.split(",")[1]!
      : body.formImage ?? "";
    const rawBytes = base64Data ? Buffer.from(base64Data, "base64") : null;
    const isPdf = rawBytes && (
      body.formImage?.includes("application/pdf") ||
      rawBytes.slice(0, 5).toString() === "%PDF-"
    );

    // ─── FAST PATH: Fillable AcroForm PDF ───────────────
    if (isPdf && rawBytes) {
      try {
        const srcDoc = await PDFDocument.load(rawBytes);
        const formObj = srcDoc.getForm();
        const acroFields = formObj.getFields();

        if (acroFields.length > 0) {
          // This PDF has AcroForm fields — fill them directly!
          let filled = 0;
          const filledNames: string[] = [];
          const emptyNames: string[] = [];

          // Track all form field names
          const allFieldNames = acroFields.map((f) => f.getName());

          for (const [label, value] of Object.entries(body.filledFields)) {
            if (!value || value === "this" || value === "True") continue;
            const fieldName = matchToFormField(label);
            if (!fieldName) continue;
            try {
              const field = formObj.getTextField(fieldName);
              field.setText(value);
              filled++;
              filledNames.push(fieldName);
            } catch {
              // Field might not exist or not be a text field
            }
          }

          // Find unfilled fields
          for (const name of allFieldNames) {
            if (!filledNames.includes(name)) {
              emptyNames.push(name);
            }
          }

          const isComplete = emptyNames.length === 0;

          // Flatten so fields show as printed text
          formObj.flatten();
          const pdfBytes = await srcDoc.save();
          return NextResponse.json({
            pdf: Buffer.from(pdfBytes).toString("base64"),
            filename: `formsaathi-${isComplete ? "complete" : "incomplete"}-${Date.now()}.pdf`,
            method: "acroform",
            fieldsFilled: filled,
            totalFields: allFieldNames.length,
            emptyFields: emptyNames,
            isComplete,
          });
        }
      } catch {
        // Not a fillable PDF — fall through to summary approach
      }
    }

    // ─── SLOW PATH: Original form + Summary page ────────
    const pdfDoc = await PDFDocument.create();

    // Copy original form pages if available
    if (isPdf && rawBytes) {
      try {
        const srcDoc = await PDFDocument.load(rawBytes);
        const indices = Array.from({ length: srcDoc.getPageCount() }, (_, i) => i);
        const copiedPages = await pdfDoc.copyPages(srcDoc, indices);
        for (const p of copiedPages) pdfDoc.addPage(p);
      } catch { /* skip */ }
    } else if (rawBytes) {
      // Image input
      try {
        const isJpeg = body.formImage?.includes("image/jpeg") || (rawBytes[0] === 0xff && rawBytes[1] === 0xd8);
        const image = isJpeg ? await pdfDoc.embedJpg(rawBytes) : await pdfDoc.embedPng(rawBytes);
        const pw = 595.28;
        const ph = image.height * (pw / image.width);
        const page = pdfDoc.addPage([pw, ph]);
        page.drawImage(image, { x: 0, y: 0, width: pw, height: ph });
      } catch { /* skip */ }
    }

    // Summary page
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const HAS_NON_LATIN = /[^\u0000-\u007F]/;

    function latinSafe(text: string): string {
      if (text.includes("/")) {
        const parts = text.split("/");
        const en = parts.find((p) => !HAS_NON_LATIN.test(p.trim()));
        if (en) return en.trim();
      }
      return text.replace(/[^\u0000-\u007F]/g, "").replace(/\s+/g, " ").trim() || "Field";
    }

    let summaryPage: PDFPage = pdfDoc.addPage([595.28, 841.89]);
    let y = summaryPage.getSize().height - 50;

    const title = body.title ?? "Filled Form Summary — FormSaathi";
    summaryPage.drawText(title, { x: 50, y, size: 16, font: boldFont, color: rgb(0, 0.3, 0) });
    y -= 24;
    summaryPage.drawText("Generated by FormSaathi", { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 8;
    summaryPage.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;

    const entries = Object.entries(body.filledFields).filter(([, v]) => v && v !== "this" && v !== "True");
    for (const [label, value] of entries) {
      if (y < 60) {
        summaryPage = pdfDoc.addPage([595.28, 841.89]);
        y = summaryPage.getSize().height - 50;
      }
      const safeLabel = latinSafe(label);
      const safeValue = HAS_NON_LATIN.test(value) ? (latinSafe(value) || "") : value;
      summaryPage.drawText(safeLabel + ":", { x: 50, y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      if (safeValue) {
        summaryPage.drawText(safeValue, { x: 280, y, size: 11, font, color: rgb(0, 0.15, 0.4) });
      }
      y -= 22;
    }

    const pdfBytes = await pdfDoc.save();
    return NextResponse.json({
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `formsaathi-filled-${Date.now()}.pdf`,
      method: "summary",
    });
  } catch (err) {
    console.error("[agent/fill-pdf]", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
