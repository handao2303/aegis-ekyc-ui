/** Tailwind chỉ là lớp ánh xạ: mọi màu đều trỏ về token ngữ nghĩa trong src/styles/tokens.css */
const v = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: v("brand-bg"), fg: v("brand-text"), muted: v("brand-muted") },
        bg: {
          base: v("bg-base"),
          surface: v("bg-surface"),
          raised: v("bg-surface-raised"),
          sunken: v("bg-sunken"),
          inverse: v("bg-inverse"),
        },
        fg: {
          primary: v("text-primary"),
          secondary: v("text-secondary"),
          tertiary: v("text-tertiary"),
          inverse: v("text-inverse"),
        },
        line: { subtle: v("border-subtle"), strong: v("border-strong") },
        action: {
          DEFAULT: v("action-primary-bg"),
          fg: v("action-primary-text"),
          subtle: v("action-primary-subtle-bg"),
          "subtle-fg": v("action-primary-subtle-text"),
        },
        success: { DEFAULT: v("status-success-text"), subtle: v("status-success-subtle-bg") },
        warning: { DEFAULT: v("status-warning-text"), subtle: v("status-warning-subtle-bg") },
        danger: {
          DEFAULT: v("status-danger-text"),
          subtle: v("status-danger-subtle-bg"),
          solid: v("status-danger-solid-bg"),
          "solid-fg": v("status-danger-solid-text"),
        },
        info: { DEFAULT: v("status-info-text"), subtle: v("status-info-subtle-bg") },
      },
      fontFamily: {
        // Một họ chữ duy nhất; "mono" chỉ bật số thẳng cột, không đổi font
        sans: ['"Be Vietnam Pro"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"Be Vietnam Pro"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        // Thang chữ 1.25 — tên theo vai trò
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        "body-sm": ["14px", { lineHeight: "20px" }],
        body: ["16px", { lineHeight: "24px" }],
        "title-sm": ["18px", { lineHeight: "26px", fontWeight: "600" }],
        title: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        headline: ["24px", { lineHeight: "32px", fontWeight: "700" }],
        display: ["32px", { lineHeight: "40px", fontWeight: "700", letterSpacing: "-0.01em" }],
      },
      borderRadius: { sm: "6px", md: "8px", lg: "12px", xl: "16px", "2xl": "24px" },
      boxShadow: { raised: v("shadow-raised"), overlay: v("shadow-overlay") },
      ringColor: { focus: v("focus-ring") },
    },
  },
  plugins: [],
};
