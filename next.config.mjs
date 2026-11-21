/** Static export để host trên GitHub Pages.
 *  BASE_PATH = "/aegis-ekyc-ui" khi build trên GitHub Actions; để trống khi chạy local. */
const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
