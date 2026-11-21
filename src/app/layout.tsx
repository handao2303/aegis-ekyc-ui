import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro, Lexend } from "next/font/google";
import "../styles/tokens.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

// Font hiển thị cho app khách hàng (skin Aurora): hình học như Outfit nhưng có dấu tiếng Việt
const display = Lexend({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: { default: "Aegis eKYC UI Kit", template: "%s · Aegis" },
  description: "eKYC module UI for Aegis Bank: customer onboarding app, Compliance back-office and design system.",
  icons: { icon: [{ url: `${process.env.BASE_PATH || ""}/icon.svg`, type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2559",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${font.variable} ${display.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
