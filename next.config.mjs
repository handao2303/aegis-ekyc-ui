import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** Static export để host trên GitHub Pages.
 *  BASE_PATH = "/aegis-ekyc-ui" khi build trên GitHub Actions; để trống khi chạy local. */
const basePath = process.env.BASE_PATH || "";
const API_TARGET = process.env.EKYC_API ?? "http://localhost:8787";

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    // Bản build là static export cho GitHub Pages; khi dev thì bỏ để dùng được rewrites
    ...(dev ? {} : { output: "export" }),
    // Build xuất thẳng vào out/ (thư mục riêng với .next của dev server) để deploy không làm hỏng dev server
    distDir: dev ? ".next" : "out",
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
    reactStrictMode: true,
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
    // Dev: /ekyc-api/* chuyển sang ekyc-service, để link HTTPS tạm (Cloudflare Tunnel) chỉ cần mở 1 cổng
    ...(dev ? { rewrites: async () => [{ source: "/ekyc-api/:path*", destination: `${API_TARGET}/:path*` }] } : {}),
  };
}
