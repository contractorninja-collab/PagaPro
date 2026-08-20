import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  /** Scan all source trees so Tailwind JIT never misses utilities. */
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          ring: "hsl(var(--sidebar-ring))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          navy: "#0B1220",
          /** DEFAULT keeps every existing `bg-brand-blue` compiling unchanged. */
          blue: { DEFAULT: "#2563EB", strong: "#1D4ED8" },
          canvas: "#F4F7FB",
          text: "#111827",
          muted: "#6B7280",
        },
        /** Text ink scale — the slate ramp the whole product is drawn in. */
        ink: {
          900: "#0F172A",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
          400: "#94A3B8",
          300: "#CBD5E1",
        },
        /** Borders. `soft` is the hairline used inside cards and table heads. */
        line: { DEFAULT: "#E2E8F0", soft: "#EEF2F7" },
        /** Neutral surfaces. `hover` doubles as the row/button hover wash. */
        fill: { DEFAULT: "#F1F5F9", faint: "#F8FAFC", hover: "#EEF2F7" },
        /** The one semantic palette (TonePill's) — chips, banners, dots. */
        tone: {
          info: { bg: "#EFF6FF", fg: "#2563EB" },
          success: { bg: "#ECFDF5", fg: "#15803D", dot: "#16A34A" },
          warning: { bg: "#FFFBEB", fg: "#B45309", dot: "#D97706" },
          danger: { bg: "#FEF2F2", fg: "#DC2626", border: "#FEE2E2" },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        /** The one button radius — midpoint of the 8/9/10px drift. */
        btn: "9px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "sans-serif"],
        /** Wordmark only — the logo does not follow the UI face. */
        brand: ["var(--font-brand)", "system-ui", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        /** Flat operational surfaces — no glow */
        sm: "0 1px 2px 0 rgb(15 23 42 / 0.06)",
        /** THE card shadow — matches the dominant hand-written recipe. */
        card: "0 1px 3px rgba(15, 23, 42, 0.05)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
