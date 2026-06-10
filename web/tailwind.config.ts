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
        // light theme: ink = นิวทรัลอุ่น (เข้ม=ข้อความ, อ่อน=พื้น/การ์ด)
        // 950/900/850 = ข้อความ, 800 = muted, 700 = เส้นขอบ, 600 = พื้นการ์ดอ่อน
        ink: {
          950: "#1c1410",
          900: "#2a2018",
          850: "#3d3228",
          800: "#6b5d4f",
          700: "#e7ddd2",
          600: "#f0e8de",
        },
        brand: {
          // ส้มโลโก้ #f47527 เป็นแกน
          50: "#fff4ec",
          100: "#ffe6d5",
          200: "#fdc9a8",
          300: "#fba772",
          400: "#f88c46",
          500: "#f47527", // ส้มหลัก (= โลโก้)
          600: "#e25e16",
          700: "#bb4712",
          800: "#943917",
          900: "#783116",
        },
        accent: {
          // อำพัน/เหลืองทอง — warm คู่กับส้ม
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #f47527 0%, #f59e0b 100%)",
        "gradient-ink": "linear-gradient(160deg, #fffaf4 0%, #fff4ec 55%, #ffe9d8 100%)",
        "gradient-card":
          "linear-gradient(160deg, rgba(244,117,39,0.06) 0%, rgba(245,158,11,0.03) 100%)",
        "gradient-text": "linear-gradient(135deg, #f47527 0%, #d97706 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(244,117,39,0.18), 0 8px 30px -10px rgba(244,117,39,0.30)",
        soft: "0 8px 30px -14px rgba(120,49,22,0.18)",
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
