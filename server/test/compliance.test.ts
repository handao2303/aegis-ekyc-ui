/* UAT-EKYC phía Compliance: hàng đợi, bổ sung, SLA, Maker-Checker, audit, cấu hình */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, run, staff } from "./helpers.ts";
import { clock, H, D } from "../src/db.ts";
import { runJobs } from "../src/jobs.ts";

test("Hàng đợi mẫu: thứ tự Đã bổ sung → Sắp/Quá SLA → còn lại", () => {
  const svc = setup();
  const q = svc.listCases(staff(svc, "u-anh"));
  assert.equal(q.items[0].status, "REFER_RESUBMITTED");
  const ranks = q.items.map((i) => (i.status === "REFER_RESUBMITTED" ? 0 : ["DUE_SOON", "BREACHED"].includes(i.sla.state) ? 1 : 2));
  assert.deepEqual(ranks, [...ranks].sort());
  assert.equal(q.stats!.checker, 1);
  assert.equal(q.stats!.breached, 1);
});

test("UAT-EKYC-08 · Compliance duyệt REFER → tạo tài khoản, decided_by đúng", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-03");
  const anh = staff(svc, "u-anh");
  await assert.rejects(async () => svc.makerDecision(s.session_id, anh, { decision: "APPROVE" }), /nhận xử lý/);
  svc.claim(s.session_id, anh);
  const r = svc.makerDecision(s.session_id, anh, { decision: "APPROVE", note: "Ảnh rõ, khớp chip" });
  assert.equal(r.status, "APPROVED");
  const d = svc.db.get("SELECT decided_by, maker_id, checker_id FROM kyc_decisions WHERE session_id = ?", s.session_id)!;
  assert.deepEqual({ ...d }, { decided_by: "u-anh", maker_id: "u-anh", checker_id: null });
  assert.match(svc.result(s.session_id).account_no!, /^1903/);
});

test("UAT-EKYC-09 · người ngoài Compliance (CS) không xem được sàng lọc, không xử lý được", async () => {
  const svc = setup();
  const cs = staff(svc, "u-trang");
  const q = svc.listCases(cs);
  assert.ok(q.items.every((i) => i.risk_score === null));
  const d = svc.caseDetail("EKS-2611-0039", cs);
  assert.equal(d.screening, null);
  assert.throws(() => svc.caseDetail("EKS-2611-0039", cs, { pii: true }), /không được xem/);
  assert.throws(() => svc.claim("EKS-2611-0039", cs), /CS không xử lý/);
});

test("C10 · xem chi tiết và PII đều được ghi audit", () => {
  const svc = setup();
  const anh = staff(svc, "u-anh");
  const masked = svc.caseDetail("EKS-2611-0050", anh);
  assert.equal(masked.document.ocr!.full_name, "B** N*** Á**");
  const full = svc.caseDetail("EKS-2611-0050", anh, { pii: true });
  assert.equal(full.document.ocr!.full_name, "BÙI NGỌC ÁNH");
  const actions = svc.db.all("SELECT action FROM audit_event WHERE session_id = 'EKS-2611-0050' AND actor_id = 'u-anh'").map((r) => r.action);
  assert.deepEqual(actions, ["CASE_VIEW", "VIEW_SENSITIVE", "VIEW_PII"]);
});

test("UAT-EKYC-16 · yêu cầu bổ sung → SLA tạm dừng → khách gửi lại lên đầu hàng đợi", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-03");
  const anh = staff(svc, "u-anh");
  svc.claim(s.session_id, anh);
  clock.advance(3 * H);
  assert.throws(() => svc.requestInfo(s.session_id, anh, { items: ["BACK_BLURRY_MRZ"], message: "Kết quả CIC chưa rõ" }), /không được nhắc/);
  assert.throws(() => svc.requestInfo(s.session_id, anh, { items: [] }), /ít nhất 1/);
  svc.requestInfo(s.session_id, anh, { items: ["BACK_BLURRY_MRZ"], message: "Ảnh mặt sau bị loá" });
  const r = svc.result(s.session_id);
  assert.equal(r.status, "PENDING_CUSTOMER_INFO");
  assert.deepEqual(r.info_request!.items, ["BACK_BLURRY_MRZ"]);
  assert.ok(svc.db.get("SELECT 1 FROM notifications WHERE session_id = ? AND template = 'EKYC_INFO_REQUESTED'", s.session_id));

  clock.advance(30 * H); // khách mất 30 giờ – không tính vào SLA
  assert.throws(() => svc.submitInfo(s.session_id, s.token, { items: [] }), /Còn thiếu/);
  svc.submitInfo(s.session_id, s.token, { items: ["BACK_BLURRY_MRZ"] });
  const q = svc.listCases(anh);
  const idx = q.items.findIndex((i) => i.id === s.session_id);
  assert.ok(q.items.slice(0, idx).every((i) => i.status === "REFER_RESUBMITTED"), "đứng trên mọi hồ sơ chưa bổ sung");
  assert.equal(q.items[idx].sla.elapsed_hours, 3, "chỉ tính 3 giờ trước khi tạm dừng");
  assert.equal(q.items[idx].sla.state, "ON_TRACK");
});

