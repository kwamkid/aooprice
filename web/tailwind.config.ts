import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plex-thai)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // โทนพื้นหลังดำ-ม่วง (ไล่จากเข้มสุด → อ่อน)
        ink: {
          950: "#0a0612",
          900: "#0f0a1e",
          850: "#150f2b",
          800: "#1b1338",
          700: "#241a4d",
          600: "#2f2363",
        },
        brand: {
          50: "#f4f0ff",
          100: "#e9e0ff",
          200: "#d4c2ff",
          300: "#b69bff",
          400: "#9168ff",
          500: "#7c3aed", // ม่วงหลัก
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#3b0d7a",
        },
        accent: {
          // ฟ้า-ม่วง futuristic (ไว้ทำ gradient คู่กับ brand)
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
        "gradient-ink": "linear-gradient(160deg, #0f0a1e 0%, #150f2b 55%, #1b1338 100%)",
        "gradient-card":
          "linear-gradient(160deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.04) 100%)",
        "gradient-text": "linear-gradient(135deg, #b69bff 0%, #22d3ee 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,58,237,0.25), 0 8px 30px -8px rgba(124,58,237,0.35)",
        soft: "0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
