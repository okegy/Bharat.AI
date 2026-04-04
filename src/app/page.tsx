"use client";

import { Trans, useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { GetStartedButton } from "@/components/formsaathi/GetStartedButton";
import { ResumeOnboardingRedirect } from "@/components/formsaathi/ResumeOnboardingRedirect";
import { TopBar } from "@/components/formsaathi/TopBar";
import { INDIAN_LANGUAGES } from "@/lib/indian-languages";
import { useAppLanguage } from "@/lib/app-language";
import { speak, stopSpeaking } from "@/lib/speech-engine";
import "@/lib/i18n";

const STEP_ICONS = [
  "google",
  "lang",
  "fingerprint",
  "mic",
  "chat",
  "search",
  "form",
  "camera",
  "check",
] as const;

function StepIcon({ name }: { name: (typeof STEP_ICONS)[number] }) {
  const stroke = "currentColor";
  const common = {
    className: "h-8 w-8 text-saathi-forest",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeWidth: 1.5,
    stroke,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "google":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 9h3m0 0v3m0-3l-8.25 8.25"
          />
        </svg>
      );
    case "lang":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
          />
        </svg>
      );
    case "fingerprint":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3.75c-3.45 0-6.25 2.8-6.25 6.25v.75m0 3v1.5m0 3v1.5M9 6.75c.62-1.24 1.9-2.1 3.38-2.1 2.07 0 3.75 1.68 3.75 3.75v6M15 9v1.5m0 3v3m-9-4.5c.5 2.32 2.46 4.05 4.88 4.05a4.87 4.87 0 004.37-2.7"
          />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m12 1.5v3.75m-9-3.75v3.75m9-9h1.5M3 18.75h1.5M3 12v-1.5M21 12v-1.5m-9 3.75h9"
          />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      );
    case "form":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
          />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function Home() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();

  // Auto-speak hero tagline
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    const tagline = t("home.heroTitle", { defaultValue: "Government forms, in your language" });
    speak(tagline, language);
    return () => stopSpeaking();
  }, [t, language]);

  return (
    <>
      <TopBar />
      <ResumeOnboardingRedirect />
      <main>
        <section className="relative overflow-hidden bg-hero-mesh px-4 pb-20 pt-28 sm:px-6 sm:pb-28 sm:pt-32">
          <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-saathi-mint/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-saathi-sky/15 blur-3xl" />

          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="relative z-10">
              <p className="mb-4 inline-flex items-center rounded-full border border-saathi-forest/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-saathi-forest backdrop-blur">
                {t("home.badge")}
              </p>
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-saathi-ink sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                <Trans
                  i18nKey="home.heroTitle"
                  components={{
                    1: <span className="text-saathi-forest" />,
                  }}
                />
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-saathi-ink/80">
                {t("home.heroDescription")}
              </p>
              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <GetStartedButton />
                <p className="max-w-xs text-sm text-saathi-ink/60">
                  {t("home.heroSubtext")}
                </p>
              </div>
            </div>

            <div className="relative z-10 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md animate-float">
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-saathi-mint/50 to-saathi-sky/20 blur-xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 p-8 shadow-xl shadow-saathi-ink/10 backdrop-blur">
                  <div className="mb-6 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="ml-auto text-xs font-medium text-saathi-ink/45">
                      {t("home.govtPortalPreview")}
                    </span>
                  </div>
                  <div className="space-y-3 rounded-2xl bg-saathi-cream p-4">
                    <div className="h-2 w-3/4 rounded bg-saathi-sand" />
                    <div className="h-2 w-full rounded bg-saathi-mint/60" />
                    <div className="h-2 w-5/6 rounded bg-saathi-sand" />
                    <div className="h-2 w-2/3 rounded bg-saathi-sand" />
                  </div>
                  <div className="mt-6 flex h-14 items-end justify-center gap-1.5">
                    {[10, 18, 7, 22, 12, 24, 9, 20, 8, 23, 14].map((h, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-saathi-forest/70 animate-pulsebar"
                        style={{
                          height: `${h}px`,
                          animationDelay: `${i * 0.08}s`,
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-center text-xs text-saathi-ink/50">
                    {t("home.agentNarrates")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-saathi-sand bg-white px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold text-saathi-ink sm:text-3xl">
              {t("home.langSectionTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-saathi-ink/70">
              {t("home.langSectionDesc")}
            </p>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {INDIAN_LANGUAGES.map((lang) => (
                <li
                  key={lang.code}
                  className="rounded-2xl border border-saathi-sand bg-saathi-cream/50 px-4 py-4 text-center transition hover:border-saathi-mint/80 hover:bg-white"
                >
                  <span className="block text-lg font-medium text-saathi-ink">
                    {lang.script}
                  </span>
                  <span className="mt-1 block text-xs text-saathi-ink/50">
                    {lang.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold text-saathi-ink sm:text-3xl">
              {t("home.stepsTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-saathi-ink/70">
              {t("home.stepsSubtitle")}
            </p>

            <ol className="relative mt-14 space-y-10 before:absolute before:left-[1.15rem] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-saathi-sand sm:before:left-6">
              {STEP_ICONS.map((icon, i) => {
                const n = i + 1;
                return (
                  <li
                    key={icon}
                    className="relative grid gap-4 pl-14 sm:grid-cols-[auto_1fr] sm:gap-8 sm:pl-20"
                  >
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-2xl border border-saathi-sand bg-white shadow-sm sm:left-1 sm:h-12 sm:w-12">
                      <StepIcon name={icon} />
                    </div>
                    <div className="pt-0.5 sm:pt-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-saathi-forest/80">
                        {t("home.step", { num: n })}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-semibold text-saathi-ink">
                        {t(`home.step${n}Title`)}
                      </h3>
                      <p className="mt-2 max-w-prose leading-relaxed text-saathi-ink/75">
                        {t(`home.step${n}Body`)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="border-t border-saathi-sand bg-saathi-ink px-4 py-16 text-saathi-cream sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              {t("home.sayNatural")}
            </h2>
            <p className="mt-2 max-w-2xl text-saathi-cream/70">
              {t("home.sayNaturalDesc")}
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {(
                ["example1", "example2", "example3", "example4"] as const
              ).map((key) => (
                <li
                  key={key}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg leading-snug text-saathi-mint/95 backdrop-blur"
                >
                  {t(`home.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-saathi-sand bg-gradient-to-br from-white to-saathi-cream p-8 shadow-sm sm:p-10">
            <h2 className="font-display text-2xl font-semibold text-saathi-ink">
              {t("home.vaultTitle")}
            </h2>
            <p className="mt-2 max-w-xl text-saathi-ink/75">
              {t("home.vaultDesc")}
            </p>
          </div>
        </section>

        <footer className="border-t border-saathi-sand px-4 py-10 text-center text-sm text-saathi-ink/55 sm:px-6">
          <p>{t("home.footer")}</p>
        </footer>
      </main>
    </>
  );
}
