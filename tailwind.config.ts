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
        primary: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#2e1065",
          950: "#1a0a3d",
        },
        surface: "#f4f2ff",
        sidebar: {
          bg:     "#12082e",
          hover:  "rgba(255,255,255,0.08)",
          active: "rgba(124,58,237,0.35)",
          border: "rgba(255,255,255,0.06)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "card":  "0 1px 4px 0 rgba(124,58,237,0.06), 0 4px 16px 0 rgba(0,0,0,0.06)",
        "card-hover": "0 4px 20px 0 rgba(124,58,237,0.12), 0 1px 4px 0 rgba(0,0,0,0.06)",
        "btn":   "0 4px 14px 0 rgba(124,58,237,0.35)",
        "nav":   "0 -4px 24px 0 rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
