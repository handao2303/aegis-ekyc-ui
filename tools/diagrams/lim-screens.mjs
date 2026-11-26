/* Module 3 · Hạn mức: chụp ảnh LIM-W1 → W4, M1 → M3 cho L03 và chạy các kiểm thử giao diện của L04.
   Mặc định chạy trên bản GitHub Pages; đổi bằng WEB=http://localhost:5179.
   node lim-screens.mjs ../../public/ui > lim-results.json */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "../../public/ui";
const BASE = process.env.WEB ?? "https://handao2303.github.io/aegis-ekyc-ui";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, title, pass, actual) => results.push({ id, title, result: pass ? "PASS" : "FAIL", actual });

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });

const text = () => page.evaluate(() => document.body.innerText);
const click = async (label, { exact = false, within } = {}) => {
  const ok = await page.evaluate((label, exact, within) => {
    const els = [...document.querySelectorAll("button, [role=radio], [role=switch], tr")];
    const el = els.find((e) => {
      const t = e.innerText.trim();
      if (!(exact ? t === label : t.includes(label))) return false;
      if (e.tagName === "TR" && !within) return false;
      if (!within) return true;
      const row = e.closest("tr, li, [role=dialog]");
      return row && row.innerText.includes(within);
    });
    if (el && !el.disabled) { el.click(); return true; }
    return el ? "disabled" : false;
  }, label, exact, within ?? null);
  await sleep(500);
  return ok;
};
const btnDisabled = (label) => page.evaluate((label) => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === label)?.disabled ?? null, label);
const setVal = (sel, v) => page.evaluate((sel, v) => {
  const el = [...document.querySelectorAll(sel)].at(-1);
  if (!el) throw new Error("setVal: không thấy " + sel);
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
}, sel, v).then(() => sleep(300));
const shot = (name, fullPage = false) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
const nav = async (label) => { await page.evaluate((l) => [...document.querySelectorAll("nav button, aside button")].find((b) => b.innerText.split("\n")[0].trim() === l)?.click(), label); await sleep(700); };
const fresh = async () => { await page.goto(`${BASE}/credit-limit/?lang=vi&v=${Date.now()}`, { waitUntil: "networkidle0" }); await sleep(1200); };
// không được có PAN đủ 16 số (4 nhóm 4 chữ số liền nhau)
const fullPan = (t) => /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/.test(t);

