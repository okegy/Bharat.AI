// src/lib/central-doc-extractor.ts
/**
 * Normalises OCR output from Aadhaar, Driver Licence and PAN card
 * into a common shape.
 */
export interface CentralDocument {
  /** Document type: "aadhaar" | "dl" | "pan" */
  type: "aadhaar" | "dl" | "pan";
  /** Fully‑qualified identifier (Aadhaar number, DL number, PAN) */
  id: string;
  /** Person’s full name */
  name: string;
  /** Date of birth (ISO string) – may be missing for some docs */
  dob?: string;
  /** Optional address block (concatenated string) */
  address?: string;
}

/**
 * Convert raw OCR key/value map into a CentralDocument.
 *
 * @param raw – the object returned by /api/ocr/parse (e.g. { Name: "...", "Aadhaar No": "...", … })
 * @param docType – which document the OCR result belongs to
 */
export function toCentralDocument(
  raw: Record<string, string>,
  docType: "aadhaar" | "dl" | "pan"
): CentralDocument {
  // Normalise keys – lower‑case and strip spaces/punctuation for easy matching
  const map = new Map<string, string>();
  Object.entries(raw).forEach(([k, v]) => {
    map.set(k.trim().toLowerCase().replace(/[\s_-]/g, ""), v.trim());
  });

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = map.get(k.toLowerCase().replace(/[\s_-]/g, ""));
      if (v) return v;
    }
    return undefined;
  };

  if (docType === "aadhaar") {
    return {
      type: "aadhaar",
      id: get("aadhaarno", "aadhaarnumber", "uid") ?? "",
      name: get("name", "fullname") ?? "",
      dob: get("dob", "dateofbirth") ?? undefined,
      address: get("address", "residentialaddress") ?? undefined,
    };
  }

  if (docType === "dl") {
    return {
      type: "dl",
      id: get("dlno", "drivinglicensenumber", "licensenumber") ?? "",
      name: get("name", "fullname") ?? "",
      dob: get("dob", "dateofbirth") ?? undefined,
      address: get("address") ?? undefined,
    };
  }

  // PAN
  return {
    type: "pan",
    id: get("pannumber", "pan") ?? "",
    name: get("name", "fullname") ?? "",
    dob: undefined,
    address: undefined,
  };
}
