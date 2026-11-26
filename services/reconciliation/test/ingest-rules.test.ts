/* Nạp file (TC-REC-B01, B02, REQ-REC-13, 14) và quy tắc (REQ-REC-09, 12, SoD-3, UAT-REC-08) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, who, code, csv } from "./helpers.ts";

const camt = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><Stmt>
<Ntry><Amt Ccy="VND">1250000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-11-25</Dt></BookgDt><ValDt><Dt>2026-11-25</Dt></ValDt><AcctSvcrRef>NP 0001</AcctSvcrRef></Ntry>
<Ntry><Amt Ccy="VND">300000</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><DtTm>2026-11-25T10:00:00+07:00</DtTm></BookgDt><Refs><EndToEndId>E2E-77</EndToEndId></Refs></Ntry>
</Stmt></BkToCstmrStmt></Document>`;

test("TC-REC-B01: camt.053 hợp lệ → giao dịch chuẩn hoá đủ trường, dq_status VALID", () => {
  const svc = setup(false);
  const r = svc.ingestFile({ source: "NAPAS", format: "CAMT053", file_name: "napas.xml", content: camt });
  assert.equal(r.status, "LOADED");
  assert.equal(r.loaded, 2);
  const rows = svc.db.all("SELECT * FROM source_transactions WHERE file_id = ? ORDER BY reference_no", r.file_id);
  assert.deepEqual(rows.map((t) => [t.reference_no, t.amount_minor, t.direction, t.dq_status, t.side]), [
    ["E2E-77", 300_000_00, "DEBIT", "VALID", "EXTERNAL"],
    ["NP0001", 1_250_000_00, "CREDIT", "VALID", "EXTERNAL"],
  ]);
  assert.equal(rows[1].value_date, "2026-11-25");
});

test("TC-REC-B02: nạp cùng file 2 lần → lần 2 không tạo bản ghi, ghi số bản ghi trùng", () => {
  const svc = setup(false);
  const content = csv([{ reference_no: "FT1", amount: "100.00", currency: "VND", direction: "CREDIT", txn_at: "2026-11-25T01:00:00Z" }]);
  svc.ingestFile({ source: "CBS", format: "CSV", file_name: "a.csv", content });
  const again = svc.ingestFile({ source: "CBS", format: "CSV", file_name: "a-copy.csv", content });
  assert.equal(again.status, "DUPLICATE_FILE");
  assert.equal(again.duplicate_count, 1);
  assert.equal(svc.db.get("SELECT count(*) n FROM source_transactions")!.n, 1);
  assert.equal(svc.db.get("SELECT count(*) n FROM audit_event WHERE action = 'FILE_DUPLICATE'")!.n, 1);
});

test("REQ-REC-14: file khác checksum nhưng có bản ghi trùng khoá nghiệp vụ → bỏ bản ghi trùng, đếm duplicate_count", () => {
  const svc = setup(false);
  const row = { reference_no: "FT1", amount: "100.00", currency: "VND", direction: "CREDIT", txn_at: "2026-11-25T01:00:00Z" };
  svc.ingestFile({ source: "CBS", format: "CSV", file_name: "a.csv", content: csv([row]) });
  const r = svc.ingestFile({ source: "CBS", format: "CSV", file_name: "b.csv", content: csv([row, { ...row, reference_no: "FT2" }]) });
  assert.equal(r.loaded, 1);
  assert.equal(r.duplicate_count, 1);
});

test("TC-REC-B02 / UAT-REC-02: file sai định dạng → QUARANTINED cả lô, có lý do, phát rec.file.quarantined", () => {
  const svc = setup(false);
  const r = svc.ingestFile({ source: "WALLET", format: "JSON", file_name: "w.json", content: JSON.stringify([
    { reference_no: "W1", amount: "10.00", txn_at: "2026-11-25T01:00:00Z" }, { reference_no: "W2", amount: "12,5O0", txn_at: "2026-11-25T01:00:00Z" }]) });
  assert.equal(r.status, "QUARANTINED");
  assert.match(String((r as { reason?: string }).reason), /Dòng 2: sai định dạng trường amount/);
  assert.equal(svc.db.get("SELECT count(*) n FROM source_transactions")!.n, 0, "không nạp nửa lô");
  assert.equal(svc.db.get("SELECT type FROM events ORDER BY id DESC LIMIT 1")!.type, "rec.file.quarantined");
  assert.equal(svc.sources().find((s) => s.source === "WALLET")!.status, "QUARANTINED");
  const bad = svc.ingestFile({ source: "WALLET", format: "JSON", file_name: "x.json", content: "{not json" });
  assert.equal(bad.status, "QUARANTINED");
});

test("REQ-REC-13: chỉ REC_LEAD nạp lại lô cách ly; lô cũ RELOADED, nguồn hết cách ly", () => {
  const svc = setup(false);
  const q = svc.ingestFile({ source: "WALLET", format: "JSON", file_name: "w.json", content: '[{"reference_no":"W1","amount":"x","txn_at":"2026-11-25T01:00:00Z"}]' });
  const good = '[{"reference_no":"W1","amount":"10.00","txn_at":"2026-11-25T01:00:00Z"}]';
  assert.throws(() => svc.reloadFile(who(svc, "u-nam"), q.file_id, { content: good }), code("FORBIDDEN"));
  const r = svc.reloadFile(who(svc, "u-quan"), q.file_id, { content: good });
  assert.equal(r.status, "RELOADED");
  assert.equal(svc.sources().find((s) => s.source === "WALLET")!.status, "ON_SCHEDULE");
  assert.throws(() => svc.reloadFile(who(svc, "u-quan"), q.file_id, { content: good }), code("FILE_NOT_QUARANTINED"));
});

test("PCI DSS: số thẻ đầy đủ trong file được che trước khi lưu", () => {
  const svc = setup(false);
  svc.ingestFile({ source: "CBS", format: "CSV", file_name: "c.csv", content: csv([{ reference_no: "FT1", amount: "1.00", txn_at: "2026-11-25T01:00:00Z", counterparty_account: "4111111111111234" }]) });
  assert.equal(svc.db.get("SELECT counterparty_account c FROM source_transactions")!.c, "4111 •••• 1234");
});

test("Nguồn trễ hơn lịch > 30 phút → DELAYED (UAT-REC-09)", () => {
  const svc = setup();
  const visa = svc.sources().find((s) => s.source === "VISA")!;
  assert.equal(visa.status, "DELAYED");
  assert.ok(visa.delay_minutes >= 200);
  assert.ok(visa.last_updated_at);
});

/* ---------- Quy tắc ---------- */

