import { JSDOM } from "jsdom";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const dom = new JSDOM("<!doctype html><body></body>");
globalThis.window = dom.window; globalThis.document = dom.window.document; for (const k of ["Element","HTMLElement","SVGElement","Node","navigator"]) { try { globalThis[k] = dom.window[k]; } catch {} }
globalThis.DOMPurify = (await import("dompurify")).default(dom.window);
const mermaid = (await import("mermaid")).default;
mermaid.initialize({ startOnLoad: false });
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : []; });
let bad = 0, total = 0;
for (const f of walk(process.argv[2])) {
  const blocks = [...readFileSync(f, "utf8").matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const [i, b] of blocks.entries()) {
    total++;
    try { await mermaid.parse(b); } catch (e) { bad++; console.log("FAIL", f.split("/docs/")[1], "#" + (i + 1), String(e.message || e).split("\n").slice(0, 3).join(" | ")); }
  }
}
console.log(`checked ${total}, failed ${bad}`);
