/* Module 1 · eKYC – vòng 2 (T03 §3.7): chạy các ca còn "chưa chạy / một phần" làm được trên máy tính.
   Cần web (npm run dev, cổng 5179) và ekyc-service (cổng 8787) chạy local; script tự đặt lại dữ liệu.
   node m1-round2.mjs [thư mục ảnh] > m1-round2.json */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "/tmp/m1-round2";
const WEB = process.env.WEB ?? "http://localhost:5179";
const API = process.env.API ?? "http://localhost:8787";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, title, pass, actual) => results.push({ id, title, result: pass === null ? "PARTIAL" : pass ? "PASS" : "FAIL", actual });

await fetch(`${API}/api/dev/reset`, { method: "POST" });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
let page = await browser.newPage();
const mobile = () => page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desktop = (w = 1280) => page.setViewport({ width: w, height: 860 });
const text = () => page.evaluate(() => document.body.innerText);
const lab = `(b) => (b.getAttribute("aria-label") || b.innerText || "").trim()`;
/** Bấm nút có nhãn khớp (chuỗi = khớp đúng, RegExp = khớp mẫu); trả về nhãn đã bấm hoặc null */
const click = async (label) => {
  const r = await page.evaluate((src, flags, exact, lab) => {
    const f = eval(lab); const re = src === null ? null : new RegExp(src, flags);
    const b = [...document.querySelectorAll("button, a, [role=radio], [role=tab]")].filter((e) => e.offsetParent && !e.disabled).find((e) => (re ? re.test(f(e)) : f(e) === exact));
    if (!b) return null; b.click(); return f(b);
  }, label instanceof RegExp ? label.source : null, label instanceof RegExp ? label.flags : "", label instanceof RegExp ? null : label, lab);
  await sleep(700);
  return r;
};
const waitText = async (re, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await text())) return true; await sleep(400); } return false; };
const freshApp = async (td = "TD-01", extra = "") => {
  await page.goto(`${WEB}/app/?lang=vi`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${WEB}/app/?lang=vi&td=${td}${extra}`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
};
/** Đi từ màn giới thiệu tới màn mặt sau / OCR, dùng ảnh minh hoạ khi không có camera */
const toCaptureFront = async () => {
  await click("Bắt đầu");
  await page.evaluate(() => [...document.querySelectorAll("input[type=checkbox]")].slice(0, 2).forEach((c) => c.checked || c.click())); await sleep(300);
  await click("Đồng ý và tiếp tục"); await waitText(/Chọn giấy tờ/);
  await click(/CCCD gắn chip/); await click("Tiếp tục"); await waitText(/Đặt mặt trước/);
};

// ---------- TC-APP-36 Thiết bị mới, không có hồ sơ dở ----------
await mobile();
await freshApp();
await click(/Tiếp tục hồ sơ đang dở/);
let ok36 = await waitText(/Không có hồ sơ đang làm dở trên máy này/, 6000);
await page.screenshot({ path: join(OUT, "app-36-no-resume.png") });
check("TC-APP-36", "Thiết bị mới bấm \"Tiếp tục hồ sơ đang dở\" (C06)", ok36, ok36 ? "Hiện \"Không có hồ sơ đang làm dở trên máy này.\"" : "Không thấy thông báo");

// ---------- TC-APP-11 Chụp lại → về camera; Dùng ảnh → mặt sau ----------
await freshApp();
await toCaptureFront();
await click("Chụp ảnh"); const atReview = await waitText(/Kiểm tra ảnh/, 6000);
await click("Chụp lại"); const backToCam = await waitText(/Đặt mặt trước/, 6000);
await click("Chụp ảnh"); await waitText(/Kiểm tra ảnh/, 6000);
await click("Dùng ảnh này"); const atBack = await waitText(/Mặt sau CCCD/, 8000);
check("TC-APP-11", "Kiểm tra ảnh: Chụp lại về camera, Dùng ảnh này sang mặt sau (G-04)", atReview && backToCam && atBack, `Kiểm tra ảnh: ${atReview} · Chụp lại → camera mặt trước: ${backToCam} · Dùng ảnh → mặt sau: ${atBack}`);

// ---------- TC-APP-35 Làm lại từ đầu: phiên CANCELLED, dữ liệu tạm xoá ----------
await click("Chụp ảnh"); await sleep(1500);
await click(/^Xác nhận/); await waitText(/Quét chip/, 8000);
const sid = await page.evaluate(() => JSON.parse(localStorage.getItem("aegis.session") || "null")?.id ?? null);
const dev = await page.evaluate(() => localStorage.getItem("aegis.install"));
await page.goto(`${WEB}/app/?lang=vi`, { waitUntil: "domcontentloaded" }); await sleep(1500);
await click(/Tiếp tục hồ sơ đang dở/); const atResume = await waitText(/Tiếp tục hồ sơ đang làm dở\?/, 6000);
await page.screenshot({ path: join(OUT, "app-35-resume.png") });
await click("Làm lại từ đầu"); await sleep(1200);
const { DatabaseSync } = await import("node:sqlite");
const { fileURLToPath } = await import("node:url");
const db = new DatabaseSync(fileURLToPath(new URL("../../server/data/aegis.db", import.meta.url)), { readOnly: true });
const row = sid ? db.prepare("SELECT status, ocr_json, chip_json FROM sessions WHERE id = ?").get(sid) : null;
db.close();
const wiped = row && row.status === "CANCELLED" && (!row.ocr_json || row.ocr_json === "null") && (!row.chip_json || row.chip_json === "null");
await click(/Tiếp tục hồ sơ đang dở/); const noMore = await waitText(/Không có hồ sơ đang làm dở/, 6000);
check("TC-APP-35", "Làm lại từ đầu: phiên CANCELLED, xoá dữ liệu tạm, không còn để tiếp tục (C06)", atResume && wiped && noMore, `Màn tiếp tục: ${atResume} · phiên ${sid ?? "?"} → ${row?.status ?? "?"}, OCR ${row?.ocr_json ? "còn" : "đã xoá"}, chip ${row?.chip_json ? "còn" : "đã xoá"} · bấm tiếp tục lần nữa: "Không có hồ sơ đang làm dở" = ${noMore}`);

// ---------- Hồ sơ TD-06 (CIC chậm) cho TC-CO-24 nhánh lỗi ----------
await freshApp("TD-06");
await toCaptureFront();
for (const l of ["Chụp ảnh", "Dùng ảnh này", "Chụp ảnh", /^Xác nhận/, "Bắt đầu quét", "Tiếp tục", "Tôi đã sẵn sàng"]) { await click(l); await sleep(1200); }
{ const t0 = Date.now(); while (Date.now() - t0 < 30000 && /Xác thực khuôn mặt|Đang xác minh/.test(await text())) await sleep(500); }
const td06End = (await text()).split("\n").filter(Boolean).slice(0, 6).join(" | ");

// ---------- Compliance ----------
await desktop();
const openCompliance = async (extra = "") => { await page.goto(`${WEB}/compliance/?lang=vi${extra}`, { waitUntil: "domcontentloaded" }); await sleep(1800); };
await openCompliance();
// TC-CO-03 tab lọc
const tabCheck = async (label, test) => {
  const tab = await page.evaluate((label) => { const b = [...document.querySelectorAll("button,[role=tab]")].find((e) => e.innerText.trim().startsWith(label) && e.closest("[role=tablist], .flex")); if (!b) return null; const n = Number((b.innerText.match(/(\d+)\s*$/) || [, "NaN"])[1]); b.click(); return n; }, label);
  await sleep(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].map((r) => r.innerText.replace(/\s+/g, " ")));
  const bad = rows.filter((r) => !test(r));
  return { label, count: tab, rows: rows.length, bad: bad.length };
};
const tabs = [
  await tabCheck("Của tôi", (r) => r.includes("Nguyễn Minh Anh")),
  await tabCheck("Đã bổ sung", (r) => r.includes("Đã bổ sung")),
  await tabCheck("Chờ Checker", (r) => r.includes("Chờ Checker")),
];
await page.screenshot({ path: join(OUT, "co-03-tabs.png") });
check("TC-CO-03", "Tab lọc Của tôi / Đã bổ sung / Chờ Checker: đúng hồ sơ, số trên tab khớp (SCRUM-78)", tabs.every((x) => x.count === x.rows && x.bad === 0 && x.rows > 0), tabs.map((x) => `${x.label}: tab ${x.count} · ${x.rows} dòng · ${x.bad} dòng sai`).join(" | "));
await tabCheck("Tất cả", () => true);

// TC-CO-24 tra cứu lại CIC: thành công (EKS-2611-0031) và vẫn lỗi (TD-06)
const openCase = async (id) => { await page.evaluate((id) => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes(id))?.click(), id); await sleep(1200); };
await openCase("EKS-2611-0031");
const hadFlag = /CIC quá thời gian|CIC_TIMEOUT/.test(await text());
await click(/Nhận xử lý|^Nhận$/);
await click("Tra cứu lại CIC"); await sleep(1500);
const tOk = await text();
const okCic = hadFlag && !/CIC_TIMEOUT/.test(tOk.slice(tOk.indexOf("Lý do chuyển duyệt"), tOk.indexOf("Giấy tờ"))) && /Nhóm \d/.test(tOk);
await page.screenshot({ path: join(OUT, "co-24-cic-ok.png") });
let failMsg = `Không tạo được hồ sơ TD-06 (màn cuối: ${td06End})`;
{
  await openCompliance();
  const caseId = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].map((r) => r.innerText).find((t) => /CIC quá thời gian/.test(t) && !t.includes("EKS-2611-0031"))?.match(/EKS-\d{4}-\d{4}/)?.[0] ?? null);
  if (caseId) {
    await openCase(caseId); await click(/Nhận xử lý|^Nhận$/); await click("Tra cứu lại CIC"); await sleep(1500);
    const t = await text(); failMsg = (t.match(/CIC vẫn chưa phản hồi[^\n]*/) || ["(không thấy thông báo lỗi)"])[0] + ` · hồ sơ ${caseId}`;
    await page.screenshot({ path: join(OUT, "co-24-cic-fail.png") });
  }
}
check("TC-CO-24", "Tra cứu lại CIC: thành công bỏ cờ, cập nhật nhóm; CIC vẫn lỗi báo 503 (SCRUM-42)", okCic && /CIC vẫn chưa phản hồi/.test(failMsg), `EKS-2611-0031: cờ CIC_TIMEOUT bỏ, có nhóm CIC = ${okCic} · TD-06: ${failMsg}`);

// ---------- Phi chức năng ----------
const APP_SCREENS = ["intro", "consent", "docType", "reviewFront", "ocrReview", "nfc", "liveness", "approved", "refer", "privacy"];
const goScreen = async (s, lang = "vi") => { await page.goto(`${WEB}/app/?screen=${s}&lang=${lang}&api=off`, { waitUntil: "networkidle0" }); await sleep(600); };

// TC-NFR-06 vùng chạm ≥ 44 × 44
await mobile();
const small = [];
for (const s of APP_SCREENS) {
  await goScreen(s);
  const v = await page.evaluate(() => [...document.querySelectorAll("button, a, input[type=checkbox], [role=radio], [role=switch]")].filter((e) => e.offsetParent).map((e) => {
    const t = e.matches("input") ? (e.closest("label") ?? e) : e; const r = t.getBoundingClientRect();
    // Vùng chạm = khung phần tử hợp với phần mở rộng [data-hit] bên trong (nếu có)
    const hit = [...t.querySelectorAll("[data-hit]")].map((h) => h.getBoundingClientRect());
    const box = hit.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }), { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    return { w: Math.round(box.right - box.left), h: Math.round(box.bottom - box.top), l: (e.getAttribute("aria-label") || e.innerText || e.tagName).trim().slice(0, 30) };
  }).filter((x) => x.w > 0 && (x.w < 44 || x.h < 44)));
  v.forEach((x) => small.push(`${s}: "${x.l}" ${x.w}×${x.h}`));
}
check("TC-NFR-06", "Vùng chạm ≥ 44 × 44 pt trên 10 màn app (WCAG 2.5.8, Apple HIG)", small.length === 0 ? true : false, small.length ? `${small.length} phần tử nhỏ hơn: ${small.slice(0, 8).join("; ")}${small.length > 8 ? "; …" : ""}` : "Mọi nút, ô chọn ≥ 44 × 44");

// TC-NFR-07 (một phần) – vùng thông báo động cho trình đọc màn hình
const live = {};
for (const s of ["nfc", "liveness", "verifying"]) { await goScreen(s); live[s] = await page.evaluate(() => document.querySelectorAll("[aria-live]:not([aria-live=off]), [role=status], [role=alert]").length); }
check("TC-NFR-07", "Trình đọc màn hình: tiến độ NFC, liveness, đang xác minh có vùng aria-live (chưa thử VoiceOver thật)", Object.values(live).every((n) => n > 0) ? null : false, Object.entries(live).map(([k, n]) => `${k}: ${n} vùng`).join(" · ") + " · VoiceOver trên iPhone chưa chạy");

// TC-NFR-08 tương phản ≥ 4.5:1 (chữ thường) / 3:1 (chữ lớn), đo theo công thức WCAG 2.2
const contrastScan = () => page.evaluate(() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== "none") return null; const c = parse(s.backgroundColor); if (c && c.a >= 0.95) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || !n.textContent.trim() || !el.offsetParent) continue; seen.add(el);
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) < 0.95) continue;
    const fg = parse(s.color), bg = bgOf(el); if (!fg || !bg || fg.a < 0.95) continue;
    const [L1, L2] = [lum(fg), lum(bg)].sort((a, b) => b - a); const ratio = (L1 + 0.05) / (L2 + 0.05);
    const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700; const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({ t: n.textContent.trim().slice(0, 28), ratio: Math.round(ratio * 100) / 100, need });
  }
  return out;
});
const lowC = [];
for (const s of APP_SCREENS) { await goScreen(s); (await contrastScan()).forEach((x) => lowC.push(`app/${s}: "${x.t}" ${x.ratio}:1 (cần ${x.need})`)); }
await desktop(); await openCompliance("&api=off");
(await contrastScan()).forEach((x) => lowC.push(`compliance: "${x.t}" ${x.ratio}:1 (cần ${x.need})`));
check("TC-NFR-08", "Tương phản chữ ≥ 4.5:1 (chữ lớn ≥ 3:1) – đo tự động 10 màn app + hàng đợi Compliance, bỏ qua chữ trên ảnh/gradient", lowC.length === 0, lowC.length ? `${lowC.length} đoạn chữ dưới ngưỡng: ${lowC.slice(0, 10).join("; ")}${lowC.length > 10 ? "; …" : ""}` : "Không có đoạn chữ nào dưới ngưỡng");

// TC-NFR-09 bàn phím ở Compliance: Tab tới nút, Enter mở hộp thoại, Esc đóng
await openCompliance("&api=off");
const focusSeq = [];
for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); focusSeq.push(await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { l: (e.getAttribute("aria-label") || e.innerText || e.tagName).trim().split("\n")[0].slice(0, 24), ring: s.outlineStyle !== "none" || s.boxShadow !== "none" }; })); }
await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("EKS-2611-0047"))?.click()); await sleep(900);
const rejectFocused = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Từ chối"); b?.focus(); return document.activeElement === b; });
await page.keyboard.press("Enter"); await sleep(500);
const dlgOpen = await page.evaluate(() => !!document.querySelector("[role=dialog]"));
await page.keyboard.press("Escape"); await sleep(400);
const dlgClosed = await page.evaluate(() => !document.querySelector("[role=dialog]"));
const ringCount = focusSeq.filter((x) => x.ring).length;
check("TC-NFR-09", "Compliance dùng được bằng bàn phím: Tab qua nút có viền focus, Enter mở hộp thoại, Esc đóng", ringCount === focusSeq.length && rejectFocused && dlgOpen && dlgClosed, `12 lần Tab: ${focusSeq.map((x) => x.l).join(" → ")} · có viền focus ${ringCount}/12 · Enter trên "Từ chối" mở hộp thoại: ${dlgOpen} · Esc đóng: ${dlgClosed}`);

// TC-NFR-10 song ngữ: ?lang=en đổi hết chữ, lựa chọn được nhớ
await mobile();
const VI = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const leftovers = [];
// Dữ liệu hồ sơ mẫu (tên, quê quán) giữ nguyên tiếng Việt ở cả hai ngôn ngữ – không tính là chữ giao diện
const { readFileSync } = await import("node:fs");
const DATA = readFileSync(new URL("../../server/src/personas.ts", import.meta.url), "utf8");
for (const s of APP_SCREENS) {
  await goScreen(s, "en");
  const lines = (await text()).split("\n").map((x) => x.trim()).filter((x) => VI.test(x) && !/^[A-ZÀ-Ỹ\s]+$/.test(x) && !/^(VI|EN)$/.test(x));
  lines.filter((x) => !DATA.includes(x)).forEach((x) => leftovers.push(`${s}: "${x.slice(0, 40)}"`));
}
await page.goto(`${WEB}/app/?screen=intro&api=off`, { waitUntil: "networkidle0" }); await sleep(500);
const remembered = !VI.test((await text()).split("\n").slice(0, 8).join(" "));
check("TC-NFR-10", "Song ngữ: ?lang=en đổi chữ trên 10 màn app, lần mở sau không có ?lang vẫn giữ EN", leftovers.length === 0 && remembered, `${leftovers.length} dòng còn tiếng Việt${leftovers.length ? ": " + leftovers.slice(0, 8).join("; ") : ""} · nhớ lựa chọn: ${remembered}`);
await page.goto(`${WEB}/app/?lang=vi&api=off`, { waitUntil: "networkidle0" });

// TC-NFR-13 (một phần) – Chrome
check("TC-NFR-13", "Compliance trên Chrome, Edge, Safari", null, "Chrome (headless, bản cài trên máy) chạy toàn bộ ca Compliance ở trên; Edge, Safari chưa có trên máy chạy test");

// TC-NFR-14 Compliance rộng 900 px
await desktop(900); await openCompliance("&api=off");
const narrow = await page.evaluate(() => {
  const aside = [...document.querySelectorAll("aside")].some((a) => a.offsetParent && a.getBoundingClientRect().width > 0 && a.getBoundingClientRect().height > 300);
  const nav = [...document.querySelectorAll("nav, [role=tablist]")].find((n) => n.offsetParent && /Hàng đợi/.test(n.innerText));
  const r = nav?.getBoundingClientRect();
  const tbl = document.querySelector("table"); const box = tbl?.closest(".overflow-x-auto, [class*=overflow-x]");
  return { sidebar: aside, horizontal: r ? r.width > r.height : false, pageScroll: document.documentElement.scrollWidth > window.innerWidth + 1, tableScroll: box ? box.scrollWidth >= box.clientWidth : false };
});
await page.screenshot({ path: join(OUT, "co-14-900px.png") });
check("TC-NFR-14", "Compliance rộng 900 px: menu thành thanh ngang, trang không cuộn ngang, bảng cuộn trong khung", !narrow.sidebar && narrow.horizontal && !narrow.pageScroll && narrow.tableScroll, `Thanh bên dọc: ${narrow.sidebar} · menu ngang: ${narrow.horizontal} · trang cuộn ngang: ${narrow.pageScroll} · bảng nằm trong khung cuộn: ${narrow.tableScroll}`);

await browser.close();
console.log(JSON.stringify(results, null, 1));
