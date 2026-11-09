// Chuyển bản build một-file của Vite thành nội dung trang Artifact (bỏ doctype/html/head/body vì Artifact tự bọc khung)
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const head = src.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keepHead = head
  .replace(/<meta charset[^>]*>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "")
  .trim();
// Script dạng module phải đặt sau #root
const scripts = [...keepHead.matchAll(/<script[\s\S]*?<\/script>/gi)].map((m) => m[0]);
const headNoScripts = keepHead.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
const out = `${headNoScripts}\n<meta name="claude:viewport-fit-sides" content="cover">\n${body.trim()}\n${scripts.join("\n")}\n`;
writeFileSync(new URL("../dist/aegis-ekyc-ui.html", import.meta.url), out);
console.log("artifact bytes:", out.length);
