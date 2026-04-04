"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import { getSelectedLanguageCode, syncLanguageFromServer } from "@/lib/language-storage";
import { getBcp47 } from "@/lib/speech-engine";
import "@/lib/i18n";

type AppLanguageContextValue = {
  language: IndianLanguageCode;
  dir: "ltr" | "rtl";
  locale: string;
};

const AppLanguageContext = createContext<AppLanguageContextValue>({
  language: "en",
  dir: "ltr",
  locale: "en-IN",
});

const RTL_LANGUAGES = new Set<IndianLanguageCode>(["ur"]);

export function getTextDirection(
  language: IndianLanguageCode,
): "ltr" | "rtl" {
  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}

export function getDisplayLocale(language: IndianLanguageCode): string {
  return getBcp47(language);
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<IndianLanguageCode>("en");
  const { isSignedIn } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    const syncLanguage = () => {
      const next = getSelectedLanguageCode() ?? "en";
      setLanguage(next);
      if (i18n.language !== next) void i18n.changeLanguage(next);
    };

    syncLanguage();
    window.addEventListener("storage", syncLanguage);
    window.addEventListener("formsaathi:languagechange", syncLanguage);

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener("formsaathi:languagechange", syncLanguage);
    };
  }, [i18n]);

  useEffect(() => {
    if (!isSignedIn) return;
    void syncLanguageFromServer().then((lang) => {
      if (lang) {
        setLanguage(lang);
        if (i18n.language !== lang) void i18n.changeLanguage(lang);
      }
    });
  }, [isSignedIn, i18n]);

  useEffect(() => {
    document.documentElement.lang = getBcp47(language);
    document.documentElement.dir = getTextDirection(language);
  }, [language]);

  const value = useMemo<AppLanguageContextValue>(
    () => ({
      language,
      dir: getTextDirection(language),
      locale: getDisplayLocale(language),
    }),
    [language],
  );

  return (
    <AppLanguageContext.Provider value={value}>
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppLanguage(): AppLanguageContextValue {
  return useContext(AppLanguageContext);
}
