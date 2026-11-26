/* Xuất mọi khối ```mermaid trong docs/ thành PNG theo theme Aegis.
   node render.mjs <docsDir> <outDir> [lọc-tên-file]
   - Flowchart dùng bố cục ELK (đường nối gọn hơn dagre); lỗi thì tự quay về dagre.
   - Nút được tô màu tự động theo ý nghĩa (theme.mjs › decorate). */
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mermaidConfig, decorate, FONT } from "./theme.mjs";

const [, , docsDir, outDir, only] = process.argv;
mkdirSync(outDir, { recursive: true });
const here = fileURLToPath(new URL(".", import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : []; });

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONT}:wght@400;500;600&display=swap&subset=vietnamese">
<style>body{margin:0;background:#fff}#c{display:inline-block;padding:24px;background:#fff}</style></head>
<body><div id="c"></div><span style="font-family:${FONT};font-weight:600;position:absolute;left:-999px">Ấ ấ ữ</span>
<script type="module">
import mermaid from "/node_modules/mermaid/dist/mermaid.esm.min.mjs";
import elk from "/node_modules/@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs";
mermaid.registerLayoutLoaders(elk);
window.mermaid = mermaid; window.ready = true;
</script></body></html>`;

const TYPES = { ".mjs": "text/javascript", ".js": "text/javascript", ".map": "application/json" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(PAGE); }
  const p = resolve(here, "." + url);
  if (!p.startsWith(here)) { res.writeHead(403); return res.end(); }
  try { const body = readFileSync(p); res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 3200, height: 1200, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0" });
await page.waitForFunction("window.ready === true");
// Nạp đủ 3 nét chữ (kể cả dải ký tự tiếng Việt) trước khi vẽ: chữ SVG của sequence dùng nét 400
await page.evaluate(async (f) => { for (const w of [400, 500, 600]) await document.fonts.load(`${w} 16px ${f}`, "Aa Ấấữ Đđ"); await document.fonts.ready; }, FONT);
if (process.env.NOELK) await page.evaluate(() => { window.NOELK = true; });

let n = 0, fallback = 0;
for (const f of walk(docsDir).sort()) {
  const slug = basename(f, ".md");
  if (only && !slug.includes(only)) continue;
  const blocks = [...readFileSync(f, "utf8").matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const [i, raw] of blocks.entries()) {
    const code = decorate(raw);
    const isFlow = /^\s*(flowchart|graph)\b/.test(code);
    const used = await page.evaluate(async (code, id, cfg, isFlow) => {
      const draw = async (layout) => {
        window.mermaid.initialize({ ...cfg, layout });
        const { svg } = await window.mermaid.render(id + layout, code);
        const c = document.getElementById("c"); c.innerHTML = svg;
        const s = c.querySelector("svg"); const w = parseFloat(s.style.maxWidth) || s.getBBox().width;
        s.style.maxWidth = "none"; s.style.width = w + "px";
      };
      if (isFlow && !window.NOELK) { try { await draw("elk"); return "elk"; } catch (e) { console.warn(e); } }
      await draw("dagre"); return "dagre";
    }, code, `d${n}`, mermaidConfig, isFlow);
    if (isFlow && used !== "elk") fallback++;
    await page.evaluate(() => document.fonts.ready);
    const el = await page.$("#c");
    await el.screenshot({ path: join(outDir, `${slug}-${i + 1}.png`) });
    n++;
  }
}
await browser.close();
server.close();
console.log(`rendered ${n}${fallback ? `, ${fallback} flowchart dùng dagre` : ""}`);
