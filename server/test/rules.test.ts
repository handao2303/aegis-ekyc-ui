import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG as cfg } from "../src/config.ts";
import { checkDocument, decide, dedup, maskName, needsChecker, normalizeIdNumber, slaState } from "../src/rules.ts";

const NOW = Date.parse("2026-11-22T03:00:00Z");
const H = 3_600_000;

test("chuẩn hoá số CCCD: bỏ khoảng trắng, đủ 12 số", () => {
  assert.equal(normalizeIdNumber("089 1920 05678"), "089192005678");
  assert.equal(normalizeIdNumber("08919200567"), null);
  assert.equal(normalizeIdNumber("08919200567A"), null);
});

test("RULE-EKYC-10: hết hạn, chưa đủ tuổi, sắp hết hạn", () => {
  assert.deepEqual(checkDocument({ dob: "1990-01-01", expiry: "2025-03-15" }, "payment", cfg, NOW), { ok: false, reject: "DOC_EXPIRED", message: "Giấy tờ đã hết hạn" });
  const minor = { dob: "2009-05-20", expiry: "2034-05-20" };
  assert.equal(checkDocument(minor, "credit", cfg, NOW).ok, false, "17 tuổi không mở được sản phẩm tín dụng (18)");
  assert.equal(checkDocument(minor, "payment", cfg, NOW).ok, true, "17 tuổi mở được tài khoản thanh toán (15)");
  const soon = checkDocument({ dob: "1990-01-01", expiry: "2026-12-10" }, "payment", cfg, NOW);
  assert.ok(soon.ok && soon.warnings.includes("DOC_EXPIRING_SOON"));
  // Đúng ngày sinh nhật 18 tuổi
  assert.equal(checkDocument({ dob: "2008-11-22", expiry: "2034-01-01" }, "credit", cfg, NOW).ok, true);
  assert.equal(checkDocument({ dob: "2008-11-23", expiry: "2034-01-01" }, "credit", cfg, NOW).ok, false);
});

test("RULE-EKYC-09: bảng quyết định trùng khách hàng", () => {
  const me = { full_name: "A B", dob: "1990-01-01" };
  const base = { rejectedWithinWindow: false, otherRecords: [] };
  assert.deepEqual(dedup(me, { ...base, activeCustomer: me }), { action: "STOP_DUPLICATE" });
  assert.deepEqual(dedup(me, { ...base, openSessionId: "S1" }), { action: "RESUME", sessionId: "S1" });
  assert.deepEqual(dedup(me, { ...base, rejectedWithinWindow: true }), { action: "CONTINUE", flags: ["PRIOR_REJECTION"] });
  assert.deepEqual(dedup(me, { ...base, otherRecords: [{ full_name: "A C", dob: "1990-01-01" }] }), { action: "CONTINUE", flags: ["IDENTITY_MISMATCH"] });
  assert.deepEqual(dedup(me, { ...base, lookupFailed: true }), { action: "CONTINUE", flags: ["DEDUP_UNAVAILABLE"] });
});

test("Cây quyết định: STP / REFER / REJECTED", () => {
  const ok = { flags: [], matchSource: "CHIP_DG2" as const, liveness: 0.97, faceMatch: 0.93, riskScore: 20, pep: false, sanction: false, cicTimeout: false };
  assert.deepEqual(decide(ok, cfg), { outcome: "STP_APPROVED" });
  assert.deepEqual(decide({ ...ok, matchSource: "OCR_FRONT" }, cfg), { outcome: "REFER", reasons: ["NFC_SKIPPED"] });
  assert.deepEqual(decide({ ...ok, liveness: 0.74 }, cfg), { outcome: "REFER", reasons: ["LIVENESS_BORDERLINE"] });
  assert.deepEqual(decide({ ...ok, pep: true, riskScore: 10 }, cfg), { outcome: "REFER", reasons: ["PEP_MATCH"] }, "PEP luôn REFER bất kể điểm");
  assert.deepEqual(decide({ ...ok, riskScore: 88 }, cfg), { outcome: "REJECTED", reason: "RISK_HIGH" });
  assert.deepEqual(decide({ ...ok, riskScore: 55 }, cfg), { outcome: "REFER", reasons: ["RISK_MEDIUM"] });
  assert.deepEqual(decide({ ...ok, liveness: 0.3 }, cfg), { outcome: "REJECTED", reason: "LIVENESS_FAILED" });
  assert.deepEqual(decide({ ...ok, sanction: true }, { ...cfg, sanction_action: "REJECT" }), { outcome: "REJECTED", reason: "SANCTION_MATCH" });
  assert.deepEqual(decide({ ...ok, flags: ["DEVICE_MULTI_IDENTITY"] }, cfg), { outcome: "REFER", reasons: ["DEVICE_MULTI_IDENTITY"] });
});

test("RULE-EKYC-13: điều kiện cần Checker", () => {
  assert.equal(needsChecker({ pep: true, sanction: false, riskScore: 10 }, cfg), true);
  assert.equal(needsChecker({ pep: false, sanction: true, riskScore: 10 }, cfg), true);
  assert.equal(needsChecker({ pep: false, sanction: false, riskScore: 70 }, cfg), true);
  assert.equal(needsChecker({ pep: false, sanction: false, riskScore: 69.9 }, cfg), false);
});

test("RULE-EKYC-12: trạng thái SLA, trừ thời gian tạm dừng", () => {
  const s = (h: number, extra = {}) => ({ queued_at: NOW - h * H, sla_paused_ms: 0, sla_paused_at: null, decided_at: null, ...extra });
  assert.equal(slaState(s(10), cfg, NOW), "ON_TRACK");
  assert.equal(slaState(s(16), cfg, NOW), "DUE_SOON");
  assert.equal(slaState(s(24.5), cfg, NOW), "BREACHED");
  assert.equal(slaState(s(30, { sla_paused_ms: 10 * H }), cfg, NOW), "DUE_SOON", "30h trừ 10h tạm dừng = 20h");
  assert.equal(slaState(s(30, { sla_paused_at: NOW - H }), cfg, NOW), "PAUSED");
});

test("Che họ tên", () => assert.equal(maskName("LÊ VĂN PHÚC"), "L* V** P***"));