test("C07 #2 · tối đa 2 lần yêu cầu bổ sung", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-03");
  const anh = staff(svc, "u-anh");
  for (let i = 0; i < 2; i++) {
    svc.claim(s.session_id, anh);
    svc.requestInfo(s.session_id, anh, { items: ["FRONT_BLURRY"] });
    svc.submitInfo(s.session_id, s.token, { items: ["FRONT_BLURRY"] });
  }
  svc.claim(s.session_id, anh);
  assert.throws(() => svc.requestInfo(s.session_id, anh, { items: ["FRONT_BLURRY"] }), /tối đa 2 lần/);
});

test("C07 #3 · quá 5 ngày không bổ sung → REJECTED NO_RESPONSE, có nhắc trước 1 ngày", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-03");
  const anh = staff(svc, "u-anh");
  svc.claim(s.session_id, anh);
  svc.requestInfo(s.session_id, anh, { items: ["FRONT_BLURRY"] });
  clock.advance(4 * D + 1); runJobs(svc);
  assert.ok(svc.db.get("SELECT 1 FROM notifications WHERE session_id = ? AND template = 'EKYC_INFO_REMINDER'", s.session_id));
  clock.advance(D); runJobs(svc);
  const r = svc.result(s.session_id);
  assert.equal(r.status, "REJECTED");
  assert.equal(r.reason!.code, "NO_RESPONSE");
});

test("UAT-EKYC-18 · SLA: 16h sắp quá hạn, 20h leo thang, >24h Breach", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-02");
  const anh = staff(svc, "u-anh");
  const sla = () => svc.listCases(anh).items.find((i) => i.id === s.session_id)!.sla.state;
  clock.advance(16 * H); assert.equal(sla(), "DUE_SOON");
  clock.advance(4 * H); runJobs(svc);
  assert.ok(svc.db.get("SELECT 1 FROM notifications WHERE session_id = ? AND template = 'SLA_ESCALATION_LEAD'", s.session_id));
  clock.advance(5 * H); runJobs(svc);
  assert.equal(sla(), "BREACHED");
  assert.ok(svc.db.get("SELECT breached_at FROM sessions WHERE id = ?", s.session_id)!.breached_at);
});

test("RULE-EKYC-12 · một hồ sơ một người giữ, tự nhả sau 2 giờ", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-02");
  svc.claim(s.session_id, staff(svc, "u-anh"));
  assert.throws(() => svc.claim(s.session_id, staff(svc, "u-yen")), /người khác/);
  clock.advance(2 * H + 1);
  assert.equal(runJobs(svc)["claim-auto-release"] >= 1, true);
  assert.equal(svc.claim(s.session_id, staff(svc, "u-yen")).assignee!.id, "u-yen");
});

test("UAT-EKYC-19 · Maker-Checker hồ sơ PEP: Maker không tự duyệt, Checker khác mới tạo TK", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-04");
  const anh = staff(svc, "u-anh"), yen = staff(svc, "u-yen");
  svc.claim(s.session_id, anh);
  assert.equal(svc.makerDecision(s.session_id, anh, { decision: "APPROVE" }).status, "PENDING_CHECKER");
  assert.equal(svc.result(s.session_id).account_no, null, "chưa tạo tài khoản");
  assert.throws(() => svc.checkerDecision(s.session_id, anh, { decision: "APPROVE" }), (e: any) => e.code === "MAKER_CHECKER_SAME");
  assert.throws(() => svc.checkerDecision(s.session_id, yen, { decision: "RETURN" }), /cần lý do/);
  assert.equal(svc.checkerDecision(s.session_id, yen, { decision: "APPROVE" }).status, "APPROVED");
  const d = svc.db.get("SELECT maker_id, checker_id FROM kyc_decisions WHERE session_id = ?", s.session_id)!;
  assert.deepEqual({ ...d }, { maker_id: "u-anh", checker_id: "u-yen" });
});

