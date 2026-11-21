import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro } from "next/font/google";
import "../styles/tokens.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
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
    <html lang="vi" className={font.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
