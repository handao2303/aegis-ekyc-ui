/* UAT-EKYC phía khách hàng (C17 §3) chạy trên service thật với DB trong bộ nhớ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, run } from "./helpers.ts";
import { clock, H, D } from "../src/db.ts";
import { runJobs } from "../src/jobs.ts";
import { cbsCreateAccount } from "../src/adapters.ts";
import { findPersona } from "../src/personas.ts";

const reasons = (svc: ReturnType<typeof setup>, id: string) => JSON.parse(svc.db.get("SELECT reasons_json FROM sessions WHERE id = ?", id)!.reasons_json);

test("UAT-EKYC-01 · TD-01 happy path có NFC → STP_APPROVED, có số TK và thông báo", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-01");
  assert.equal(res!.status, "STP_APPROVED");
  assert.equal(res!.outcome, "approved");
  assert.match(res!.account_no!, /^1903\d{8}$/);
  const n = svc.db.get("SELECT template, channels, status FROM notifications WHERE session_id = ?", s.session_id)!;
  assert.deepEqual({ ...n }, { template: "EKYC_APPROVED", channels: "PUSH+SMS", status: "SENT" });
  assert.ok(svc.db.get("SELECT 1 FROM events WHERE type = 'ekyc.decision.completed' AND session_id = ?", s.session_id), "phát sự kiện cho limit-service");
});

test("UAT-EKYC-11 · tạo tài khoản gọi lại 2 lần → 1 tài khoản", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-01");
  assert.equal(cbsCreateAccount(svc.db, s.session_id), res!.account_no);
  assert.equal(svc.db.get("SELECT COUNT(*) AS n FROM cbs_accounts WHERE idempotency_key = ?", s.session_id)!.n, 1);
});

test("UAT-EKYC-02 · máy không NFC → REFER NFC_SKIPPED, nguồn so khớp OCR_FRONT", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-02");
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["NFC_SKIPPED"]);
  assert.equal(svc.db.get("SELECT match_source FROM sessions WHERE id = ?", s.session_id)!.match_source, "OCR_FRONT");
  assert.ok(svc.db.get("SELECT 1 FROM notifications WHERE session_id = ? AND template = 'EKYC_UNDER_REVIEW'", s.session_id));
});

test("UAT-EKYC-03 · điều khoản đổi giữa chừng → bắt đồng ý lại", async () => {
  const svc = setup();
  const p = findPersona("TD-01");
  const s = svc.createSession({ device_id: p.device.id, phone: p.phone });
  svc.consent(s.session_id, s.token, { scopes: ["identity", "screening"], terms_version: s.terms_version });
  svc.db.run("INSERT INTO config (key, value) VALUES ('terms_version', '\"2026.12\"')");
  clock.advance(40 * 60_000);
  runJobs(svc);
  const r = svc.findResumable(p.device.id)!;
  assert.equal(r.reconsent_required, true);
  assert.throws(() => svc.resume(s.session_id, s.token), /Cần đồng ý lại/);
  assert.throws(() => svc.consent(s.session_id, s.token, { scopes: ["identity", "screening"], terms_version: "2026.11" }), /Điều khoản đã thay đổi/);
  svc.consent(s.session_id, s.token, { scopes: ["identity", "screening"], terms_version: "2026.12" });
  assert.equal(svc.resume(s.session_id, s.token).next, "DOC");
});

test("Consent: thiếu mục bắt buộc → 422", () => {
  const svc = setup();
  const s = svc.createSession({ device_id: "d-x" });
  assert.throws(() => svc.consent(s.session_id, s.token, { scopes: ["identity"], terms_version: s.terms_version }), /2 mục bắt buộc/);
});

test("UAT-EKYC-04 · liveness vùng biên → REFER LIVENESS_BORDERLINE", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-03");
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["LIVENESS_BORDERLINE"]);
});

test("UAT-EKYC-05 · trùng PEP, điểm thấp → REFER (override)", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-04");
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["PEP_MATCH"]);
});

test("UAT-EKYC-06 · rủi ro cao → REJECTED, lý do chung cho khách", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-05");
  assert.equal(res!.status, "REJECTED");
  assert.equal(res!.reason!.code, "GENERAL", "không lộ RISK_HIGH cho khách");
  const payload = JSON.parse(svc.db.get("SELECT payload FROM notifications WHERE session_id = ?", s.session_id)!.payload);
  assert.doesNotMatch(JSON.stringify(payload), /RISK|CIC|AML|PEP/);
});

test("UAT-EKYC-07 · CIC quá thời gian → REFER CIC_TIMEOUT, không treo", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-06");
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["CIC_TIMEOUT"]);
});

test("UAT-EKYC-10 · chụp lỗi 3 lần → lần 3 chuyển REFER", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-07", {}, "consent");
  assert.equal(svc.captureFailure(s.session_id, s.token).remaining, 2);
  assert.equal(svc.captureFailure(s.session_id, s.token).remaining, 1);
  const third = svc.captureFailure(s.session_id, s.token);
  assert.equal(third.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["OCR_UNREADABLE"]);
});

test("UAT-EKYC-12 · CCCD đã có tài khoản → dừng trước Liveness", async () => {
  const svc = setup();
  const { s, doc } = await run(svc, "TD-08");
  assert.equal(doc!.next, "DUPLICATE");
  assert.equal(svc.result(s.session_id).status, "STOPPED_DUPLICATE");
  await assert.rejects(svc.submitLiveness(s.session_id, s.token, { liveness: 0.99, face_match: 0.99 }), /Cần hoàn tất/);
});

test("UAT-EKYC-13 · CCCD hết hạn → REJECTED DOC_EXPIRED", async () => {
  const svc = setup();
  const { doc } = await run(svc, "TD-09");
  assert.equal(doc!.next, "EXPIRED_DOC");
  assert.equal((doc as any).reason.code, "DOC_EXPIRED");
});

test("UAT-EKYC-14 · 17 tuổi với sản phẩm tín dụng → REJECTED UNDER_AGE", async () => {
  const svc = setup();
  const { doc } = await run(svc, "TD-10");
  assert.equal((doc as any).reason.code, "UNDER_AGE");
});

test("UAT-EKYC-15 · tiếp tục phiên dở → về đúng bước, liveness làm lại", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-01", {}, "chip");
  clock.advance(31 * 60_000);
  assert.equal(runJobs(svc)["session-abandon-scan"], 1);
  assert.equal(svc.result(s.session_id).status, "ABANDONED");
  const r = svc.findResumable("dev-td01")!;
  assert.equal(r.resume_screen, "LIVENESS");
  assert.equal(svc.resume(s.session_id, s.token).status, "DOC_CAPTURED");
  const res = await svc.submitLiveness(s.session_id, s.token, { liveness: 0.97, face_match: 0.93 });
  assert.equal(res.status, "STP_APPROVED");
});

test("C06 · phiên bỏ dở quá 7 ngày → EXPIRED và xoá dữ liệu", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-01", {}, "chip");
  clock.advance(31 * 60_000); runJobs(svc);
  clock.advance(8 * D); runJobs(svc);
  const row = svc.db.get("SELECT status, ocr_json, chip_json, purged_at FROM sessions WHERE id = ?", s.session_id)!;
  assert.equal(row.status, "EXPIRED");
  assert.equal(row.ocr_json, null);
  assert.equal(row.chip_json, null);
  assert.ok(row.purged_at);
});

test("UAT-EKYC-20 · chip sai chữ ký số → REFER CHIP_AUTH_FAILED", async () => {
  const svc = setup();
  const { s, chip, res } = await run(svc, "TD-12");
  assert.equal(chip!.chip_verified, false);
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["CHIP_AUTH_FAILED"]);
});

test("UAT-EKYC-21 · rút lại đồng ý khi đang làm → huỷ, xoá trong 24h", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-01", {}, "document");
  const w = svc.withdrawConsent(s.session_id, s.token, "identity");
  assert.equal(w.result, "CANCELLED");
  clock.advance(25 * H);
  assert.equal(runJobs(svc).retention, 1);
  assert.equal(svc.db.get("SELECT full_name FROM sessions WHERE id = ?", s.session_id)!.full_name, null);
});

test("C12 · đã có tài khoản thì không xoá dữ liệu khi rút đồng ý", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-01");
  assert.equal(svc.withdrawConsent(s.session_id, s.token, "identity").result, "RETAINED");
  assert.equal(svc.withdrawConsent(s.session_id, s.token, "marketing").result, "WITHDRAWN");
});

test("UAT-EKYC-22 · một máy, hai CCCD → REFER DEVICE_MULTI_IDENTITY", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-13");
  assert.equal(res!.status, "REFER");
  assert.ok(reasons(svc, s.session_id).includes("DEVICE_MULTI_IDENTITY"));
});

test("C05 #5 · OCR khác chip → cờ DOC_DATA_MISMATCH → REFER", async () => {
  const svc = setup();
  const p = findPersona("TD-01");
  const { s, chip, res } = await run(svc, "TD-01", { chip: { ...p.chip!, dg1: { ...p.chip!.dg1, dob: "1992-08-15" } } });
  assert.deepEqual(chip!.mismatch, ["dob"]);
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["DOC_DATA_MISMATCH"]);
});

test("C13 · quá 3 phiên / thiết bị / 24h → 429, không lộ quy tắc", () => {
  const svc = setup();
  for (let i = 0; i < 3; i++) svc.createSession({ device_id: "dev-v" });
  assert.throws(() => svc.createSession({ device_id: "dev-v" }), (e: any) => e.status === 429 && e.message === "Vui lòng thử lại sau");
  assert.ok(svc.db.get("SELECT 1 FROM events WHERE type = 'ekyc.fraud.velocity_hit'"));
  clock.advance(D + 1);
  assert.ok(svc.createSession({ device_id: "dev-v" }).session_id, "hết 24h thì tạo lại được");
});

test("C04 #4 · từng bị từ chối trong 30 ngày → cờ PRIOR_REJECTION", async () => {
  const svc = setup();
  await run(svc, "TD-05"); // REJECTED
  const { s, res } = await run(svc, "TD-05", { device: { id: "dev-other", model: "x" }, phone: "0901999999" });
  assert.equal(res!.status, "REJECTED", "vẫn rủi ro cao");
  assert.ok(JSON.parse(svc.db.get("SELECT flags_json FROM sessions WHERE id = ?", s.session_id)!.flags_json).includes("PRIOR_REJECTION"));
});

test("Khách không thao tác được phiên của người khác", async () => {
  const svc = setup();
  const { s } = await run(svc, "TD-01", {}, "consent");
  assert.throws(() => svc.sessionForToken(s.session_id, "sai-token"), /Phiên không hợp lệ/);
});
