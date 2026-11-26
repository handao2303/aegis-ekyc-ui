/* Engine – TC-REC-B03 → B05, RULE-REC-01 → 03, REQ-REC-15, 16 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFuzzy, fuzzyScore, levenshtein, runEngine, subsetSum, type Rule, type Txn } from "../src/engine.ts";

const opts = { fuzzy_threshold: 0.95, fuzzy_gap: 0.02, partial_floor: 0.6, n1_timeout_ms: 2000, n1_max_items: 20 };
let n = 0;
const tx = (p: Partial<Txn>): Txn => ({
  txn_id: `T${++n}`, source: "CBS", side: "INTERNAL", reference_no: `R${n}`, amount_minor: 100_00, currency: "VND", direction: "CREDIT",
  txn_at: Date.parse("2026-11-25T03:00:00Z"), value_date: null, account_no: null, counterparty_account: null, batch_id: null, channel: "NAPAS", ...p,
});
const rule = (p: Partial<Rule>): Rule => ({
  rule_id: "MR-T", version: 1, type: "EXACT", source_pair: "CBS↔NAPAS", match_keys: ["REF", "AMOUNT", "CURRENCY"], amount_tolerance_pct: null,
  date_tolerance_days: null, fuzzy_threshold: null, fuzzy_gap: null, n1_max_items: null, n1_timeout_ms: null, ...p,
});

test("TC-REC-B03: REF + AMOUNT + CURRENCY trùng → MATCHED ngay, không chạy Fuzzy", () => {
  const i = tx({ reference_no: "FT1" }), e = tx({ side: "EXTERNAL", source: "NAPAS", reference_no: "ft 1", channel: null });
  const out = runEngine([i, e], [rule({}), rule({ rule_id: "MR-F", type: "FUZZY", match_keys: ["AMOUNT"] })], opts);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "MATCHED");
  assert.equal(out[0].rule!.rule_id, "MR-T", "EXACT chạy trước và khớp, Fuzzy không được gọi");
  assert.equal(out[0].score, 1);
});

test("EXACT tự thêm CURRENCY: cùng số, khác loại tiền → không khớp", () => {
  const i = tx({ reference_no: "FT2" }), e = tx({ side: "EXTERNAL", source: "NAPAS", reference_no: "FT2", currency: "USD", channel: null });
  const out = runEngine([i, e], [rule({ match_keys: ["REF", "AMOUNT"] })], opts);
  assert.equal(out[0].status, "UNMATCHED");
});

test("EXACT có 2 ứng viên giống hệt → không tự chọn, để ngoại lệ", () => {
  const i = tx({ reference_no: "FT3" });
  const e1 = tx({ side: "EXTERNAL", source: "NAPAS", reference_no: "FT3", channel: null, txn_at: i.txn_at + 1 });
  const e2 = tx({ side: "EXTERNAL", source: "NAPAS", reference_no: "FT3", channel: null, txn_at: i.txn_at + 2 });
  const out = runEngine([i, e1, e2], [rule({})], opts);
  assert.equal(out[0].status, "UNMATCHED");
});

test("TC-REC-B04: ngưỡng 0.95 – 0.951 MATCHED, 0.949 ngoại lệ, 2 ứng viên cách < 0.02 → PARTIAL", () => {
  assert.equal(classifyFuzzy([0.951], 0.95, 0.02, 0.6), "MATCHED");
  assert.equal(classifyFuzzy([0.949], 0.95, 0.02, 0.6), "PARTIAL");
  assert.equal(classifyFuzzy([0.961, 0.955], 0.95, 0.02, 0.6), "PARTIAL");
  assert.equal(classifyFuzzy([0.98, 0.955], 0.95, 0.02, 0.6), "MATCHED", "cách 0.025 ≥ gap");
  assert.equal(classifyFuzzy([0.5], 0.95, 0.02, 0.6), "NONE");
  assert.equal(classifyFuzzy([], 0.95, 0.02, 0.6), "NONE");
});

test("Fuzzy chấm điểm: trong dung sai ≥ 0.96, lệch ngoài dung sai giảm dần", () => {
  const r = rule({ type: "FUZZY", match_keys: ["AMOUNT"], amount_tolerance_pct: 0.5 });
  const i = tx({ amount_minor: 1_000_000_00 });
  assert.equal(fuzzyScore(i, tx({ amount_minor: 1_000_000_00 }), r), 1);
  assert.ok(fuzzyScore(i, tx({ amount_minor: 995_000_00 }), r) >= 0.96);
  assert.ok(fuzzyScore(i, tx({ amount_minor: 990_000_00 }), r) < 0.9);
  assert.equal(levenshtein("WL1001", "WL101"), 1);
});

test("Fuzzy lệch tỷ giá 0,8% → PARTIAL kèm chênh lệch; gợi ý ngữ cảnh AMOUNT_DIFF", () => {
  const r = rule({ type: "FUZZY", source_pair: "CBS↔VISA", match_keys: ["AMOUNT", "DATE", "ACCOUNT"], amount_tolerance_pct: 0.5, date_tolerance_days: 1 });
  const i = tx({ channel: "VISA", amount_minor: 48_250_000_00, counterparty_account: "4111 •••• 1234" });
  const e = tx({ side: "EXTERNAL", source: "VISA", channel: null, amount_minor: 47_864_000_00, account_no: "4111 •••• 1234" });
  const [o] = runEngine([i, e], [r], opts);
  assert.equal(o.status, "PARTIAL");
  assert.equal(o.status === "PARTIAL" && o.diff_minor, 386_000_00);
  assert.equal(o.status === "PARTIAL" && o.hint, "AMOUNT_DIFF");
});

test("Giao dịch nội bộ chỉ đối soát với kênh của nó (CBS↔NAPAS không lấy đối ứng Visa)", () => {
  const i = tx({ reference_no: "FT9", channel: "VISA" });
  const e = tx({ side: "EXTERNAL", source: "NAPAS", reference_no: "FT9", channel: null });
  const out = runEngine([i, e], [rule({})], opts);
  assert.equal(out[0].status, "UNMATCHED");
  assert.equal(out[0].rule, null, "không có quy tắc nào cho cặp CBS↔VISA");
});

test("N:1 tổng lô khớp → MATCHED; thiếu phí → PARTIAL với chênh lệch", () => {
  const r = rule({ type: "N1", source_pair: "CBS↔MASTERCARD", match_keys: ["BATCH", "AMOUNT"] });
  const i = tx({ channel: "MASTERCARD", batch_id: "B1", amount_minor: 12_382_000_00 });
  const e = [7_382_000_00, 5_000_000_00].map((a) => tx({ side: "EXTERNAL", source: "MASTERCARD", channel: null, batch_id: "B1", amount_minor: a }));
  assert.equal(runEngine([i, ...e], [r], opts)[0].status, "MATCHED");
  const i2 = tx({ channel: "MASTERCARD", batch_id: "B2", amount_minor: 12_400_000_00 });
  const e2 = [9_382_000_00, 3_000_000_00].map((a) => tx({ side: "EXTERNAL", source: "MASTERCARD", channel: null, batch_id: "B2", amount_minor: a }));
  const [o] = runEngine([i2, ...e2], [r], opts);
  assert.equal(o.status, "PARTIAL");
  assert.equal(o.status === "PARTIAL" && o.diff_minor, 18_000_00);
});

test("N:1 subset-sum tìm đúng tập con khi lô có giao dịch không thuộc khoản tất toán", () => {
  const r = subsetSum([500, 300, 200, 70], 570, 1000);
  assert.ok(Array.isArray(r));
  assert.equal((r as number[]).map((k) => [500, 300, 200, 70][k]).reduce((a, b) => a + b, 0), 570);
  assert.equal(subsetSum([5, 7], 3, 1000), null);
});

test("TC-REC-B05: lô 200 giao dịch, giới hạn 2 giây → dừng ≤ 2 giây và tạo ngoại lệ", () => {
  // Số lẻ nguyên tố cùng nhau, mục tiêu không đạt được → buộc tìm kiếm vét cạn tới khi hết giờ
  const amounts = Array.from({ length: 200 }, (_, k) => 1_000_003 + k * 2);
  const r = rule({ type: "N1", source_pair: "CBS↔MASTERCARD", match_keys: ["BATCH", "AMOUNT"], n1_max_items: 200, n1_timeout_ms: 2000 });
  const i = tx({ channel: "MASTERCARD", batch_id: "B200", amount_minor: 100_000_301 });
  const ext = amounts.map((a) => tx({ side: "EXTERNAL", source: "MASTERCARD", channel: null, batch_id: "B200", amount_minor: a }));
  const t = performance.now();
  const [o] = runEngine([i, ...ext], [r], opts);
  const took = performance.now() - t;
  assert.ok(took <= 2300, `mất ${took.toFixed(0)}ms`);
  assert.equal(o.status, "PARTIAL");
  assert.equal(o.status === "PARTIAL" && o.hint, "N1_TIMEOUT");
});

test("Vượt n1_max_items → chuyển ngoại lệ ngay, không thử tổ hợp", () => {
  const r = rule({ type: "N1", source_pair: "CBS↔MASTERCARD", match_keys: ["BATCH", "AMOUNT"], n1_max_items: 5 });
  const i = tx({ channel: "MASTERCARD", batch_id: "B6", amount_minor: 999 });
  const ext = Array.from({ length: 6 }, () => tx({ side: "EXTERNAL", source: "MASTERCARD", channel: null, batch_id: "B6", amount_minor: 100 }));
  const t = performance.now();
  const [o] = runEngine([i, ...ext], [r], opts);
  assert.ok(performance.now() - t < 50);
  assert.equal(o.status === "PARTIAL" && o.hint, "N1_TIMEOUT");
});

test("DUPLICATE: giao dịch nội bộ lặp lại một giao dịch đã khớp trong 10 phút", () => {
  const a = tx({ reference_no: "FT10", account_no: "190311223344", amount_minor: 3_500_000_00 });
  const b = tx({ reference_no: "FT11", account_no: "190311223344", amount_minor: 3_500_000_00, txn_at: a.txn_at + 120_000 });
  const e = tx({ side: "EXTERNAL", source: "NAPAS", channel: null, reference_no: "FT10", amount_minor: 3_500_000_00 });
  const out = runEngine([a, b, e], [rule({})], opts);
  assert.deepEqual(out.map((o) => o.status).sort(), ["DUPLICATE", "MATCHED"]);
});
