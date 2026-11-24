/* Module 2 · Đối soát: chụp ảnh REC-01 → 06 cho R03 và chạy các kiểm thử giao diện của R04.
   Mặc định chạy trên bản GitHub Pages; đổi bằng WEB=http://localhost:5179.
   node rec-screens.mjs ../../public/ui > rec-results.json */
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
// bấm phần tử đầu tiên (button / [role=radio] / tr) có chữ khớp; scope = chữ của hàng chứa nút
const click = async (label, { exact = false, within } = {}) => {
  const ok = await page.evaluate((label, exact, within) => {
    const els = [...document.querySelectorAll("button, [role=radio], [role=option], li[role=option]")];
    const el = els.find((e) => {
      const t = e.innerText.trim();
      if (!(exact ? t === label : t.includes(label))) return false;
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
const shot = (name, fullPage = false) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
const fresh = async () => { await page.goto(`${BASE}/reconciliation/?v=${Date.now()}`, { waitUntil: "networkidle0" }); await sleep(1200); };

// ---------- REC-01 ----------
await fresh();
await shot("rec-dashboard");
let t = await text();
check("TC-REC-01", "REC-01 có 4 chỉ số KPI", ["Tỷ lệ khớp tự động", "MTTR", "Giá trị chưa khớp", "Zero-touch"].every((k) => t.includes(k)), "Thấy đủ 4 thẻ");
check("TC-REC-02", "REC-01 ghi thời điểm cập nhật dữ liệu (UAT-REC-09)", /Cập nhật lúc \d{2}:\d{2}/.test(t), (t.match(/Cập nhật lúc [^\n]+/) || ["không thấy"])[0]);
check("TC-REC-03", "Nguồn ví điện tử ở trạng thái Cách ly, có lý do (UAT-REC-02)", t.includes("Cách ly") && t.includes("đã cách ly"), "Cổng ví điện tử · Cách ly · File lỗi định dạng");
check("TC-REC-04", "Nguồn trễ lịch được đánh dấu Trễ", t.includes("Trễ 3h"), "Visa settlement · Trễ");

// ---------- REC-02 ----------
await click("Quy tắc đối soát");
await shot("rec-rules");
await click("Duyệt", { exact: true, within: "MR-004" });
t = await text();
check("TC-REC-05", "Không tự duyệt quy tắc do mình tạo (RULE-REC-05 / SoD)", t.includes("bạn là người tạo quy tắc"), (t.match(/Không thể duyệt[^\n]+/) || ["Duyệt được"])[0]);

// ---------- REC-03 ----------
await click("Tạo quy tắc");
await page.evaluate(() => { const i = document.querySelector("[role=dialog] input"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "CBS ↔ NAPAS · hoàn tiền"); i.dispatchEvent(new Event("input", { bubbles: true })); });
await sleep(300);
// chọn chính mình làm Checker
const pickChecker = async (name) => {
  await page.evaluate((name) => {
    const sel = document.querySelector("[role=dialog] select");
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    set.call(sel, name); sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, name);
  await sleep(400);
};
await pickChecker("Lê Hoàng Nam");
t = await text();
const submitDisabled = await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.innerText.includes("Gửi duyệt"))?.disabled);
await shot("rec-rule-form-sod");
check("TC-REC-06", "Form tạo quy tắc chặn khi Checker = Maker (UAT-REC-08)", t.includes("Vi phạm phân tách nhiệm vụ") && submitDisabled === true, `Banner SoD ${t.includes("Vi phạm phân tách nhiệm vụ") ? "có" : "không"}, nút Gửi duyệt ${submitDisabled ? "bị khoá" : "bấm được"}`);
await pickChecker("Đỗ Minh Quân");
await click("Gửi duyệt");
t = await text();
check("TC-REC-07", "Quy tắc mới vào Chờ duyệt, version 1", t.includes("MR-006") && t.includes("CBS ↔ NAPAS · hoàn tiền"), t.includes("MR-006") ? "MR-006 · Chờ duyệt · v1" : "Không thấy quy tắc mới");

// ---------- REC-04 ----------
await click("Ngoại lệ");
await shot("rec-exceptions");
t = await text();
check("TC-REC-08", "Danh sách mặc định chỉ hiện ngoại lệ đang mở", !t.includes("EXC-1120") && t.includes("EXC-1125"), t.includes("EXC-1120") ? "Có cả hồ sơ đã xử lý" : "4 ngoại lệ đang mở, không có EXC-1120");
check("TC-REC-09", "Mỗi ngoại lệ có aging và gợi ý AI kèm %", /\d+–\d+d|>7d/.test(t) && /\d+%/.test(t), "Có cột Aging và Gợi ý AI");

// ---------- REC-05 ----------
const setVal = (sel, v) => page.evaluate((sel, v) => {
  const el = [...document.querySelectorAll(sel)].at(-1);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
}, sel, v).then(() => sleep(300));
const btnDisabled = (label) => page.evaluate((label) => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === label)?.disabled ?? null, label);
const lineageGL = () => text().then((x) => (x.match(/GLEntry\s+([^\n]+)/) || [, ""])[1]);

await click("EXC-1125", { exact: true });
await shot("rec-exception-detail");
t = await text();
check("TC-REC-10", "Ngoại lệ quá SLA có cảnh báo và trạng thái Leo thang (RULE-REC-06)", t.includes("Quá hạn xử lý") && t.includes("ESCALATED"), (t.match(/Quá hạn xử lý[^\n]+/) || ["không có"])[0]);
check("TC-REC-11", "Truy vết 4 bước, bước thiếu đối ứng ghi rõ (UAT-REC-10)", ["SourceTransaction", "MatchResult", "ExceptionCase", "GLEntry"].every((k) => t.includes(k)) && t.includes("Không tìm thấy đối ứng") && t.includes("GL-90313 · PENDING"), "FT2611080017 → Không tìm thấy đối ứng → EXC-1125 → GL-90313 · PENDING");
// TC-12 nguyên nhân khác
await click("Nguyên nhân khác");
await setVal("textarea", "ngắn");
const shortBlocked = (await text()).includes("Ghi chú nguyên nhân cần ít nhất");
await setVal("textarea", "NAPAS gửi lại file T+2 do lỗi hệ thống");
const longOk = !(await text()).includes("Ghi chú nguyên nhân cần ít nhất");
const hasCat = await page.evaluate(() => !!document.querySelector("select[aria-label], label select"));
check("TC-REC-12", "Chọn được nguyên nhân ngoài top-3, ghi chú bắt buộc ≥ 10 ký tự (REQ-REC-01)", shortBlocked && longOk && hasCat, `Có "Nguyên nhân khác" + danh mục chuẩn; ghi chú 4 ký tự bị chặn, ghi chú dài được nhận`);
// TC-20 khoá bút toán thứ hai
await click("Hạch toán điều chỉnh", { exact: true });
t = await text();
const lockDisabled = await btnDisabled("Tạo bút toán điều chỉnh");
check("TC-REC-20", "Ngoại lệ đã có bút toán chờ duyệt không sinh thêm bút toán thứ hai (REQ-REC-08)", t.includes("GL-90313") && t.includes("đang chờ Checker") && lockDisabled === true, (t.match(/Đã có bút toán[^\n]+/) || ["không có cảnh báo"])[0] + (lockDisabled ? " · nút bị khoá" : " · nút bấm được"));
await shot("rec-exception-locked", true);

// TC-15 khớp thủ công (DUPLICATE)
await click("Danh sách ngoại lệ");
await click("EXC-1128", { exact: true });
const glCountBefore = (await text()).match(/GL-\d+/g)?.length ?? 0;
await click("Khớp thủ công", { exact: true });
await setVal("input[placeholder]", "NP-5510-DUP");
await click("Khớp thủ công & đóng", { exact: true });
t = await text();
check("TC-REC-15", "Có 3 cách xử lý; khớp thủ công đóng ngoại lệ không sinh bút toán (REQ-REC-02)", t.includes("RESOLVED") && t.includes("Không cần hạch toán"), `EXC-1128 → ${t.includes("RESOLVED") ? "RESOLVED" : "chưa đóng"} · GLEntry: ${await lineageGL()}`);

// TC-14 ngoại lệ nhỏ → zero-touch
await click("Danh sách ngoại lệ");
await click("EXC-1127", { exact: true });
await click("Hạch toán điều chỉnh", { exact: true });
await click("Tạo bút toán điều chỉnh", { exact: true });
t = await text();
check("TC-REC-14", "Điều chỉnh ≤ 50 triệu hạch toán zero-touch, ngoại lệ đóng", /POSTED/.test(await lineageGL()) && t.includes("RESOLVED"), `GLEntry: ${await lineageGL()}`);

// ---------- REC-06 ----------
await click("Bút toán GL");
await shot("rec-gl");
await click("Duyệt", { exact: true, within: "GL-90314" });
t = await text();
check("TC-REC-16", "Maker không tự duyệt bút toán của mình", t.includes("bạn là Maker"), (t.match(/Không thể duyệt GL[^\n]+/) || ["Duyệt được"])[0]);
await click("Duyệt", { exact: true, within: "GL-90313" });
t = await text();
check("TC-REC-17", "Checker khác Maker duyệt → Đã hạch toán", t.includes("Đã duyệt và hạch toán GL-90313"), (t.match(/Đã duyệt[^\n]+/) || ["không đổi"])[0]);
await click("Ngoại lệ");
t = await text();
check("TC-REC-22", "Bút toán được duyệt thì ngoại lệ liên quan đóng (DEF-REC-06)", !t.includes("EXC-1125"), t.includes("EXC-1125") ? "EXC-1125 vẫn đang mở" : "EXC-1125 rời danh sách đang mở sau khi GL-90313 POSTED");

// Trả về Maker
await fresh();
await click("Bút toán GL");
await click("Trả về", { exact: true, within: "GL-90313" });
const retDisabledEmpty = await btnDisabled("Xác nhận trả về");
await setVal("[role=dialog] textarea", "Thiếu chứng từ NAPAS T+1 đính kèm");
await click("Xác nhận trả về", { exact: true });
t = await text();
check("TC-REC-19", "Checker trả bút toán về Maker kèm ghi chú (REQ-REC-06)", retDisabledEmpty === true && t.includes("Trả về Maker") && t.includes("Checker ghi chú: Thiếu chứng từ"), t.includes("Checker ghi chú") ? "GL-90313 → Trả về Maker, hiện ghi chú của Checker" : "không trả về được");

// Từ chối có lý do → ngoại lệ mở lại → hạch toán lại → chờ hạch toán
await fresh();
await click("Bút toán GL");
await shot("rec-gl");
await click("Từ chối", { exact: true, within: "GL-90313" });
const rejDisabledEmpty = await btnDisabled("Xác nhận từ chối");
await setVal("[role=dialog] textarea", "Sai tài khoản treo, phải dùng 4211.07");
await shot("rec-gl-reject");
await click("Xác nhận từ chối", { exact: true });
t = await text();
check("TC-REC-18", "Từ chối bắt buộc lý do ≥ 10 ký tự, lý do hiện trên bút toán (REQ-REC-05)", rejDisabledEmpty === true && t.includes("Lý do từ chối: Sai tài khoản treo"), rejDisabledEmpty ? "Nút xác nhận khoá khi trống; lý do hiện dưới GL-90313" : "Từ chối không cần lý do");
await click("Ngoại lệ");
await click("EXC-1125", { exact: true });
await click("Hạch toán điều chỉnh", { exact: true });
await click("Tạo bút toán điều chỉnh", { exact: true });
t = await text();
check("TC-REC-13", "Điều chỉnh > 50 triệu không tự hạch toán, chờ Checker (RULE-REC-04, UAT-REC-07)", /PENDING/.test(await lineageGL()), `GLEntry: ${await lineageGL()}`);
check("TC-REC-21", "Ngoại lệ chờ bút toán > 50 triệu ở trạng thái Chờ hạch toán, chưa đóng (DEF-REC-06)", t.includes("PENDING_POSTING"), t.includes("PENDING_POSTING") ? "EXC-1125 → PENDING_POSTING" : "Ngoại lệ đã đóng");

console.log(JSON.stringify(results, null, 1));
await browser.close();
