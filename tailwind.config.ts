import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bharatlink: {
          navy: "#0f172a",
          tealDark: "#ea580c",
          teal: "#f97316",
          tealLight: "#ffedd5",
          coral: "#ea580c",
          coralLight: "#ffedd5",
          coralDark: "#c2410c",
          terracotta: "#ea580c",
          cream: "#fdfbf7",
          sand: "#f1f5f9",
          slateDark: "#0f172a",
          slateCard: "rgba(30, 41, 59, 0.7)",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-dm-sans)", "sans-serif"],
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 110% 70% at 55% -10%, rgba(234,88,12,0.15), transparent 55%), radial-gradient(ellipse 70% 55% at 100% 0%, rgba(249,115,22,0.10), transparent 55%)",
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        pulsebar: "pulsebar 1.2s ease-in-out infinite",
        wave: "waveBar 1.0s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulsebar: {
          "0%, 100%": { opacity: "0.35", transform: "scaleY(0.5)" },
          "50%": { opacity: "1", transform: "scaleY(1)" },
        },
        waveBar: {
          "0%, 100%": { transform: "scaleY(0.4)", opacity: "0.45" },
          "50%": { transform: "scaleY(1.0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
