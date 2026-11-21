import type { MetadataRoute } from "next";

const base = process.env.BASE_PATH || "";

export const dynamic = "force-static";

/** PWA cho app khách hàng: "Thêm vào MH chính" trên iPhone sẽ mở toàn màn hình như app thật */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/app/`,
    name: "Aegis – Mở tài khoản",
    short_name: "Aegis",
    description: "Mở tài khoản Aegis Bank trực tuyến bằng CCCD gắn chip.",
    start_url: `${base}/app/`,
    scope: `${base}/app/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#08180e",
    theme_color: "#0e2a19",
    lang: "vi",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
