import type { Metadata, Viewport } from "next";
import { CustomerApp } from "../ClientOnly";

const base = process.env.BASE_PATH || "";

export const metadata: Metadata = {
  title: "Mở tài khoản",
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${base}/icon.svg`, type: "image/svg+xml" }],
    apple: [{ url: `${base}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  // iPhone: mở từ màn hình chính sẽ chạy toàn màn hình, thanh trạng thái trong suốt trên nền xanh
  appleWebApp: { capable: true, title: "Aegis", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e2a19",
};

export default function Page() {
  return <CustomerApp />;
}
