"use client";

/**
 * Client-side translation cache powered by OpenRouter translate.
 * Caches results in memory + localStorage so repeat visits are instant.
 */

import { useEffect, useState } from "react";
import type { IndianLanguageCode } from "@/lib/indian-languages";
import { openrouterTranslate } from "@/lib/openrouter-client";

const STORAGE_KEY = "formsaathi_translations";

const memoryCache = new Map<string, string>();

function cacheKey(text: string, lang: string): string {
  return `${lang}::${text}`;
}

function loadStorageCache(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries: [string, string][] = JSON.parse(raw);
    for (const [k, v] of entries) memoryCache.set(k, v);
  } catch { /* corrupt data — ignore */ }
}

function persistStorageCache(): void {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(memoryCache.entries()).slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* quota — ignore */ }
}

let storageLoaded = false;
function ensureStorageLoaded(): void {
  if (storageLoaded) return;
  storageLoaded = true;
  loadStorageCache();
}

/**
 * Translate a single text string from English to the target language.
 * Returns from cache immediately if available.
 */
export async function translateText(
  text: string,
  lang: IndianLanguageCode,
): Promise<string> {
  if (!text) return text;
  ensureStorageLoaded();
  const key = cacheKey(text, lang);
  const cached = memoryCache.get(key);
  if (cached) return cached;

  try {
    const translated = await openrouterTranslate(text, lang, "en-IN");
    memoryCache.set(key, translated);
    persistStorageCache();
    return translated;
  } catch {
    return text;
  }
}

/**
 * Translate a batch of texts. Uses Promise.allSettled so one failure
 * doesn't block the rest. Results preserve input order.
 */
export async function translateBatch(
  texts: string[],
  lang: IndianLanguageCode,
): Promise<string[]> {
  ensureStorageLoaded();

  const results = await Promise.allSettled(
    texts.map((t) => translateText(t, lang)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : texts[i],
  );
}

// ─── React hook ────────────────────────────────────────

export function useTranslatedText(
  text: string,
  lang: IndianLanguageCode,
): string {
  const [translated, setTranslated] = useState(() => {
    ensureStorageLoaded();
    return memoryCache.get(cacheKey(text, lang)) ?? text;
  });

  useEffect(() => {
    let cancelled = false;
    translateText(text, lang).then((t) => {
      if (!cancelled) setTranslated(t);
    });
    return () => { cancelled = true; };
  }, [text, lang]);

  return translated;
}

/**
 * Translate an array of texts. Returns the original texts until
 * translations resolve, then re-renders with translated versions.
 */
export function useTranslatedBatch(
  texts: string[],
  lang: IndianLanguageCode,
): string[] {
  const [translated, setTranslated] = useState<string[]>(texts);

  useEffect(() => {
    let cancelled = false;
    translateBatch(texts, lang).then((t) => {
      if (!cancelled) setTranslated(t);
    });
    return () => { cancelled = true; };
  }, [texts.join("\0"), lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return translated;
}
