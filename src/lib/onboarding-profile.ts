"use client";

import type { IndianLanguageCode } from "@/lib/indian-languages";
import type { VoiceOnboardingQuestionId } from "@/lib/voice-copy";
import { matchTranscriptToChoice } from "@/lib/voice-match";

type OptionDef = {
  value: string;
  labels: Partial<Record<IndianLanguageCode, string>>;
};

type QuestionDef = {
  id: VoiceOnboardingQuestionId;
  inputType: "text" | "select" | "number";
  placeholder: Partial<Record<IndianLanguageCode, string>>;
  options?: OptionDef[];
};

const GENDER_OPTIONS: OptionDef[] = [
  { value: "Male", labels: { hi: "पुरुष", bn: "পুরুষ", te: "పురుషుడు", mr: "पुरुष", ta: "ஆண்", gu: "પુરુષ", kn: "ಪುರುಷ", ml: "പുരുഷൻ", pa: "ਪੁਰਸ਼", or: "ପୁରୁଷ", as: "পুৰুষ", ur: "مرد" } },
  { value: "Female", labels: { hi: "महिला", bn: "মহিলা", te: "మహిళ", mr: "महिला", ta: "பெண்", gu: "મહિલા", kn: "ಮಹಿಳೆ", ml: "സ്ത്രീ", pa: "ਇਸਤਰੀ", or: "ମହିଳା", as: "মহিলা", ur: "خاتون" } },
  { value: "Other", labels: { hi: "अन्य", bn: "অন্যান্য", te: "ఇతర", mr: "इतर", ta: "மற்றவை", gu: "અન્ય", kn: "ಇತರೆ", ml: "മറ്റ്", pa: "ਹੋਰ", or: "ଅନ୍ୟ", as: "অন্যান্য", ur: "دیگر" } },
];

