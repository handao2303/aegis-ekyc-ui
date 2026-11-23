/* Chụp ảnh màn hình cho tài liệu giao diện (docs/01-ekyc/1.3-ui).
   Cần web chạy ở http://localhost:5179 (npm run dev). Chạy ở chế độ demo (?api=off) để ảnh ổn định.
   node screens.mjs ../../public/ui */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "../../public/ui";
const BASE = process.env.WEB ?? "http://localhost:5179";
mkdirSync(OUT, { recursive: true });

const CUSTOMER = [
  "intro", "consent", "reconsent", "docType", "captureFront", "reviewFront", "captureBack", "ocrReview", "nfc",
  "liveness", "verifying", "approved", "refer", "rejected", "unreadable", "resume", "requestInfo", "duplicate", "expiredDoc", "privacy",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();

// App khách: khung iPhone 390×844
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/app/?api=off&lang=vi`, { waitUntil: "networkidle0" });
for (const key of CUSTOMER) {
  await page.goto(`${BASE}/app/?screen=${key}&lang=vi`, { waitUntil: "networkidle0" });
  await sleep(["captureFront", "captureBack", "liveness"].includes(key) ? 1800 : 700);
  await page.screenshot({ path: join(OUT, `app-${key}.png`) });
}
// Màn chọn hộ chiếu và modal điều khoản
await page.goto(`${BASE}/app/?screen=docType&lang=vi`, { waitUntil: "networkidle0" });
await page.evaluate(() => [...document.querySelectorAll("[role=radio]")].find((b) => b.textContent.includes("Hộ chiếu"))?.click());
await sleep(300);
await page.screenshot({ path: join(OUT, "app-docType-passport.png") });
await page.goto(`${BASE}/app/?screen=consent&lang=vi`, { waitUntil: "networkidle0" });
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Điều khoản và điều kiện"))?.click());
await sleep(500);
await page.screenshot({ path: join(OUT, "app-terms.png") });

// Compliance: màn hình 1280×860
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1.5 });
const nav = async (label) => {
  await page.evaluate((l) => [...document.querySelectorAll("nav button")].find((b) => b.textContent.includes(l))?.click(), label);
  await sleep(700);
};
await page.goto(`${BASE}/compliance/?lang=vi`, { waitUntil: "networkidle0" });
await sleep(700);
await page.screenshot({ path: join(OUT, "co-queue.png") });
await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("EKS-2611-0047"))?.click());
await sleep(700);
await page.screenshot({ path: join(OUT, "co-detail.png") });
await page.screenshot({ path: join(OUT, "co-detail-full.png"), fullPage: true });
for (const [label, file] of [["Yêu cầu bổ sung", "co-modal-request"], ["Từ chối", "co-modal-reject"]]) {
  await page.evaluate((l) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === l && !b.disabled)?.click(), label);
  await sleep(500);
  await page.screenshot({ path: join(OUT, `${file}.png`) });
  await page.keyboard.press("Escape");
  await sleep(300);
}
await nav("Chờ Checker"); await page.screenshot({ path: join(OUT, "co-checker.png") });
await nav("Đã xử lý"); await page.screenshot({ path: join(OUT, "co-done.png") });
await nav("Báo cáo SLA"); await page.screenshot({ path: join(OUT, "co-sla.png") });
await nav("Cấu hình ngưỡng"); await page.screenshot({ path: join(OUT, "co-config.png") });

await browser.close();
console.log("done");