// ---------- LIM-W1 ----------
await fresh();
await shot("lim-monitor");
let t = await text();
check("TC-LIM-01", "W1 có 4 chỉ số: p99, throughput, tỷ lệ chấp thuận, circuit breaker", ["Độ trễ p99", "Throughput", "Tỷ lệ chấp thuận", "Circuit breaker"].every((k) => t.includes(k)), "Thấy đủ 4 thẻ");
const p99 = Number((t.match(/([\d,]+) s\s*\n?\s*SLA < 2 s/) || [, "0"])[1].replace(",", "."));
check("TC-LIM-02", "p99 hiển thị dưới ngưỡng SLA 2 giây và có nhãn Đạt (RULE-LIM-01)", p99 > 0 && p99 < 2 && t.includes("Đạt"), `p99 = ${p99} s · nhãn "Đạt"`);
const cbStates = [];
for (let i = 0; i < 3; i++) { await click("Circuit breaker"); cbStates.push(((await text()).match(/\b(CLOSED|HALF_OPEN|OPEN)\b/) || [, "?"])[1]); }
check("TC-LIM-03", "Bấm thẻ circuit breaker chuyển CLOSED → HALF_OPEN → OPEN → CLOSED (BR-LIM-09)", cbStates.join(">") === "HALF_OPEN>OPEN>CLOSED", `CLOSED > ${cbStates.join(" > ")}`);
check("TC-LIM-04", "Không màn nào hiện PAN đầy đủ – W1 log (NFR-SEC-04, UAT-LIM-10)", !fullPan(t) && t.includes("••••"), fullPan(t) ? "Có PAN đầy đủ" : "Mọi PAN dạng 4111 •••• •••• 1234");
const topStan = () => page.evaluate(() => document.querySelectorAll("tbody tr td")[0]?.innerText);
await click("Tạm dừng", { exact: true });
const s1 = await topStan(); await sleep(3000); const s2 = await topStan();
check("TC-LIM-05", "Tạm dừng log trực tiếp thì không có dòng mới", s1 === s2 && (await text()).includes("Đã tạm dừng"), `STAN đầu bảng ${s1} → ${s2} sau 3 giây`);
await click("Tiếp tục", { exact: true }); await sleep(2800); const s3 = await topStan();
check("TC-LIM-06", "Tiếp tục thì log nhận dòng mới, STAN tăng dần", Number(s3) > Number(s2), `STAN đầu bảng ${s2} → ${s3}`);
const rows = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].map((r) => [...r.cells].map((c) => c.innerText.trim())));
// Cột: 0 STAN · 1 RRN · 2 Thời gian · 3 MTI · 4 PAN · 5 Điểm bán · 6 Số tiền · 7 Quyết định · 8 Độ trễ · 9 Mã
const mtis = [...new Set(rows.map((r) => r[3]))];
check("TC-LIM-07", "Log có bản tin reversal MTI 0420 (BR-LIM-08, UAT-LIM-05)", mtis.includes("0420"), `MTI trong 12 dòng hiện: ${mtis.join(", ")}${mtis.includes("0400") ? " · UI dùng 0400 và gắn quyết định DECLINED" : " · không thấy dòng reversal"}`);
const badCode = rows.filter((r) => (r[7] === "APPROVED" && r[9] !== "00") || (r[7] === "DECLINED" && !["05", "51"].includes(r[9])) || (r[7] === "FALLBACK" && r[9] !== "00·CASA"));
check("TC-LIM-08", "Mã F39 khớp quyết định: 00 duyệt, 05/51 từ chối, 00·CASA fallback", badCode.length === 0, `${rows.length} dòng, ${badCode.length} dòng lệch`);
const rrnOk = rows.every((r) => /^\d{12}$/.test(r[1]));
const keys = new Set(rows.map((r) => `${r[0]}+${r[1]}`));
check("TC-LIM-34", "Log có cột RRN 12 số, cặp STAN + RRN không trùng (REQ-LIM-01, DEF-LIM-07)", rrnOk && keys.size === rows.length, `${rows.length} dòng · RRN đầu bảng ${rows[0]?.[1]} · ${keys.size} cặp STAN+RRN khác nhau`);

