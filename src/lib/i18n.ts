import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import bn from "@/locales/bn.json";
import te from "@/locales/te.json";
import mr from "@/locales/mr.json";
import ta from "@/locales/ta.json";
import kn from "@/locales/kn.json";
import ml from "@/locales/ml.json";
import ur from "@/locales/ur.json";
import gu from "@/locales/gu.json";
import pa from "@/locales/pa.json";
import or from "@/locales/or.json";
import as from "@/locales/as.json";

import { STORAGE_LANGUAGE_CODE } from "@/lib/language-storage";

function detectSavedLanguage(): string {
  if (typeof window === "undefined") return "en";
  try {
    const code = localStorage.getItem(STORAGE_LANGUAGE_CODE);
    if (code && SUPPORTED_LANGS.has(code)) return code;
  } catch { /* SSR or restricted storage */ }
  return "en";
}

const SUPPORTED_LANGS = new Set([
  "en", "hi", "bn", "te", "mr", "ta", "kn", "ml", "ur",
  "gu", "pa", "or", "as",
]);

const i18nInstance = i18n.createInstance();

i18nInstance.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    te: { translation: te },
    mr: { translation: mr },
    ta: { translation: ta },
    kn: { translation: kn },
    ml: { translation: ml },
    ur: { translation: ur },
    gu: { translation: gu },
    pa: { translation: pa },
    or: { translation: or },
    as: { translation: as },
  },
  lng: detectSavedLanguage(),
  fallbackLng: ["en"],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18nInstance;
