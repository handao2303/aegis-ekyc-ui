import { marked } from "marked";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, dirname, relative, posix } from "node:path";
const [, , docsDir, outDir] = process.argv;
mkdirSync(outDir, { recursive: true });
const WIKI = "https://baohandao2303.atlassian.net/wiki/spaces/SCRUM/pages/";
const GH = "https://github.com/handao2303/aegis-ekyc-ui/blob/main/";
const IMG = "https://handao2303.github.io/aegis-ekyc-ui/diagrams/";
const IDS = { ...JSON.parse(readFileSync(new URL("./confluence-ids.json", import.meta.url), "utf8")), "README": "16351233", "C01-jira-hygiene-log": "16285721", "C02-compliance-mapping": "16318489", "C03-requirements-addendum-v1.3": "16253028", "C04-C05-identity-validation": "16318511", "C06-session-lifecycle": "16253050", "C07-C09-refer-handling": "16351348", "C10-maker-checker-audit": "16318533", "C11-biometric-source": "16253072", "C12-consent-retention": "16253094", "C13-C14-fraud-controls": "16253116", "C15-performance-test-plan": "16318555", "C16-sit-plan": "16285743", "C17-uat-pack": "16253138", "C18-kpi-metric-dictionary": "16285765", "A01-solution-overview": "16351370", "A02-ios-document-scan": "16351393", "R01-reconciliation-flow": "16285787", "L01-credit-limit-flow": "16253160" };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : []; });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
for (const f of walk(docsDir)) {
  const slug = basename(f, ".md");
  const relDoc = posix.join("docs", relative(docsDir, f).split("\\").join("/"));
  let md = readFileSync(f, "utf8");
  const title = (md.match(/^# (.+)$/m) || [, slug])[1];
  md = md.replace(/^# .+\n+/, "");
  let n = 0;
  md = md.replace(/```mermaid\n[\s\S]*?```/g, () => { n++; return `\n<figure><img src="${IMG}${slug}-${n}.png" alt="Sơ đồ ${n} – ${esc(title)}"></figure>\n`; });
  // ảnh chụp màn hình trong public/ → bản trên GitHub Pages
  md = md.replace(/src="(?:\.\.\/)+public\//g, 'src="https://handao2303.github.io/aegis-ekyc-ui/');
  // link: tài liệu khác → trang Confluence; file khác → GitHub
  md = md.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (m, href) => {
    const [path] = href.split("#");
    const abs = posix.normalize(posix.join(posix.dirname(relDoc), path));
    const s = basename(path, ".md");
    if (path.endsWith(".md") && IDS[s] && abs.startsWith("docs/")) return `](${WIKI}${IDS[s]})`;
    return `](${GH}${abs})`;
  });
  let html = marked.parse(md, { gfm: true });
  // Confluence: bảng không được nằm trong blockquote → bỏ khung trích dẫn
  html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (m, inner) => (inner.includes("<table") ? inner : m));
  // khối cảnh báo ⚠️ → panel cảnh báo của Confluence
  html = html.replace(/<blockquote>\s*<p>⚠️\s*([\s\S]*?)<\/blockquote>/g, (m, inner) => `<div data-type="panel-warning"><p>${inner}</div>`);
  // bỏ thẻ input checkbox của GFM (nếu có), gọn khoảng trắng giữa thẻ
  // Chỉ bỏ khoảng trắng quanh thẻ khối; giữ dấu cách giữa các thẻ inline (</strong> <code>)
  const BLOCK = "p|li|ul|ol|table|thead|tbody|tr|td|th|h[1-6]|div|figure|pre|blockquote|hr";
  html = html.replace(new RegExp(`\\s+(<\\/?(?:${BLOCK})(?=[\\s>/]))`, "g"), "$1");
  html = html.replace(new RegExp(`(<\\/?(?:${BLOCK})(?:\\s[^>]*)?>)\\s+`, "g"), "$1");
  html = html.trim();
  // ảnh chụp màn hình đứng riêng → <figure> để Confluence nhận đúng
  html = html.replace(/<p>((?:<img[^>]*>)+)<\/p>/g, (m, imgs) => imgs);
  html = html.replace(/(<figure>)?(<img[^>]*>)/g, (m, fig, img) => (fig ? m : `<figure>${img}</figure>`));
  // bảng thông tin đầu trang (| | |) có hàng tiêu đề trống → bỏ
  html = html.replace(/<thead><tr>(?:<th><\/th>)+<\/tr><\/thead>/g, "");
  const src = `${GH}${relDoc}`;
  const head = slug === "README"
    ? `<div data-type="panel-info"><p>Bản gốc (Markdown + Mermaid) trên GitHub: <a href="${src}">${relDoc}</a>. Diagram là ảnh xuất từ Mermaid; sửa diagram ở bản gốc rồi xuất lại.</p></div>`
    : `<div data-type="panel-info"><p>Bản gốc: <a href="${src}">${relDoc}</a> trên GitHub. ${n ? `Diagram là ảnh xuất từ Mermaid (${n} sơ đồ).` : ""}</p></div>`;
  writeFileSync(join(outDir, `${slug}.html`), head + html);
  console.log(slug, IDS[slug], n, (head + html).length);
}
