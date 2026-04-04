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
        saathi: {
          ink: "#0c1f1a",
          forest: "#14532d",
          leaf: "#22c55e",
          mint: "#a7f3d0",
          cream: "#f7f5f0",
          sand: "#e8e4dc",
          sky: "#0ea5e9",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-dm-sans)", "sans-serif"],
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(34,197,94,0.25), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 0%, rgba(14,165,233,0.12), transparent 50%)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulsebar: "pulsebar 1.2s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulsebar: {
          "0%, 100%": { opacity: "0.35", transform: "scaleY(0.6)" },
          "50%": { opacity: "1", transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
