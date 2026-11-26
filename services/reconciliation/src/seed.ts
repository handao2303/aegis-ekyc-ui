/* Dữ liệu mẫu hư cấu – đi qua đúng luồng thật (nạp file → engine → xử lý), không chèn thẳng kết quả.
   Người dùng khớp 3 vai UAT của UI mẫu (R03 §1) + Kế toán trưởng. Quy tắc giữ người tạo như UI mẫu để kiểm RULE-REC-05. */
import { clock, H, type Row } from "./db.ts";
import type { RecService, Staff } from "./service.ts";

const STAFF: Staff[] = [
  { id: "u-nam", name: "Lê Hoàng Nam", role: "REC_OFFICER" },
  { id: "u-trang", name: "Phạm Thu Trang", role: "REC_CHECKER" },
  { id: "u-quan", name: "Đỗ Minh Quân", role: "REC_LEAD" },
  { id: "u-ha", name: "Vũ Thanh Hà", role: "FIN_VIEWER" },
];

/** Quy tắc lịch sử (đã qua duyệt trước khi có hệ thống) – ghi thẳng version hiện hành */
const RULES: Row[] = [
  { rule_id: "MR-001", version: 7, name: "CBS ↔ NAPAS · khớp tuyệt đối", source_pair: "CBS↔NAPAS", type: "EXACT", match_keys: ["REF", "AMOUNT", "DATE", "CURRENCY"], status: "ACTIVE", created_by: "u-trang", approved_by: "u-quan" },
  { rule_id: "MR-002", version: 4, name: "CBS ↔ Visa · lệch tỷ giá", source_pair: "CBS↔VISA", type: "FUZZY", match_keys: ["AMOUNT", "DATE", "ACCOUNT"], amount_tolerance_pct: 0.5, date_tolerance_days: 1, status: "ACTIVE", created_by: "u-quan", approved_by: "u-trang" },
  { rule_id: "MR-003", version: 2, name: "Gộp phí N:1 Mastercard", source_pair: "CBS↔MASTERCARD", type: "N1", match_keys: ["BATCH", "AMOUNT"], n1_max_items: 20, status: "ACTIVE", created_by: "u-quan", approved_by: "u-trang" },
  { rule_id: "MR-004", version: 1, name: "Ví điện tử · mã tham chiếu rút gọn", source_pair: "CBS↔WALLET", type: "FUZZY", match_keys: ["REF", "AMOUNT"], status: "PENDING", created_by: "u-nam", checker_id: "u-trang" },
  { rule_id: "MR-005", version: 1, name: "Hoàn tiền NAPAS (refund)", source_pair: "CBS↔NAPAS", type: "EXACT", match_keys: ["REF", "AMOUNT", "CURRENCY"], status: "DRAFT", created_by: "u-trang" },
];

const iso = (ms: number) => new Date(ms).toISOString();
const csv = (rows: Row[]) => {
  const cols = ["reference_no", "amount", "currency", "direction", "txn_at", "account_no", "counterparty_account", "batch_id", "channel"];
  return [cols.join(","), ...rows.map((r) => cols.map((c) => r[c] ?? "").join(","))].join("\n");
};
const camt054 = (rows: Row[]) => `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08"><BkToCstmrDbtCdtNtfctn><Ntfctn>
${rows.map((r) => `<Ntry><Amt Ccy="VND">${r.amount}</Amt><CdtDbtInd>${r.direction === "DEBIT" ? "DBIT" : "CRDT"}</CdtDbtInd><BookgDt><DtTm>${r.txn_at}</DtTm></BookgDt><AcctSvcrRef>${r.reference_no}</AcctSvcrRef><Acct><Id><Othr><Id>${r.account_no}</Id></Othr></Id></Acct></Ntry>`).join("\n")}
</Ntfctn></BkToCstmrDbtCdtNtfctn></Document>`;

