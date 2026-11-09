import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

// - npm run dev / build : 3 trang — UI Kit (/), App khách hàng (/app/), Web Compliance (/compliance/)
// - npm run artifact    : chỉ build UI Kit thành 1 file để chia sẻ
export default defineConfig(({ mode }) =>
  mode === "artifact"
    ? { plugins: [react(), viteSingleFile()] }
    : {
        plugins: [react()],
        build: {
          rollupOptions: {
            input: {
              kit: resolve(__dirname, "index.html"),
              app: resolve(__dirname, "app/index.html"),
              compliance: resolve(__dirname, "compliance/index.html"),
            },
          },
        },
      },
);