const OCCUPATION_OPTIONS: OptionDef[] = [
  { value: "Farmer", labels: { hi: "किसान", bn: "কৃষক", te: "రైతు", mr: "शेतकरी", ta: "விவசாயி", gu: "ખેડૂત", kn: "ರೈತ", ml: "കർഷകൻ", pa: "ਕਿਸਾਨ", or: "ଚାଷୀ", as: "কৃষক", ur: "کسان" } },
  { value: "Daily Wage", labels: { hi: "दैनिक मज़दूरी", bn: "দৈনিক মজুরি", te: "రోజువారీ కూలి", mr: "दैनिक मजुरी", ta: "தினக்கூலி", gu: "દૈનિક મજૂરી", kn: "ದಿನಗೂಲಿ", ml: "ദിനക്കൂലി", pa: "ਰੋਜ਼ਾਨਾ ਮਜ਼ਦੂਰੀ", or: "ଦିନକମ୍ମ", as: "দৈনিক মজুৰি", ur: "یومیہ مزدوری" } },
  { value: "Self-Employed", labels: { hi: "स्व-रोज़गार", bn: "স্বনিয়োজিত", te: "స్వయం ఉపాధి", mr: "स्वरोजगार", ta: "சுயதொழில்", gu: "સ્વરોજગાર", kn: "ಸ್ವಯಂ ಉದ್ಯೋಗ", ml: "സ്വയം തൊഴിൽ", pa: "ਸਵੈਰੋਜ਼ਗਾਰ", or: "ସ୍ୱୟଂରୋଜଗାର", as: "স্বনিয়োজিত", ur: "خود روزگار" } },
  { value: "Government Job", labels: { hi: "सरकारी नौकरी", bn: "সরকারি চাকরি", te: "ప్రభుత్వ ఉద్యోగం", mr: "सरकारी नोकरी", ta: "அரசு வேலை", gu: "સરકારી નોકરી", kn: "ಸರ್ಕಾರಿ ಉದ್ಯೋಗ", ml: "സർക്കാർ ജോലി", pa: "ਸਰਕਾਰੀ ਨੌਕਰੀ", or: "ସରକାରୀ ଚାକିରି", as: "চৰকাৰী চাকৰি", ur: "سرکاری نوکری" } },
  { value: "Private Job", labels: { hi: "निजी नौकरी", bn: "বেসরকারি চাকরি", te: "ప్రైవేట్ ఉద్యోగం", mr: "खासगी नोकरी", ta: "தனியார் வேலை", gu: "ખાનગી નોકરી", kn: "ಖಾಸಗಿ ಉದ್ಯೋಗ", ml: "സ്വകാര്യ ജോലി", pa: "ਨਿੱਜੀ ਨੌਕਰੀ", or: "ବେସରକାରୀ ଚାକିରି", as: "বেচৰকাৰী চাকৰি", ur: "نجی نوکری" } },
  { value: "Student", labels: { hi: "छात्र", bn: "ছাত্র", te: "విద్యార్థి", mr: "विद्यार्थी", ta: "மாணவர்", gu: "વિદ્યાર્થી", kn: "ವಿದ್ಯಾರ್ಥಿ", ml: "വിദ്യാർത്ഥി", pa: "ਵਿਦਿਆਰਥੀ", or: "ଛାତ୍ର", as: "ছাত্ৰ", ur: "طالب علم" } },
  { value: "Homemaker", labels: { hi: "गृहिणी", bn: "গৃহিণী", te: "గృహిణి", mr: "गृहिणी", ta: "இல்லத்தரசி", gu: "ગૃહિણિ", kn: "ಗೃಹಿಣಿ", ml: "ഗൃഹിണി", pa: "ਘਰੇਲੂ ਸੰਭਾਲਕ", or: "ଗୃହିଣୀ", as: "গৃহিণী", ur: "گھریلو خاتون" } },
  { value: "Unemployed", labels: { hi: "बेरोज़गार", bn: "বেকার", te: "నిరుద్యోగి", mr: "बेकार", ta: "வேலை இன்றி", gu: "બેરોજગાર", kn: "ನಿರುದ್ಯೋಗಿ", ml: "തൊഴിൽ ഇല്ല", pa: "ਬੇਰੋਜ਼ਗਾਰ", or: "ବେରୋଜଗାର", as: "নিযুক্ত নহয়", ur: "بے روزگار" } },
  { value: "Retired", labels: { hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত", te: "విరమణ పొందిన", mr: "निवृत्त", ta: "ஓய்வு பெற்றவர்", gu: "નિવૃત્ત", kn: "ನಿವೃತ್ತ", ml: "വിരമിച്ച", pa: "ਸੇਵਾਮੁਕਤ", or: "ଅବସରପ୍ରାପ୍ତ", as: "অৱসৰপ্ৰাপ্ত", ur: "ریٹائرڈ" } },
];

const INCOME_OPTIONS: OptionDef[] = [
  { value: "Below ₹1 lakh", labels: { hi: "₹1 लाख से कम", bn: "₹1 লাখের নিচে", te: "₹1 లక్షకు దిగువ", mr: "₹1 लाखांखाली", ta: "₹1 லட்சத்திற்குக் கீழே", gu: "₹1 લાખથી ઓછી", kn: "₹1 ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ", ml: "₹1 ലക്ഷത്തിൽ താഴെ", pa: "₹1 ਲੱਖ ਤੋਂ ਘੱਟ", or: "₹1 ଲକ୍ଷରୁ କମ", as: "₹1 লাখতকৈ কম", ur: "₹1 لاکھ سے کم" } },
  { value: "₹1-2 lakh", labels: { hi: "₹1-2 लाख", bn: "₹1-2 লাখ", te: "₹1-2 లక్షలు", mr: "₹1-2 लाख", ta: "₹1-2 லட்சம்", gu: "₹1-2 લાખ", kn: "₹1-2 ಲಕ್ಷ", ml: "₹1-2 ലക്ഷം", pa: "₹1-2 ਲੱਖ", or: "₹1-2 ଲକ୍ଷ", as: "₹1-2 লাখ", ur: "₹1-2 لاکھ" } },
  { value: "₹2-3 lakh", labels: { hi: "₹2-3 लाख", bn: "₹2-3 লাখ", te: "₹2-3 లక్షలు", mr: "₹2-3 लाख", ta: "₹2-3 லட்சம்", gu: "₹2-3 લાખ", kn: "₹2-3 ಲಕ್ಷ", ml: "₹2-3 ലക്ഷം", pa: "₹2-3 ਲੱਖ", or: "₹2-3 ଲକ୍ଷ", as: "₹2-3 লাখ", ur: "₹2-3 لاکھ" } },
  { value: "₹3-5 lakh", labels: { hi: "₹3-5 लाख", bn: "₹3-5 লাখ", te: "₹3-5 లక్షలు", mr: "₹3-5 लाख", ta: "₹3-5 லட்சம்", gu: "₹3-5 લાખ", kn: "₹3-5 ಲಕ್ಷ", ml: "₹3-5 ലക്ഷം", pa: "₹3-5 ਲੱਖ", or: "₹3-5 ଲକ୍ଷ", as: "₹3-5 লাখ", ur: "₹3-5 لاکھ" } },
  { value: "₹5-10 lakh", labels: { hi: "₹5-10 लाख", bn: "₹5-10 লাখ", te: "₹5-10 లక్షలు", mr: "₹5-10 लाख", ta: "₹5-10 லட்சம்", gu: "₹5-10 લાખ", kn: "₹5-10 ಲಕ್ಷ", ml: "₹5-10 ലക്ഷം", pa: "₹5-10 ਲੱਖ", or: "₹5-10 ଲକ୍ଷ", as: "₹5-10 লাখ", ur: "₹5-10 لاکھ" } },
  { value: "Above ₹10 lakh", labels: { hi: "₹10 लाख से ऊपर", bn: "₹10 লাখের বেশি", te: "₹10 లక్షలకు పైగా", mr: "₹10 लाखांपेक्षा जास्त", ta: "₹10 லட்சத்திற்கு மேல்", gu: "₹10 લાખથી વધુ", kn: "₹10 ಲಕ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು", ml: "₹10 ലക്ഷത്തിൽ കൂടുതൽ", pa: "₹10 ਲੱਖ ਤੋਂ ਵੱਧ", or: "₹10 ଲକ୍ଷରୁ ଅଧିକ", as: "₹10 লাখতকৈ অধিক", ur: "₹10 لاکھ سے زیادہ" } },
];

const CATEGORY_OPTIONS: OptionDef[] = [
  { value: "General", labels: { hi: "सामान्य", bn: "সাধারণ", te: "జనరల్", mr: "सामान्य", ta: "பொது", gu: "જનરલ", kn: "ಸಾಮಾನ್ಯ", ml: "ജനറൽ", pa: "ਜਨਰਲ", or: "ସାଧାରଣ", as: "সাধাৰণ", ur: "جنرل" } },
  { value: "OBC", labels: { hi: "ओबीसी", bn: "ওবিসি", te: "ఓబీసీ", mr: "ओबीसी", ta: "ஓபிசி", gu: "ઓબીસી", kn: "ಒಬಿಸಿ", ml: "ഒബിസി", pa: "ਓਬੀਸੀ", or: "ଓବିସି", as: "অ’বিচি", ur: "او بی سی" } },
  { value: "SC", labels: { hi: "एससी", bn: "এসসি", te: "ఎస్సీ", mr: "एससी", ta: "எஸ்சி", gu: "એસસી", kn: "ಎಸ್‌ಸಿ", ml: "എസ്‌സി", pa: "ਐਸਸੀ", or: "ଏସସି", as: "এছচি", ur: "ایس سی" } },
  { value: "ST", labels: { hi: "एसटी", bn: "এসটি", te: "ఎస్టీ", mr: "एसटी", ta: "எஸ்டி", gu: "એસટી", kn: "ಎಸ್‌ಟಿ", ml: "എസ്‌ടി", pa: "ਐਸਟੀ", or: "ଏସଟି", as: "এছটি", ur: "ایس ٹی" } },
  { value: "Minority", labels: { hi: "अल्पसंख्यक", bn: "সংখ্যালঘু", te: "అల్పసంఖ్యాక", mr: "अल्पसंख्याक", ta: "சிறுபான்மை", gu: "અલ્પસંખ્યક", kn: "ಅಲ್ಪಸಂಖ್ಯಾತ", ml: "അൽപസംഖ്യ", pa: "ਘੱਟਗਿਣਤੀ", or: "ଅଲ୍ପସଂଖ୍ୟକ", as: "সংখ্যালঘু", ur: "اقلیت" } },
  { value: "General-EWS", labels: { hi: "सामान्य-ईडब्ल्यूएस", bn: "জেনারেল-ইডব্লিউএস", te: "జనరల్-ఈడబ్ల్యూఎస్", mr: "सामान्य-ईडब्ल्यूएस", ta: "ஜெனரல்-ஈடபிள்யூஎஸ்", gu: "જનરલ-ઈડબ્લ્યુએસ", kn: "ಸಾಮಾನ್ಯ-ಇಡಬ್ಲ್ಯೂಎಸ್", ml: "ജനറൽ-ഇഡബ്ല്യുഎസ്", pa: "ਜਨਰਲ-ਈਡਬਲਿਊਐਸ", or: "ସାଧାରଣ-ଇଡବ୍ଲ୍ୟୁଏସ", as: "জেনেৰেল-ইডব্লিউএছ", ur: "جنرل-ای ڈبلیو ایس" } },
];

const QUESTIONS: QuestionDef[] = [
  {
    id: "fullName",
    inputType: "text",
    placeholder: { en: "Enter your full name", hi: "अपना पूरा नाम लिखें", bn: "আপনার পূর্ণ নাম লিখুন", te: "మీ పూర్తి పేరు నమోదు చేయండి", mr: "तुमचे पूर्ण नाव लिहा", ta: "உங்கள் முழு பெயரை உள்ளிடவும்", gu: "તમારું પૂરું નામ દાખલ કરો", kn: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ", ml: "നിങ്ങളുടെ പൂർണ്ണ പേര് നൽകുക", pa: "ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਦਰਜ ਕਰੋ", or: "ଆପଣଙ୍କ ପୂରା ନାମ ଲେଖନ୍ତୁ", as: "আপোনাৰ সম্পূৰ্ণ নাম লিখক", ur: "اپنا پورا نام درج کریں" },
  },
  {
    id: "gender",
    inputType: "select",
    placeholder: { en: "Select gender", hi: "लिंग चुनें", bn: "লিঙ্গ বেছে নিন", te: "లింగాన్ని ఎంచుకోండి", mr: "लिंग निवडा", ta: "பாலினத்தைத் தேர்ந்தெடுக்கவும்", gu: "લિંગ પસંદ કરો", kn: "ಲಿಂಗ ಆಯ್ಕೆಮಾಡಿ", ml: "ലിംഗഭേദം തിരഞ്ഞെടുക്കുക", pa: "ਲਿੰਗ ਚੁਣੋ", or: "ଲିଙ୍ଗ ଚୟନ କରନ୍ତୁ", as: "লিংগ বাছনি কৰক", ur: "جنس منتخب کریں" },
    options: GENDER_OPTIONS,
  },
  {
    id: "state",
    inputType: "select",
    placeholder: { en: "Select or say your state", hi: "राज्य चुनें या बोलें", bn: "রাজ্য বেছে নিন বা বলুন", te: "రాష్ట్రాన్ని ఎంచుకోండి లేదా చెప్పండి", mr: "राज्य निवडा किंवा बोला", ta: "மாநிலத்தைத் தேர்ந்தெடுக்கவும் அல்லது சொல்லவும்", gu: "રાજ્ય પસંદ કરો અથવા બોલો", kn: "ರಾಜ್ಯ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಹೇಳಿ", ml: "സംസ്ഥാനം തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ പറയുക", pa: "ਸੂਬਾ ਚੁਣੋ ਜਾਂ ਬੋਲੋ", or: "ରାଜ୍ୟ ଚୟନ କରନ୍ତୁ କିମ୍ବା କୁହନ୍ତୁ", as: "ৰাজ্য বাছনি কৰক বা কওক", ur: "ریاست منتخب کریں یا بولیں" },
    options: [
      "Uttar Pradesh",
      "Maharashtra",
      "Bihar",
      "West Bengal",
      "Madhya Pradesh",
      "Tamil Nadu",
      "Rajasthan",
      "Karnataka",
      "Gujarat",
      "Andhra Pradesh",
      "Odisha",
      "Kerala",
      "Telangana",
      "Jharkhand",
      "Assam",
      "Punjab",
      "Chhattisgarh",
      "Haryana",
      "Delhi",
      "Uttarakhand",
    ].map((value) => ({ value, labels: {} })),
  },
  {
    id: "occupation",
    inputType: "select",
    placeholder: { en: "Select or say your occupation", hi: "व्यवसाय चुनें या बोलें", bn: "পেশা বেছে নিন বা বলুন", te: "వృత్తిని ఎంచుకోండి లేదా చెప్పండి", mr: "व्यवसाय निवडा किंवा बोला", ta: "தொழிலைத் தேர்ந்தெடுக்கவும் அல்லது சொல்லவும்", gu: "વ્યવસાય પસંદ કરો અથવા બોલો", kn: "ಉದ್ಯೋಗ ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಹೇಳಿ", ml: "തൊഴിൽ തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ പറയുക", pa: "ਕਿੱਤਾ ਚੁਣੋ ਜਾਂ ਬੋਲੋ", or: "ବୃତ୍ତି ଚୟନ କରନ୍ତୁ କିମ୍ବା କୁହନ୍ତୁ", as: "বৃত্তি বাছনি কৰক বা কওক", ur: "پیشہ منتخب کریں یا بولیں" },
    options: OCCUPATION_OPTIONS,
  },
  {
    id: "annualIncome",
    inputType: "select",
    placeholder: { en: "Select income range", hi: "आय सीमा चुनें", bn: "আয়ের সীমা বেছে নিন", te: "ఆదాయ పరిమితిని ఎంచుకోండి", mr: "उत्पन्न श्रेणी निवडा", ta: "வருமான வரம்பைத் தேர்ந்தெடுக்கவும்", gu: "આવકની શ્રેણી પસંદ કરો", kn: "ಆದಾಯ ಶ್ರೇಣಿ ಆಯ್ಕೆಮಾಡಿ", ml: "വരുമാന പരിധി തിരഞ്ഞെടുക്കുക", pa: "ਆਮਦਨ ਸੀਮਾ ਚੁਣੋ", or: "ଆୟ ସୀମା ଚୟନ କରନ୍ତୁ", as: "আয়ৰ সীমা বাছনি কৰক", ur: "آمدنی کی حد منتخب کریں" },
    options: INCOME_OPTIONS,
  },
  {
    id: "category",
    inputType: "select",
    placeholder: { en: "Select category", hi: "श्रेणी चुनें", bn: "শ্রেণি বেছে নিন", te: "వర్గాన్ని ఎంచుకోండి", mr: "श्रेणी निवडा", ta: "வகையைத் தேர்ந்தெடுக்கவும்", gu: "શ્રેણી પસંદ કરો", kn: "ವರ್ಗ ಆಯ್ಕೆಮಾಡಿ", ml: "വിഭാഗം തിരഞ്ഞെടുക്കുക", pa: "ਸ਼੍ਰੇਣੀ ਚੁਣੋ", or: "ବର୍ଗ ଚୟନ କରନ୍ତୁ", as: "শ্ৰেণী বাছনি কৰক", ur: "زمرہ منتخب کریں" },
    options: CATEGORY_OPTIONS,
  },
];

const INCOME_MAP: Record<string, string> = {
  "Below ₹1 lakh": "100000",
  "₹1-2 lakh": "200000",
  "₹2-3 lakh": "300000",
  "₹3-5 lakh": "500000",
  "₹5-10 lakh": "1000000",
  "Above ₹10 lakh": "1500000",
};

function getQuestion(id: VoiceOnboardingQuestionId): QuestionDef {
  return QUESTIONS.find((q) => q.id === id) ?? QUESTIONS[0]!;
}

export function getOnboardingInputType(
  id: VoiceOnboardingQuestionId,
): "text" | "select" | "number" {
  return getQuestion(id).inputType;
}

export function getOnboardingPlaceholder(
  lang: IndianLanguageCode,
  id: VoiceOnboardingQuestionId,
): string {
  const q = getQuestion(id);
  return q.placeholder[lang] ?? q.placeholder.en ?? "Enter your answer";
}

export function getOnboardingOptions(
  lang: IndianLanguageCode,
  id: VoiceOnboardingQuestionId,
): Array<{ value: string; label: string }> {
  const q = getQuestion(id);
  return (q.options ?? []).map((option) => ({
    value: option.value,
    label: option.labels[lang] ?? option.value,
  }));
}

export function getStoredOnboardingValue(
  id: VoiceOnboardingQuestionId,
  raw: string,
): string {
  if (id === "annualIncome") {
    return INCOME_MAP[raw] ?? raw;
  }
  return raw;
}

export function matchOnboardingTranscript(
  id: VoiceOnboardingQuestionId,
  transcript: string,
): string | null {
  const q = getQuestion(id);
  if (!q.options?.length) return transcript.trim() || null;

  return matchTranscriptToChoice(
    transcript,
    q.options.map((option) => ({
      value: option.value,
      surfaces: [
        option.value,
        ...Object.values(option.labels),
      ].filter(Boolean) as string[],
    })),
  );
}