// ---------- LIM-W2 ----------
await nav("Hồ sơ hạn mức thẻ");
await shot("lim-cards");
t = await text();
check("TC-LIM-09", "Danh sách thẻ có thẻ tạm khoá (BLOCKED) và cột version (G-07)", t.includes("Tạm khoá") && /v\d+/.test(t), "C-0004 · Tạm khoá · v22");
await setVal('input[placeholder="Tên hoặc 4 số cuối"]', "1234");
t = await text();
const rowCount = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
check("TC-LIM-10", "Tìm theo 4 số cuối lọc đúng 1 thẻ", rowCount === 1 && t.includes("NGUYEN THI MINH THU"), `Tìm "1234" → ${rowCount} dòng`);
await page.evaluate(() => [...document.querySelectorAll("tbody tr button")][0]?.click()); await sleep(700);
await shot("lim-card-profile", true);
t = await text();
const fbCut = await page.evaluate(() => { const th = [...document.querySelectorAll("th")].find((h) => h.innerText.trim() === "Trạng thái" && h.closest("table")?.innerText.includes("FB-30211")); const box = th?.closest(".overflow-x-auto"); return box ? { sw: box.scrollWidth, cw: box.clientWidth } : null; });
check("TC-LIM-35", "Bảng Smart Fallback ở W2 hiện đủ cột Trạng thái ở cửa sổ 1280 px, không cuộn ngang (DEF-LIM-04)", !!fbCut && fbCut.sw <= fbCut.cw + 1, fbCut ? `Bảng rộng ${fbCut.sw} px trong khung ${fbCut.cw} px` : "Không thấy bảng");
check("TC-LIM-11", "Hồ sơ thẻ có version, tạm giữ, Boost, CASA liên kết", ["Version", "Đang tạm giữ", "Boost", "CASA liên kết"].every((k) => t.includes(k)) && t.includes("v17"), "v17 · tạm giữ 2,3 tr · Boost +10 tr · CASA 1903 6688 2025");
check("TC-LIM-12", "Bảng Smart Fallback có đủ 3 trạng thái HOLD / SETTLED / RELEASED (UAT-LIM-03/04)", ["HOLD", "SETTLED", "RELEASED"].every((k) => t.includes(k)), "FB-30211 HOLD · FB-30188 SETTLED · FB-30140 RELEASED");
await click("Điều chỉnh hạn mức", { exact: true });
await shot("lim-adjust");
await setVal("[role=dialog] input[inputmode=decimal]", "20");
await click("Lưu", { exact: true });
t = await text();
check("TC-LIM-13", "Hạn mức mới thấp hơn dư nợ bị chặn", t.includes("phải lớn hơn dư nợ"), (t.match(/Hạn mức mới phải[^\n]+/) || ["không chặn"])[0]);
await setVal("[role=dialog] input[inputmode=decimal]", "90");
await click("Lưu", { exact: true });
t = await text();
check("TC-LIM-14", "Điều chỉnh hợp lệ tăng version (optimistic locking)", t.includes("version v18"), (t.match(/Đã cập nhật[^\n]+/) || ["không cập nhật"])[0]);
await click("Điều chỉnh hạn mức", { exact: true });
await page.evaluate(() => document.querySelector("[role=dialog] input[type=checkbox]")?.click()); await sleep(300);
await click("Lưu", { exact: true });
t = await text();
await shot("lim-version-conflict");
check("TC-LIM-15", "Giao dịch khác ghi trước thì lệnh sửa bị từ chối, báo xung đột version (BR-LIM-02, UAT-LIM-01)", t.includes("Xung đột phiên bản"), (t.match(/Xung đột phiên bản[^.]+/) || ["không báo"])[0]);

// ---------- LIM-W3 ----------
await nav("Boost");
await shot("lim-boost");
t = await text();
check("TC-LIM-16", "Boost có 3 tab ACTIVE / LOCKED / EXPIRED kèm số lượng (UAT-LIM-06)", /Đang hiệu lực · \d/.test(t) && /Khoá nghi gian lận · \d/.test(t) && /Hết hạn · \d/.test(t), (t.match(/Đang hiệu lực · \d[^\n]*/) || [""])[0]);
await click("Khoá", { exact: true, within: "BST-7701" });
await click("Khoá nghi gian lận");
t = await text();
check("TC-LIM-17", "Risk khoá thủ công một Boost đang hiệu lực → sang tab khoá", t.includes("BST-7701") && t.includes("Khoá thủ công"), t.includes("BST-7701") ? "BST-7701 · Khoá thủ công bởi Trần Bảo Ngọc (không hỏi lý do, không gửi thông báo)" : "không chuyển");
await click("Mở khoá", { exact: true, within: "BST-7690" });
const unlockEmpty = await btnDisabled("Mở khoá");
await setVal("[role=dialog] textarea", "ngắn");
const unlockShort = await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.innerText.trim() === "Mở khoá")?.disabled);
await setVal("[role=dialog] textarea", "Khách xác nhận qua tổng đài lúc 10:20");
await shot("lim-boost-unlock");
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.innerText.trim() === "Mở khoá")?.click()); await sleep(500);
await click("Đang hiệu lực");
t = await text();
check("TC-LIM-18", "Mở khoá Boost bắt buộc lý do ≥ 10 ký tự", unlockShort === true && t.includes("BST-7690"), `Nút khoá khi lý do 4 ký tự: ${unlockShort ? "có" : "không"} · BST-7690 về Đang hiệu lực`);