test("Tạo quy tắc: kiểm tên ≥ 4 ký tự, khoá hợp lệ, dung sai chỉ cho FUZZY, giới hạn tham số", () => {
  const svc = setup();
  const nam = who(svc, "u-nam");
  assert.throws(() => svc.createRule(nam, { name: "ab", type: "EXACT", source_pair: "CBS↔NAPAS", match_keys: ["REF"] }), code("VALIDATION"));
  assert.throws(() => svc.createRule(nam, { name: "Quy tắc A", type: "EXACT", source_pair: "CBS↔NAPAS", match_keys: [] }), code("VALIDATION"));
  assert.throws(() => svc.createRule(nam, { name: "Quy tắc A", type: "EXACT", source_pair: "CBS↔NAPAS", match_keys: ["REF"], amount_tolerance_pct: 1 }), code("VALIDATION"));
  assert.throws(() => svc.createRule(nam, { name: "Quy tắc A", type: "FUZZY", source_pair: "CBS↔NAPAS", match_keys: ["REF"], fuzzy_threshold: 0.5 }), code("OUT_OF_RANGE"));
  const r = svc.createRule(nam, { name: "Quy tắc A", type: "EXACT", source_pair: "CBS<->NAPAS", match_keys: ["ref", "amount"] });
  assert.equal(r.rule_id, "MR-006");
  assert.equal(r.status, "DRAFT");
  assert.deepEqual(r.match_keys, ["REF", "AMOUNT", "CURRENCY"], "EXACT tự thêm CURRENCY (R03 §4)");
  assert.throws(() => svc.createRule(who(svc, "u-ha"), { name: "Quy tắc B", type: "EXACT", source_pair: "CBS↔NAPAS", match_keys: ["REF"] }), code("FORBIDDEN"));
});

