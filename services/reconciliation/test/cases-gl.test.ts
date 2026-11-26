/* Ngoại lệ (REQ-REC-01 → 03, 08) và bút toán Maker-Checker (TC-REC-B06, B07, REQ-REC-05 → 07, 10, 11) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, H } from "../src/db.ts";
import { setup, who, code, caseByRef, lines } from "./helpers.ts";

test("Seed đi qua luồng thật: 6 ngoại lệ đúng loại, trạng thái và quy tắc sinh ra", () => {
  const svc = setup();
  const got = svc.exceptions({ status: "all" }).map((c) => [c.kind, c.status, c.rule_id]);
  assert.deepEqual(got, [
    ["PARTIAL", "RESOLVED", "MR-002"], ["UNMATCHED", "ESCALATED", "MR-001"], ["PARTIAL", "IN_PROGRESS", "MR-002"],
    ["UNMATCHED", "PENDING_POSTING", "MR-002"], ["PARTIAL", "OPEN", "MR-003"], ["DUPLICATE", "OPEN", "MR-001"],
  ]);
  assert.equal(svc.exceptions({}).length, 5, "open gồm cả PENDING_POSTING, không gồm RESOLVED (TC-REC-21)");
});

test("Che số tài khoản; xem đầy đủ chỉ REC_LEAD / FIN_VIEWER và có audit VIEW_ACCOUNT", () => {
  const svc = setup();
  const c = caseByRef(svc, "FT2611093321");
  assert.equal(svc.exception(who(svc, "u-nam"), c.case_id).internal!.account, "1903 •••• 2025");
  assert.throws(() => svc.exception(who(svc, "u-nam"), c.case_id, true), code("FORBIDDEN"));
  assert.equal(svc.exception(who(svc, "u-ha"), c.case_id, true).internal!.account, "190366882025");
  assert.ok(svc.db.get("SELECT 1 FROM audit_event WHERE action = 'VIEW_ACCOUNT' AND actor_id = 'u-ha'"));
});

test("Nhận xử lý: một người giữ; người khác nhận → ALREADY_CLAIMED kèm tên", () => {
  const svc = setup();
  const c = caseByRef(svc, "BATCH-MC-1120");
  assert.equal(svc.claim(who(svc, "u-nam"), c.case_id).status, "IN_PROGRESS");
  assert.throws(() => svc.claim(who(svc, "u-trang"), c.case_id), (e: any) => e.code === "ALREADY_CLAIMED" && e.extra.owner_name === "Lê Hoàng Nam");
  assert.throws(() => svc.release(who(svc, "u-trang"), c.case_id), code("NOT_ASSIGNEE"));
  assert.equal(svc.release(who(svc, "u-quan"), c.case_id).status, "OPEN", "trưởng nhóm nhả hộ được");
});

test("Chưa nhận thì không xử lý được (NOT_ASSIGNEE)", () => {
  const svc = setup();
  const c = caseByRef(svc, "BATCH-MC-1120");
  assert.throws(() => svc.resolve(who(svc, "u-nam"), c.case_id, { root_cause: { code: "UNBOOKED_FEE" }, type: "REQUEST_DOCS", docs_request_note: "Gửi IPM bổ sung" }), code("NOT_ASSIGNEE"));
});

test("REQ-REC-01: nguyên nhân ngoài top-3 phải override + ghi chú ≥ 10 ký tự, lưu cờ và audit", () => {
  const svc = setup();
  const nam = who(svc, "u-nam");
  const c = caseByRef(svc, "BATCH-MC-1120");
  svc.claim(nam, c.case_id);
  const base = { type: "REQUEST_DOCS", docs_request_note: "Đề nghị Mastercard gửi lại file IPM đầy đủ" };
  assert.throws(() => svc.resolve(nam, c.case_id, { ...base, root_cause: { code: "FX_DIFF", override: false } }), code("UNKNOWN_CAUSE"));
  assert.throws(() => svc.resolve(nam, c.case_id, { ...base, root_cause: { code: "BOGUS", override: true, note: "Không có trong danh mục" } }), code("UNKNOWN_CAUSE"));
  assert.throws(() => svc.resolve(nam, c.case_id, { ...base, root_cause: { code: "WRONG_REFERENCE", override: true, note: "ngắn" } }), code("NOTE_TOO_SHORT"));
  const r = svc.resolve(nam, c.case_id, { ...base, root_cause: { code: "WRONG_REFERENCE", override: true, note: "Mã lô IPM ghi sai số cuối" } });
  assert.equal(r.case.resolution!.override, true);
  assert.equal(r.case.status, "IN_PROGRESS");
  assert.equal(r.case.waiting_docs, base.docs_request_note);
  assert.ok(svc.db.get("SELECT 1 FROM audit_event WHERE action = 'ROOT_CAUSE_OVERRIDE'"));
});

test("REQ-REC-02: khớp thủ công ngoại lệ DUPLICATE với giao dịch đối ứng, không sinh bút toán", () => {
  const svc = setup();
  const nam = who(svc, "u-nam");
  const c = caseByRef(svc, "FT2611095511");
  svc.claim(nam, c.case_id);
  const before = svc.entries({}).length;
  assert.throws(() => svc.resolve(nam, c.case_id, { root_cause: { code: "DUPLICATE_TXN" }, type: "MANUAL_MATCH", manual_match_txn_id: "FT2611095510" }), code("VALIDATION"), "không khớp với giao dịch nội bộ");
  const r = svc.resolve(nam, c.case_id, { root_cause: { code: "DUPLICATE_TXN" }, type: "MANUAL_MATCH", manual_match_txn_id: "NP-5510-DUP" });
  assert.equal(r.case.status, "RESOLVED");
  assert.equal(r.case.resolution!.manual_match_ref, "NP-5510-DUP");
  assert.equal(svc.entries({}).length, before);
  const l = svc.lineage({ case_id: c.case_id });
  assert.equal(l.chain[1].status, "MATCHED_MANUAL");
  assert.equal(l.chain[3].note, "Không cần hạch toán");
  assert.ok(l.integrity.ok);
});

test("RULE-REC-04: điều chỉnh ≤ 50 triệu tự hạch toán (zero-touch) và đóng ngoại lệ", () => {
  const svc = setup();
  const nam = who(svc, "u-nam");
  const c = caseByRef(svc, "FT2611093321"); // Nam đang giữ, chênh 386.000
  const r = svc.resolve(nam, c.case_id, { root_cause: { code: "FX_DIFF" }, type: "ADJUSTMENT", adjustment: { memo: "Điều chỉnh chênh lệch tỷ giá", lines: lines("386000.00", "6311.01", "1131.03") } });
  assert.equal(r.entry!.mode, "ZERO_TOUCH");
  assert.equal(r.entry!.status, "POSTED");
  assert.equal(r.case.status, "RESOLVED");
  assert.ok(r.case.closed_at);
});

test("TC-REC-B06: Nợ ≠ Có bị từ chối; mã tài khoản và số tiền được kiểm", () => {
  const svc = setup();
  const nam = who(svc, "u-nam");
  const c = caseByRef(svc, "FT2611093321");
  const bad = (l: unknown) => svc.resolve(nam, c.case_id, { root_cause: { code: "FX_DIFF" }, type: "ADJUSTMENT", adjustment: { memo: "Điều chỉnh", lines: l } });
  assert.throws(() => bad([{ side: "DEBIT", account_code: "6311.01", amount: "386000.00" }, { side: "CREDIT", account_code: "1131.03", amount: "385000.00" }]), code("UNBALANCED_ENTRY"));
  assert.throws(() => bad([{ side: "DEBIT", account_code: "6311.01", amount: "386000.00" }]), code("UNBALANCED_ENTRY"));
  assert.throws(() => bad(lines("386000.00", "ABC", "1131.03")), code("VALIDATION"));
  assert.throws(() => bad(lines("-1", "6311.01", "1131.03")), code("VALIDATION"));
  assert.throws(() => bad(lines("1.234", "6311.01", "1131.03")), code("VALIDATION"), "tối đa 2 chữ số lẻ");
  assert.equal(caseByRef(svc, "FT2611093321").status, "IN_PROGRESS", "lỗi không làm đổi trạng thái");
});

test("TC-REC-B06: bút toán đã POSTED không UPDATE / DELETE được ở tầng DB", () => {
  const svc = setup();
  const posted = svc.entries({ status: "POSTED" })[0];
  assert.throws(() => svc.db.run("UPDATE gl_entries SET amount_minor = 1 WHERE entry_id = ?", posted.entry_id), /immutable/);
  assert.throws(() => svc.db.run("UPDATE gl_lines SET amount_minor = 1 WHERE entry_id = ?", posted.entry_id), /immutable/);
  assert.throws(() => svc.db.run("DELETE FROM gl_entries WHERE entry_id = ?", posted.entry_id), /cannot be deleted/);
  assert.throws(() => svc.db.run("UPDATE audit_event SET action = 'X'"), /append-only/);
  assert.throws(() => svc.db.run("DELETE FROM match_results"), /immutable/);
});

test("REQ-REC-08: ngoại lệ đã có bút toán chờ duyệt → không tạo bút toán thứ hai (ADJUSTMENT_PENDING)", () => {
  const svc = setup();
  const c = caseByRef(svc, "FT2611094410");
  assert.equal(c.status, "PENDING_POSTING");
  assert.throws(() => svc.resolve(who(svc, "u-nam"), c.case_id, { root_cause: { code: "LATE_PARTNER_DATA" }, type: "ADJUSTMENT", adjustment: { memo: "Lần hai", lines: lines("1.00") } }),
    (e: any) => e.code === "ADJUSTMENT_PENDING" && e.extra.entry_id === c.pending_entry!.entry_id);
  // Chốt chặn cuối ở DB: unique index một phần
  assert.throws(() => svc.db.run(`INSERT INTO gl_entries(entry_id, case_id, amount_minor, currency, memo, mode, status, maker_id, business_date, created_at)
    VALUES('GL-X', ?, 100, 'VND', 'x', 'MAKER_CHECKER', 'PENDING', 'u-nam', '2026-11-26', 0)`, c.case_id), /UNIQUE/);
});

test("SoD-1: Maker không duyệt / trả về / từ chối bút toán của mình; REC_OFFICER không có quyền duyệt", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0]; // Nam tạo, 86,4 triệu
  assert.throws(() => svc.approveEntry(who(svc, "u-nam"), g.entry_id), code("FORBIDDEN"));
  // Cho Nam lên Checker để chứng minh SoD-1 độc lập với vai trò
  svc.db.run("UPDATE staff SET role = 'REC_CHECKER' WHERE id = 'u-nam'");
  assert.throws(() => svc.approveEntry(who(svc, "u-nam"), g.entry_id), code("SOD_MAKER_SAME"));
  assert.throws(() => svc.returnOrReject(who(svc, "u-nam"), g.entry_id, "reject", "Tự từ chối bút toán của mình"), code("SOD_MAKER_SAME"));
  assert.equal(svc.db.get("SELECT count(*) n FROM audit_event WHERE action = 'SOD_BLOCKED' AND object_id = ?", g.entry_id)!.n, 2);
});

test("TC-REC-B07 / REQ-REC-07: người tạo quy tắc MR-002 (Quân) không duyệt điều chỉnh > ngưỡng sinh từ MR-002; Trang duyệt được", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0];
  assert.equal(g.source_rule_id, "MR-002");
  assert.equal(g.rule_created_by, "u-quan");
  assert.throws(() => svc.approveEntry(who(svc, "u-quan"), g.entry_id), (e: any) => e.code === "SOD_RULE_CREATOR" && /RULE-REC-05/.test(e.message));
  const ok = svc.approveEntry(who(svc, "u-trang"), g.entry_id);
  assert.equal(ok.status, "POSTED");
  assert.equal(ok.checker_id, "u-trang");
  assert.equal(caseByRef(svc, "FT2611094410").status, "RESOLVED", "ngoại lệ đóng khi bút toán POSTED (DEF-REC-06)");
  assert.throws(() => svc.approveEntry(who(svc, "u-quan"), g.entry_id), code("ENTRY_IMMUTABLE"));
});

test("Người sửa gần nhất của quy tắc cũng bị chặn SoD-2", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0];
  svc.db.run("UPDATE matching_rules SET created_by = 'u-ha', updated_by = 'u-trang' WHERE rule_id = 'MR-002' AND version = 4");
  assert.throws(() => svc.approveEntry(who(svc, "u-trang"), g.entry_id), code("SOD_RULE_CREATOR"));
});

test("REQ-REC-05/06: trả về kèm ghi chú → RETURNED, ngoại lệ mở lại; chỉ Maker trình lại, giữ mã, tăng số lần", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0];
  const trang = who(svc, "u-trang"), nam = who(svc, "u-nam");
  assert.throws(() => svc.returnOrReject(trang, g.entry_id, "return", "ngắn"), code("NOTE_TOO_SHORT"));
  const back = svc.returnOrReject(trang, g.entry_id, "return", "Bổ sung chứng từ Visa đính kèm");
  assert.equal(back.status, "RETURNED");
  assert.equal(caseByRef(svc, "FT2611094410").status, "IN_PROGRESS");
  assert.throws(() => svc.resubmitEntry(trang, g.entry_id, {}), code("NOT_MAKER"));
  assert.throws(() => svc.resubmitEntry(nam, g.entry_id, { lines: lines("1.00", "1131.01", "4211.01").map((l, i) => (i ? { ...l, amount: "2.00" } : l)) }), code("UNBALANCED_ENTRY"));
  const again = svc.resubmitEntry(nam, g.entry_id, { memo: "Treo chờ Visa – có chứng từ", lines: lines("86400000.00") });
  assert.equal(again.entry_id, g.entry_id);
  assert.equal(again.status, "PENDING");
  assert.equal(again.submit_count, 2);
  assert.equal(caseByRef(svc, "FT2611094410").status, "PENDING_POSTING");
  assert.deepEqual(svc.entry(g.entry_id).history.map((h) => h.action), ["CREATED", "RETURNED", "RESUBMITTED"]);
});

test("Hạ số tiền khi trình lại không né Maker-Checker", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0];
  svc.returnOrReject(who(svc, "u-trang"), g.entry_id, "return", "Số tiền cần tách nhỏ hơn");
  const r = svc.resubmitEntry(who(svc, "u-nam"), g.entry_id, { lines: lines("1000.00") });
  assert.equal(r.mode, "MAKER_CHECKER");
  assert.equal(r.status, "PENDING");
});

test("Từ chối kèm lý do → REJECTED, ngoại lệ mở lại, được tạo bút toán điều chỉnh mới", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0];
  svc.returnOrReject(who(svc, "u-trang"), g.entry_id, "reject", "Sai tài khoản treo, phải dùng 1131.04");
  const c = caseByRef(svc, "FT2611094410");
  assert.equal(c.status, "IN_PROGRESS");
  const r = svc.resolve(who(svc, "u-nam"), c.case_id, { root_cause: { code: "LATE_PARTNER_DATA" }, type: "ADJUSTMENT", adjustment: { memo: "Treo đúng tài khoản", lines: lines("86400000.00", "1131.04") } });
  assert.notEqual(r.entry!.entry_id, g.entry_id);
  assert.equal(r.case.status, "PENDING_POSTING");
});

test("REQ-REC-10: chuyển cấp bút toán → ESCALATED, chỉ REC_LEAD xử lý tiếp", () => {
  const svc = setup();
  const g = svc.entries({ status: "PENDING" })[0];
  svc.escalateEntry(who(svc, "u-trang"), g.entry_id, { to: "HIGHER_APPROVER", reason: "Vượt hạn mức phê duyệt của tôi" });
  assert.throws(() => svc.approveEntry(who(svc, "u-trang"), g.entry_id), code("INVALID_STATE"));
  // Quân là người tạo MR-002 → vẫn bị SoD-2 dù là trưởng nhóm
  assert.throws(() => svc.approveEntry(who(svc, "u-quan"), g.entry_id), code("SOD_RULE_CREATOR"));
});

test("REQ-REC-11: đảo bút toán POSTED bằng bút toán mới, dòng đảo chiều; không đảo hai lần", () => {
  const svc = setup();
  const posted = svc.entries({ status: "POSTED" }).find((g) => g.case_id)!;
  assert.throws(() => svc.reverseEntry(who(svc, "u-trang"), posted.entry_id, "Hạch toán nhầm kỳ"), code("FORBIDDEN"));
  const rev = svc.reverseEntry(who(svc, "u-quan"), posted.entry_id, "Hạch toán nhầm tài khoản");
  assert.equal(rev.reversal_of, posted.entry_id);
  assert.deepEqual(rev.lines.map((l) => l.side), posted.lines.map((l) => (l.side === "DEBIT" ? "CREDIT" : "DEBIT")));
  assert.throws(() => svc.reverseEntry(who(svc, "u-quan"), posted.entry_id, "Đảo lần nữa cho chắc"), code("INVALID_STATE"));
  assert.equal(svc.entry(posted.entry_id).status, "POSTED", "bút toán gốc không bị sửa");
});

test("RULE-REC-06: job tự leo thang ngoại lệ quá hạn, nhả người giữ; PENDING_POSTING không leo thang", () => {
  const svc = setup();
  clock.advance(80 * H);
  const n = svc.escalateOverdue();
  assert.ok(n >= 3);
  const big = caseByRef(svc, "FT2611093321");
  assert.equal(big.status, "ESCALATED");
  assert.equal(big.owner_id, null);
  assert.match(big.escalation_reason!, /RULE-REC-06/);
  assert.equal(caseByRef(svc, "FT2611094410").status, "PENDING_POSTING");
  // Ngoại lệ leo thang chỉ trưởng nhóm nhận và xử lý
  assert.throws(() => svc.claim(who(svc, "u-nam"), big.case_id), code("FORBIDDEN"));
  svc.claim(who(svc, "u-quan"), big.case_id);
  const r = svc.resolve(who(svc, "u-quan"), big.case_id, { root_cause: { code: "FX_DIFF" }, type: "ADJUSTMENT", adjustment: { memo: "Điều chỉnh tỷ giá", lines: lines("386000.00", "6311.01", "1131.03") } });
  assert.equal(r.case.status, "RESOLVED");
});

test("Leo thang bằng tay cần lý do ≥ 10 ký tự", () => {
  const svc = setup();
  const c = caseByRef(svc, "FT2611093321");
  assert.throws(() => svc.escalate(who(svc, "u-nam"), c.case_id, "gấp"), code("NOTE_TOO_SHORT"));
  assert.equal(svc.escalate(who(svc, "u-nam"), c.case_id, "Cần Visa xác nhận tỷ giá áp dụng").status, "ESCALATED");
  assert.equal(svc.db.get("SELECT type FROM events ORDER BY id DESC LIMIT 1")!.type, "rec.exception.escalated");
});