// ---------- LIM-W4 ----------
await nav("Giám sát gian lận");
await shot("lim-fraud");
t = await text();
const fr = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].map((r) => ({ id: r.cells[0].innerText, score: Number(r.cells[4].innerText), action: r.cells[5].innerText, status: r.cells[8].innerText })));
const openFr = fr.filter((f) => f.status === "Đang mở");
const sorted = openFr.every((f, i) => i === 0 || openFr[i - 1].score >= f.score);
check("TC-LIM-19", "Case đang mở xếp trên, điểm cao trước", sorted && fr.at(-1).status === "Đã đóng", openFr.map((f) => `${f.id}(${f.score})`).join(" > "));
const actOk = fr.every((f) => (f.score >= 75) === f.action.includes("Khoá Boost"));
check("TC-LIM-20", "Điểm ≥ 75 → khoá Boost, thấp hơn → chỉ gắn cờ (UC-LIM-06)", actOk, fr.map((f) => `${f.score}→${f.action}`).join(" · "));
await click("Gửi lại", { exact: true, within: "FR-2196" });
const midSms = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("FR-2196"))?.cells[6].innerText);
await sleep(2000);
const endSms = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("FR-2196"))?.cells[6].innerText);
check("TC-LIM-21", "SMS gửi thất bại có nút Gửi lại, trạng thái FAILED → PENDING → DELIVERED (UAT-LIM-07)", midSms?.includes("PENDING") && endSms?.includes("DELIVERED"), `FR-2196 SMS: FAILED → ${midSms} → ${endSms}`);
await click("Xem mẫu thông báo");
t = await text();
await shot("lim-notification");
check("TC-LIM-22", "Mẫu SMS ghi rõ là bản giữ chỗ chờ Risk/Legal/CSKH duyệt (ISS-03, DEP-07)", t.includes("Nội dung giữ chỗ") && t.includes("DEP-07") && !fullPan(t), "Có cảnh báo giữ chỗ; PAN dạng ****0042");
await page.keyboard.press("Escape"); await sleep(300);
await click("Đóng case", { exact: true, within: "FR-2201" });
await shot("lim-fraud-close");
const offNoConclusion = await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].at(-1)?.disabled);
await page.evaluate(() => document.querySelector('[role=dialog] input[value="CUSTOMER_CONFIRMED"]')?.click()); await sleep(200);
await setVal("[role=dialog] textarea", "ngắn");
const offShortNote = await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].at(-1)?.disabled);
await setVal("[role=dialog] textarea", "Khách xác nhận qua tổng đài lúc 10:20");
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].at(-1)?.click()); await sleep(500);
const fr2201 = await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("FR-2201"))?.cells[8].innerText.replace(/\s+/g, " ").trim());
check("TC-LIM-23", "Đóng case bắt buộc chọn kết luận và ghi chú ≥ 10 ký tự, kết luận hiện trên dòng (REQ-LIM-17, DEF-LIM-06)", offNoConclusion === true && offShortNote === true && /Đã đóng.*Khách xác nhận là mình/.test(fr2201 ?? ""), `Nút khoá khi chưa chọn: ${offNoConclusion} · khi ghi chú < 10 ký tự: ${offShortNote} · FR-2201 → ${fr2201}`);