test("UAT-REC-08 / SoD-3: không chọn mình làm Checker, không tự duyệt; Checker khác duyệt được", () => {
  const svc = setup();
  const nam = who(svc, "u-nam"), trang = who(svc, "u-trang");
  const r = svc.createRule(nam, { name: "Hoàn tiền Visa", type: "EXACT", source_pair: "CBS↔VISA", match_keys: ["REF", "AMOUNT"] });
  assert.throws(() => svc.submitRule(nam, r.rule_id, { checker_id: "u-nam" }), code("RULE_SELF_APPROVAL"));
  assert.throws(() => svc.submitRule(trang, r.rule_id, { checker_id: "u-quan" }), code("FORBIDDEN"), "chỉ người tạo gửi duyệt");
  assert.throws(() => svc.submitRule(nam, r.rule_id, { checker_id: "u-nam" }));
  svc.submitRule(nam, r.rule_id, { checker_id: "u-trang" });
  assert.throws(() => svc.decideRule(nam, r.rule_id, true), code("FORBIDDEN"), "REC_OFFICER không có quyền duyệt");
  const out = svc.decideRule(trang, r.rule_id, true);
  assert.equal(out.versions[0].status, "ACTIVE");
  assert.equal(out.versions[0].approved_by, "u-trang");
  assert.ok(svc.db.get("SELECT 1 FROM audit_event WHERE action = 'SOD_BLOCKED' AND object_id = ?", r.rule_id), "lần bị chặn có audit");
});

test("Người tạo quy tắc (Trang, MR-005) không tự duyệt được dù có vai trò Checker", () => {
  const svc = setup();
  const trang = who(svc, "u-trang");
  svc.submitRule(trang, "MR-005", { checker_id: "u-quan" });
  assert.throws(() => svc.decideRule(trang, "MR-005", true), code("RULE_SELF_APPROVAL"));
  assert.equal(svc.decideRule(who(svc, "u-quan"), "MR-005", true).versions[0].status, "ACTIVE");
});

test("REQ-REC-09: sửa MR-001 v7 → v8 DRAFT/PENDING, v7 vẫn ACTIVE; duyệt v8 → v7 RETIRED", () => {
  const svc = setup();
  const quan = who(svc, "u-quan");
  const v8 = svc.newRuleVersion(quan, "MR-001", { name: "CBS ↔ NAPAS · khớp tuyệt đối v8" });
  assert.equal(v8.version, 8);
  assert.throws(() => svc.newRuleVersion(quan, "MR-001", {}), code("INVALID_STATE"), "chỉ một version đang soạn");
  svc.submitRule(quan, "MR-001", { version: 8, checker_id: "u-trang" });
  const mid = svc.rule("MR-001").versions;
  assert.deepEqual(mid.slice(0, 2).map((v) => [v.version, v.status]), [[8, "PENDING"], [7, "ACTIVE"]]);
  assert.equal(svc.rules().find((r) => r.rule_id === "MR-001")!.active_version, 7);
  svc.decideRule(who(svc, "u-trang"), "MR-001", true);
  const after = svc.rule("MR-001").versions;
  assert.deepEqual(after.slice(0, 2).map((v) => [v.version, v.status]), [[8, "ACTIVE"], [7, "RETIRED"]]);
});

test("Trả lại quy tắc bắt buộc lý do ≥ 10 ký tự, về DRAFT", () => {
  const svc = setup();
  assert.throws(() => svc.decideRule(who(svc, "u-trang"), "MR-004", false, "ngắn"), code("NOTE_TOO_SHORT"));
  const r = svc.decideRule(who(svc, "u-trang"), "MR-004", false, "Thiếu khoá DATE cho ví điện tử");
  assert.equal(r.versions[0].status, "DRAFT");
  assert.equal(r.versions[0].reject_reason, "Thiếu khoá DATE cho ví điện tử");
});

test("Ngừng dùng quy tắc phải qua duyệt; sao chép tạo quy tắc mới do người gọi tạo (REQ-REC-12)", () => {
  const svc = setup();
  const nam = who(svc, "u-nam");
  const req = svc.retireRule(nam, "MR-003", { checker_id: "u-trang", reason: "Mastercard đổi sang lô theo giờ" });
  assert.equal(req.change_kind, "RETIRE");
  assert.equal(svc.rule("MR-003").versions.find((v) => v.version === 2)!.status, "ACTIVE", "vẫn chạy tới khi duyệt");
  svc.decideRule(who(svc, "u-trang"), "MR-003", true);
  assert.ok(svc.rule("MR-003").versions.every((v) => v.status === "RETIRED"));
  const copy = svc.copyRule(nam, "MR-002");
  assert.equal(copy.status, "DRAFT");
  assert.equal(copy.created_by, "u-nam");
  assert.match(copy.name, /bản sao/);
});
