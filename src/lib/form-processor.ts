/**
 * Form processing — language detection, field extraction, and profile matching.
 * Used by the agent tools and the /form-fill page.
 */

import type { ProfileData } from "@/lib/profile-vault";

export interface ExtractedFormField {
  label: string;
  labelEnglish: string;
  value: string;
  type: "text" | "checkbox" | "date" | "number" | "select";
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormScanResult {
  language: string;
  languageName: string;
  fields: ExtractedFormField[];
  rawText?: string;
}

export interface FieldMatchResult {
  filled: Record<string, string>;
  missing: string[];
  totalFields: number;
}

/**
 * Multilingual alias table — maps common Indian form field labels to ProfileData keys.
 * Each alias is lowercased for matching.
 */
const FIELD_ALIASES: Record<string, keyof ProfileData> = {
  // English
  "full name": "fullName",
  "name": "fullName",
  "applicant name": "fullName",
  "applicant's name": "fullName",
  "your name": "fullName",
  "father name": "fatherName",
  "father's name": "fatherName",
  "parent name": "fatherName",
  "date of birth": "dob",
  "dob": "dob",
  "birth date": "dob",
  "d.o.b": "dob",
  "gender": "gender",
  "sex": "gender",
  "aadhaar": "aadhaarNumber",
  "aadhaar number": "aadhaarNumber",
  "aadhaar no": "aadhaarNumber",
  "aadhar number": "aadhaarNumber",
  "aadhar no": "aadhaarNumber",
  "uid number": "aadhaarNumber",
  "uid": "aadhaarNumber",
  "address": "address",
  "residential address": "address",
  "permanent address": "address",
  "present address": "address",
  "correspondence address": "address",
  "district": "district",
  "state": "state",
  "state/ut": "state",
  "pin code": "pincode",
  "pincode": "pincode",
  "pin": "pincode",
  "postal code": "pincode",
  "zip code": "pincode",
  "mobile": "phone",
  "phone": "phone",
  "mobile number": "phone",
  "phone number": "phone",
  "mobile no": "phone",
  "contact number": "phone",
  "contact no": "phone",
  "telephone": "phone",
  "occupation": "occupation",
  "employment": "occupation",
  "profession": "occupation",
  "annual income": "annualIncome",
  "income": "annualIncome",
  "yearly income": "annualIncome",
  "family income": "annualIncome",
  "household income": "annualIncome",
  "category": "category",
  "caste": "category",
  "social category": "category",
  "caste category": "category",
  "education": "education",
  "qualification": "education",
  "educational qualification": "education",
  "bank account": "bankAccount",
  "account number": "bankAccount",
  "bank account number": "bankAccount",
  "a/c number": "bankAccount",
  "ration card": "rationCardType",
  "ration card type": "rationCardType",
  "ration card number": "rationCardType",
  "land ownership": "landOwnership",
  "land details": "landOwnership",
  "disability": "disabilityStatus",
  "disability status": "disabilityStatus",
  "marital status": "maritalStatus",
  "married": "maritalStatus",
  "dependents": "numberOfDependents",
  "number of dependents": "numberOfDependents",
  "family members": "numberOfDependents",

  // Hindi (Devanagari)
  "नाम": "fullName",
  "पूरा नाम": "fullName",
  "आवेदक का नाम": "fullName",
  "पिता का नाम": "fatherName",
  "पिता/पति का नाम": "fatherName",
  "जन्म तिथि": "dob",
  "जन्मतिथि": "dob",
  "लिंग": "gender",
  "आधार संख्या": "aadhaarNumber",
  "आधार नंबर": "aadhaarNumber",
  "पता": "address",
  "स्थायी पता": "address",
  "निवास पता": "address",
  "जिला": "district",
  "राज्य": "state",
  "पिन कोड": "pincode",
  "मोबाइल नंबर": "phone",
  "मोबाइल": "phone",
  "फोन": "phone",
  "व्यवसाय": "occupation",
  "वार्षिक आय": "annualIncome",
  "आय": "annualIncome",
  "जाति": "category",
  "वर्ग": "category",
  "श्रेणी": "category",
  "शिक्षा": "education",
  "बैंक खाता": "bankAccount",
  "राशन कार्ड": "rationCardType",
  "वैवाहिक स्थिति": "maritalStatus",

  // Bengali
  "নাম": "fullName",
  "পূর্ণ নাম": "fullName",
  "পিতার নাম": "fatherName",
  "জন্ম তারিখ": "dob",
  "লিঙ্গ": "gender",
  "আধার নম্বর": "aadhaarNumber",
  "ঠিকানা": "address",
  "জেলা": "district",
  "রাজ্য": "state",
  "পিন কোড": "pincode",
  "মোবাইল নম্বর": "phone",
  "পেশা": "occupation",
  "বার্ষিক আয়": "annualIncome",
  "জাতি": "category",
  "শিক্ষা": "education",

  // Telugu
  "పేరు": "fullName",
  "పూర్తి పేరు": "fullName",
  "తండ్రి పేరు": "fatherName",
  "పుట్టిన తేదీ": "dob",
  "లింగం": "gender",
  "ఆధార్ సంఖ్య": "aadhaarNumber",
  "చిరునామా": "address",
  "జిల్లా": "district",
  "రాష్ట్రం": "state",
  "పిన్ కోడ్": "pincode",
  "మొబైల్ నంబర్": "phone",
  "వృత్తి": "occupation",
  "వార్షిక ఆదాయం": "annualIncome",
  "కులం": "category",

  // Tamil
  "பெயர்": "fullName",
  "முழு பெயர்": "fullName",
  "தந்தை பெயர்": "fatherName",
  "பிறந்த தேதி": "dob",
  "பாலினம்": "gender",
  "ஆதார் எண்": "aadhaarNumber",
  "முகவரி": "address",
  "மாவட்டம்": "district",
  "மாநிலம்": "state",
  "அஞ்சல் குறியீடு": "pincode",
  "கைபேசி எண்": "phone",
  "தொழில்": "occupation",
  "ஆண்டு வருமானம்": "annualIncome",
  "சாதி": "category",

  // Marathi
  "पूर्ण नाव": "fullName",
  "वडिलांचे नाव": "fatherName",
  "जन्मतारीख": "dob",
  "आधार क्रमांक": "aadhaarNumber",
  "पत्ता": "address",
  "जिल्हा": "district",
  "भ्रमणध्वनी": "phone",
  "उत्पन्न": "annualIncome",

  // Gujarati
  "નામ": "fullName",
  "પિતાનું નામ": "fatherName",
  "જન્મ તારીખ": "dob",
  "લિંગ": "gender",
  "આધાર નંબર": "aadhaarNumber",
  "સરનામું": "address",
  "જિલ્લો": "district",
  "રાજ્ય": "state",
  "પિન કોડ": "pincode",
  "મોબાઈલ નંબર": "phone",
  "વ્યવસાય": "occupation",
  "વાર્ષિક આવક": "annualIncome",
  "જાતિ": "category",

  // Kannada
  "ಹೆಸರು": "fullName",
  "ತಂದೆ ಹೆಸರು": "fatherName",
  "ಹುಟ್ಟಿದ ದಿನಾಂಕ": "dob",
  "ಲಿಂಗ": "gender",
  "ಆಧಾರ್ ಸಂಖ್ಯೆ": "aadhaarNumber",
  "ವಿಳಾಸ": "address",
  "ಜಿಲ್ಲೆ": "district",
  "ರಾಜ್ಯ": "state",
  "ಪಿನ್ ಕೋಡ್": "pincode",
  "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ": "phone",
  "ಉದ್ಯೋಗ": "occupation",
  "ವಾರ್ಷಿಕ ಆದಾಯ": "annualIncome",
  "ಜಾತಿ": "category",

  // Malayalam
  "പേര്": "fullName",
  "പിതാവിന്റെ പേര്": "fatherName",
  "ജനന തീയതി": "dob",
  "ലിംഗം": "gender",
  "ആധാർ നമ്പർ": "aadhaarNumber",
  "മേൽവിലാസം": "address",
  "ജില്ല": "district",
  "സംസ്ഥാനം": "state",
  "പിൻ കോഡ്": "pincode",
  "മൊബൈൽ നമ്പർ": "phone",
  "തൊഴിൽ": "occupation",
  "വാർഷിക വരുമാനം": "annualIncome",
  "ജാതി": "category",

  // Punjabi (Gurmukhi)
  "ਨਾਮ": "fullName",
  "ਪਿਤਾ ਦਾ ਨਾਮ": "fatherName",
  "ਜਨਮ ਮਿਤੀ": "dob",
  "ਲਿੰਗ": "gender",
  "ਆਧਾਰ ਨੰਬਰ": "aadhaarNumber",
  "ਪਤਾ": "address",
  "ਜ਼ਿਲ੍ਹਾ": "district",
  "ਸੂਬਾ": "state",
  "ਪਿੰਨ ਕੋਡ": "pincode",
  "ਮੋਬਾਈਲ ਨੰਬਰ": "phone",
  "ਕਿੱਤਾ": "occupation",
  "ਸਾਲਾਨਾ ਆਮਦਨ": "annualIncome",
  "ਜਾਤੀ": "category",

  // Urdu
  "نام": "fullName",
  "والد کا نام": "fatherName",
  "تاریخ پیدائش": "dob",
  "جنس": "gender",
  "آدھار نمبر": "aadhaarNumber",
  "پتہ": "address",
  "ضلع": "district",
  "ریاست": "state",
  "پن کوڈ": "pincode",
  "موبائل نمبر": "phone",
  "پیشہ": "occupation",
  "سالانہ آمدنی": "annualIncome",
  "ذات": "category",
};

/**
 * Match extracted form fields to user profile data using the alias table.
 * Falls back to label substring matching when exact match isn't found.
 */
export function matchFieldsToProfile(
  fields: ExtractedFormField[],
  profile: ProfileData,
): FieldMatchResult {
  const filled: Record<string, string> = {};
  const missing: string[] = [];

  for (const field of fields) {
    const englishLabel = (field.labelEnglish || field.label).toLowerCase().trim();
    const nativeLabel = field.label.toLowerCase().trim();

    let profileKey: keyof ProfileData | undefined;

    // 1. Exact alias match on English label
    if (FIELD_ALIASES[englishLabel]) {
      profileKey = FIELD_ALIASES[englishLabel];
    }

    // 2. Exact alias match on native label
    if (!profileKey && FIELD_ALIASES[nativeLabel]) {
      profileKey = FIELD_ALIASES[nativeLabel];
    }

    // 3. Substring match on English label against aliases (require min 4 chars to avoid false matches)
    if (!profileKey) {
      for (const [alias, key] of Object.entries(FIELD_ALIASES)) {
        if (alias.length >= 4 && englishLabel.includes(alias)) {
          profileKey = key;
          break;
        }
      }
    }

    // 4. Substring match on native label against aliases
    if (!profileKey) {
      for (const [alias, key] of Object.entries(FIELD_ALIASES)) {
        if (alias.length >= 3 && nativeLabel.includes(alias)) {
          profileKey = key;
          break;
        }
      }
    }

    if (profileKey && profile[profileKey]) {
      filled[field.label] = profile[profileKey]!;
    } else if (field.value) {
      filled[field.label] = field.value;
    } else {
      missing.push(field.labelEnglish || field.label);
    }
  }

  return { filled, missing, totalFields: fields.length };
}