export function seed(svc: RecService) {
  const db = svc.db;
  // Giữ trạng thái đồng hồ của người gọi (test dùng đồng hồ cố định) và trả lại khi xong
  const saved = { fixed: clock.fixed, offsetMs: clock.offsetMs };
  const realNow = clock.now();
  const at = (hoursAgo: number) => realNow - hoursAgo * H;
  for (const s of STAFF) db.run("INSERT OR IGNORE INTO staff(id, name, role) VALUES(?,?,?)", s.id, s.name, s.role);
  for (const r of RULES) {
    db.run(`INSERT OR IGNORE INTO matching_rules(rule_id, version, name, source_pair, type, match_keys, amount_tolerance_pct, date_tolerance_days, n1_max_items,
      status, created_by, updated_by, checker_id, approved_by, approved_at, effective_from, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      r.rule_id, r.version, r.name, r.source_pair, r.type, JSON.stringify(r.match_keys), r.amount_tolerance_pct ?? null, r.date_tolerance_days ?? null, r.n1_max_items ?? null,
      r.status, r.created_by, r.created_by, r.checker_id ?? r.approved_by ?? null, r.approved_by ?? null, r.approved_by ? at(24 * 30) : null, r.status === "ACTIVE" ? at(24 * 30) : null, at(24 * 40));
  }
  const S = (id: string) => svc.staff(id);
  const round = (hoursAgo: number, fn: () => void) => { clock.set(at(hoursAgo)); fn(); svc.runMatching(); };

  // ---- Vòng 1 (75 giờ trước): NAPAS khớp tuyệt đối, Visa lệch tỷ giá, NAPAS thiếu đối ứng ----
  round(75, () => {
    const t = at(76);
    const napas = Array.from({ length: 8 }, (_, i) => ({ reference_no: `FT26110510${String(i).padStart(2, "0")}`, amount: `${(i + 1) * 2_150_000}.00`, currency: "VND", direction: "CREDIT", txn_at: iso(t + i * 60_000), account_no: `0071000345${60 + i}`, channel: "NAPAS" }));
    svc.ingestFile({ source: "CBS", format: "CSV", file_name: "CBS_GL_20261123_01.csv", content: csv([
      ...napas,
      { reference_no: "FT2611051209", amount: "9870000.00", currency: "VND", direction: "DEBIT", txn_at: iso(t), account_no: "190322118899", counterparty_account: "4111111111119981", channel: "VISA" },
      { reference_no: "FT2611080017", amount: "125000000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t + 9 * 60_000), account_no: "007100034567", channel: "NAPAS" },
    ]) });
    svc.ingestFile({ source: "NAPAS", format: "CAMT054", file_name: "NAPAS_camt054_20261123.xml", content: camt054(napas) });
    svc.ingestFile({ source: "VISA", format: "TC33", file_name: "VISA_TC33_20261123.csv", content: csv([
      { reference_no: "VS-881044", amount: "9810780.00", currency: "VND", direction: "DEBIT", txn_at: iso(t + 20 * H), account_no: "4111 •••• 9981" },
    ]) });
  });
  // Trang xử lý ngoại lệ Visa lệch tỷ giá: điều chỉnh nhỏ → zero-touch
  const visaSmall = svc.exceptions({ status: "open" }).find((c) => c.internal?.reference_no === "FT2611051209")!;
  clock.set(at(70));
  svc.claim(S("u-trang"), visaSmall.case_id);
  svc.resolve(S("u-trang"), visaSmall.case_id, { root_cause: { code: "FX_DIFF", override: false }, type: "ADJUSTMENT",
    adjustment: { memo: "Điều chỉnh chênh lệch tỷ giá", lines: [{ side: "DEBIT", account_code: "6311.01", amount: visaSmall.diff }, { side: "CREDIT", account_code: "1131.03", amount: visaSmall.diff }] } });

  // ---- Vòng 2 (30 giờ trước): Visa lệch tỷ giá lớn hơn, Visa không có đối ứng 86,4 triệu, lô Mastercard khớp đủ ----
  round(30, () => {
    const t = at(31);
    svc.ingestFile({ source: "CBS", format: "CSV", file_name: "CBS_GL_20261125_01.csv", content: csv([
      { reference_no: "FT2611093321", amount: "48250000.00", currency: "VND", direction: "DEBIT", txn_at: iso(t), account_no: "190366882025", counterparty_account: "4111111111111234", channel: "VISA" },
      { reference_no: "FT2611094410", amount: "86400000.00", currency: "VND", direction: "DEBIT", txn_at: iso(t + 5 * 60_000), account_no: "190344556677", counterparty_account: "4111111111117788", channel: "VISA" },
      { reference_no: "BATCH-MC-1119", amount: "12382000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t + 10 * 60_000), account_no: "GL 1131.02", batch_id: "BATCH-MC-1119", channel: "MASTERCARD" },
    ]) });
    svc.ingestFile({ source: "VISA", format: "TC33", file_name: "VISA_TC33_20261125.csv", expected_at: at(34), content: csv([
      { reference_no: "VS-883102", amount: "47864000.00", currency: "VND", direction: "DEBIT", txn_at: iso(t + 16 * H), account_no: "4111 •••• 1234" },
    ]) });
    svc.ingestFile({ source: "MASTERCARD", format: "IPM", file_name: "MC_IPM_20261125.csv", content: csv([
      { reference_no: "IPM-77801", amount: "7382000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t + 17 * H), batch_id: "BATCH-MC-1119" },
      { reference_no: "IPM-77802", amount: "5000000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t + 17 * H), batch_id: "BATCH-MC-1119" },
    ]) });
  });
  const visaBig = svc.exceptions({ status: "open" }).find((c) => c.internal?.reference_no === "FT2611093321")!;
  const visaMissing = svc.exceptions({ status: "open" }).find((c) => c.internal?.reference_no === "FT2611094410")!;
  clock.set(at(29));
  svc.claim(S("u-nam"), visaBig.case_id);
  // Nam hạch toán treo 86,4 triệu từ quy tắc MR-002 (Quân tạo) → chờ Checker; Quân bị chặn RULE-REC-05, Trang duyệt được
  svc.claim(S("u-nam"), visaMissing.case_id);
  svc.resolve(S("u-nam"), visaMissing.case_id, { root_cause: { code: "LATE_PARTNER_DATA", override: false }, type: "ADJUSTMENT",
    adjustment: { memo: "Treo chờ Visa settlement T+1", lines: [{ side: "DEBIT", account_code: "1131.01", amount: "86400000.00" }, { side: "CREDIT", account_code: "4211.01", amount: "86400000.00" }] } });

  // ---- Vòng 3 (6 giờ trước): lô Mastercard thiếu phí, giao dịch NAPAS bấm 2 lần ----
  round(6, () => {
    const t = at(7);
    svc.ingestFile({ source: "CBS", format: "CSV", file_name: "CBS_GL_20261126_01.csv", content: csv([
      { reference_no: "BATCH-MC-1120", amount: "12400000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t), account_no: "GL 1131.02", batch_id: "BATCH-MC-1120", channel: "MASTERCARD" },
      { reference_no: "FT2611095510", amount: "3500000.00", currency: "VND", direction: "DEBIT", txn_at: iso(t + 60_000), account_no: "190311223344", channel: "NAPAS" },
      { reference_no: "FT2611095511", amount: "3500000.00", currency: "VND", direction: "DEBIT", txn_at: iso(t + 3 * 60_000), account_no: "190311223344", channel: "NAPAS" },
    ]) });
    svc.ingestFile({ source: "MASTERCARD", format: "IPM", file_name: "MC_IPM_20261126.csv", content: csv([
      { reference_no: "IPM-77812", amount: "9382000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t + 5 * H), batch_id: "BATCH-MC-1120" },
      { reference_no: "IPM-77813", amount: "3000000.00", currency: "VND", direction: "CREDIT", txn_at: iso(t + 5 * H), batch_id: "BATCH-MC-1120" },
    ]) });
    svc.ingestFile({ source: "NAPAS", format: "CAMT054", file_name: "NAPAS_camt054_20261126.xml", content: camt054([
      { reference_no: "FT2611095510", amount: "3500000.00", direction: "DEBIT", txn_at: iso(t + 60_000), account_no: "190311223344" },
      { reference_no: "NP-5510-DUP", amount: "3500000.00", direction: "DEBIT", txn_at: iso(t + 4 * 60_000), account_no: "190311223344" },
    ]) });
  });

  // ---- File ví điện tử lỗi định dạng → cách ly (UAT-REC-02) ----
  clock.set(at(1));
  svc.ingestFile({ source: "WALLET", format: "JSON", file_name: "WALLET_20261126_0912.json", content: JSON.stringify([
    { reference_no: "WL-1001", amount: "250000.00", currency: "VND", direction: "CREDIT", txn_at: iso(at(2)) },
    { reference_no: "WL-1002", amount: "12,5O0", currency: "VND", direction: "CREDIT", txn_at: iso(at(2)) },
  ]) });

  // Đồng hồ về hiện tại rồi chạy job: ngoại lệ NAPAS 125 triệu quá 72 giờ → tự leo thang (RULE-REC-06)
  clock.fixed = saved.fixed;
  clock.offsetMs = saved.offsetMs;
  svc.escalateOverdue();
}

export function seedIfEmpty(svc: RecService) {
  if (svc.db.get("SELECT 1 FROM staff LIMIT 1")) return false;
  seed(svc);
  return true;
}