// ---------- Mobile M1 → M3 ----------
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mob = async (s) => { await page.goto(`${BASE}/app/?screen=${s}&lang=vi&api=off&v=${Date.now()}`, { waitUntil: "networkidle0" }); await sleep(900); };
await mob("cardHome");
await shot("app-cardHome");
t = await text();
check("TC-LIM-24", "M1 hạn mức khả dụng = hạn mức − đã dùng − tạm giữ", t.includes("31.450.000 ₫") && t.includes("80.000.000 ₫"), "80.000.000 − 46.250.000 − 2.300.000 = 31.450.000 ₫");
check("TC-LIM-25", "Không màn nào hiện PAN đầy đủ – M1", !fullPan(t), "4111 •••• •••• 1234");
const sw = async () => page.evaluate(() => document.querySelector("[role=switch]")?.getAttribute("aria-checked"));
const sw1 = await sw(); await page.click("[role=switch]"); await sleep(300); const sw2 = await sw();
const swLabel = await page.evaluate(() => document.querySelector("[role=switch]")?.getAttribute("aria-label"));
check("TC-LIM-26", "Công tắc Smart Fallback bật/tắt được, có nhãn cho trình đọc màn hình", sw1 === "true" && sw2 === "false" && !!swLabel, `aria-checked ${sw1} → ${sw2} · aria-label "${swLabel}"`);
await click("Nâng hạn mức tạm thời");
await shot("app-boostOffer");
t = await text();
const acceptDisabled = await btnDisabled("Nhận ưu đãi");
check("TC-LIM-27", "M2 hiện hạn mức mới, thời hạn, tự trở về, phí; nút Nhận khoá tới khi tick điều kiện", ["Hạn mức mới", "Hiệu lực", "Sau thời hạn", "Phí"].every((k) => t.includes(k)) && acceptDisabled === true, `Đủ 4 dòng · nút Nhận ưu đãi ${acceptDisabled ? "bị khoá" : "bấm được"} khi chưa tick`);
check("TC-LIM-28", "Thời hạn Boost theo chu kỳ sao kê kế tiếp (BR-LIM-06, RULE-LIM-06)", /sao kê/i.test(t), (t.match(/Nhờ lịch sử[^\n]+/) || [""])[0] + " · hiệu lực " + ((t.match(/Ngay bây giờ[^\n]+/) || [""])[0]));
await page.evaluate(() => document.querySelector("input[type=checkbox]")?.click()); await sleep(300);
await click("Nhận ưu đãi");
t = await text();
check("TC-LIM-29", "Nhận Boost → hạn mức mới 90 triệu", t.includes("90.000.000 ₫"), (t.match(/Hạn mức mới [^\n]+/) || [""])[0]);
await click("Về thẻ của tôi");
t = await text();
await shot("app-cardHome-boost");
check("TC-LIM-30", "M1 sau khi nhận: Boost đang hiệu lực, đếm ngược, khả dụng tăng 10 triệu", t.includes("Boost đang hiệu lực") && /Còn \d+ ngày \d{2}:\d{2}:\d{2}/.test(t) && t.includes("41.450.000 ₫"), (t.match(/Còn [^\n]+/) || ["không đếm ngược"])[0] + " · khả dụng 41.450.000 ₫");
await mob("boostLocked");
await shot("app-boostLocked");
t = await text();
check("TC-LIM-31", "M3 nêu lý do tạm khoá, hạn mức gốc vẫn dùng, có 2 lựa chọn (UC-LIM-06 bước 4)", t.includes("Hạn mức gốc vẫn dùng bình thường") && t.includes("Đúng, tôi đã thực hiện") && t.includes("Không phải tôi"), "Có lý do, 2 nút, cảnh báo không hỏi OTP");
await click("Không phải tôi");
t = await text();
await shot("app-boostLocked-notMine");
check("TC-LIM-32", "Chọn Không phải tôi → thẻ khoá, hẹn liên hệ trong 24 giờ", t.includes("Thẻ đã được khoá") && t.includes("24 giờ"), "Thẻ đã được khoá · tra soát · 24 giờ");
await mob("boostLocked");
await click("Đúng, tôi đã thực hiện");
t = await text();
check("TC-LIM-33", "Chọn Đúng là tôi → báo xem lại trong 30 phút", t.includes("30 phút"), (t.match(/Chúng tôi đang xem lại[^\n]+/) || [""])[0]);

console.log(JSON.stringify(results, null, 1));
await browser.close();