test("C10 · Checker trả lại → về REFER cho Maker", async () => {
  const svc = setup();
  const anh = staff(svc, "u-anh");
  // Hồ sơ mẫu EKS-2611-0036 do Trần Hải Yến làm Maker
  const r = svc.checkerDecision("EKS-2611-0036", anh, { decision: "RETURN", reason: "Cần đối chiếu thêm nguồn thu nhập" });
  assert.equal(r.status, "REFER");
  assert.equal(r.assignee!.id, "u-yen");
});

test("C10 · Từ chối cần lý do nội bộ; khách chỉ thấy lý do chung", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-02");
  const anh = staff(svc, "u-anh");
  svc.claim(s.session_id, anh);
  assert.throws(() => svc.makerDecision(s.session_id, anh, { decision: "REJECT" }), /lý do nội bộ/);
  svc.makerDecision(s.session_id, anh, { decision: "REJECT", reason: "Khuôn mặt không khớp giấy tờ" });
  assert.equal(svc.result(s.session_id).reason!.code, "GENERAL");
});

test("NFR-AUD-03 · audit_event và kyc_decisions không sửa/xoá được", async () => {
  const svc = setup();
  await run(svc, "TD-01");
  assert.throws(() => svc.db.run("UPDATE audit_event SET action = 'X'"), /append-only/);
  assert.throws(() => svc.db.run("DELETE FROM audit_event"), /append-only/);
  assert.throws(() => svc.db.run("UPDATE kyc_decisions SET decision = 'X'"), /immutable/);
});

test("UAT-EKYC-23 · đổi ngưỡng cần trưởng nhóm khác người đề xuất duyệt", () => {
  const svc = setup();
  const anh = staff(svc, "u-anh"), yen = staff(svc, "u-yen"), huy = staff(svc, "u-huy");
  assert.throws(() => svc.requestConfigChange(anh, { key: "sla_hours", value: 500, reason: "Thử giá trị quá lớn" }), /khoảng/);
  assert.throws(() => svc.requestConfigChange(anh, { key: "sla_hours", value: 20, reason: "ngắn" }), /10 ký tự/);
  const { id } = svc.requestConfigChange(anh, { key: "sla_hours", value: 20, reason: "Rút SLA theo yêu cầu của PO" });
  assert.equal(svc.cfg().sla_hours, 24, "chưa áp dụng khi chưa duyệt");
  assert.throws(() => svc.decideConfigChange(yen, id, true), /trưởng nhóm/);
  const { id: id2 } = svc.requestConfigChange(huy, { key: "checker_risk_score", value: 65, reason: "Siết ngưỡng Maker-Checker" });
  assert.throws(() => svc.decideConfigChange(huy, id2, true), /tự phê duyệt/);
  svc.decideConfigChange(huy, id, true);
  assert.equal(svc.cfg().sla_hours, 20);
  const a = svc.db.all("SELECT action FROM audit_event WHERE action LIKE 'CONFIG_%'").map((r) => r.action);
  assert.deepEqual(a, ["CONFIG_CHANGE_REQUESTED", "CONFIG_CHANGE_REQUESTED", "CONFIG_CHANGE_APPROVED"]);
});

test("P01 PR-02 · không hạ tuổi tối thiểu trực tuyến dưới 16; giá trị cũ 15 trong DB bị bỏ qua", () => {
  const svc = setup();
  const anh = staff(svc, "u-anh");
  assert.throws(() => svc.requestConfigChange(anh, { key: "min_age_payment", value: 15, reason: "Thử hạ tuổi về 15" }), /16–25/);
  // DB của bản cũ đã lưu 15 → hệ thống dùng mặc định 16
  svc.db.run("INSERT INTO config (key, value) VALUES ('min_age_payment', '15') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  assert.equal(svc.cfg().min_age_payment, 16);
});

test("Báo cáo SLA và KPI tính được trên dữ liệu thật", async () => {
  const svc = setup();
  await run(svc, "TD-01");
  await run(svc, "TD-05");
  const { s } = await run(svc, "TD-02");
  const anh = staff(svc, "u-anh");
  svc.claim(s.session_id, anh);
  clock.advance(2 * H);
  svc.makerDecision(s.session_id, anh, { decision: "APPROVE" });
  const sla = svc.slaReport();
  assert.equal(sla.decided, 1);
  assert.equal(sla.within_sla, 1);
  assert.equal(sla.median_hours, 2);
  const k = svc.kpi();
  // 8 hồ sơ mẫu trong hàng đợi + 3 hồ sơ vừa chạy; 1 STP; 2 hồ sơ dùng ảnh in trên thẻ (0045 và TD-02)
  assert.equal(k.stp_rate, 1 / 11);
  assert.equal(k.nfc_fallback_rate, 2 / 11);
});
