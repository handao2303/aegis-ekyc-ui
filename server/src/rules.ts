/* Quy tắc nghiệp vụ dạng hàm thuần – mỗi hàm ứng với một RULE trong C03, test độc lập được. */
import { createHash } from "node:crypto";
import type { Config } from "./config.ts";

export type Flag =
  | "DOC_DATA_MISMATCH" | "PRIOR_REJECTION" | "IDENTITY_MISMATCH" | "DEDUP_UNAVAILABLE"
  | "DEVICE_MULTI_IDENTITY" | "DEVICE_RISK" | "CHIP_AUTH_FAILED" | "NFC_SKIPPED" | "OCR_UNREADABLE" | "FOREIGN_NATIONAL";

export type ReferReason =
  | Flag | "LIVENESS_BORDERLINE" | "PEP_MATCH" | "SANCTION_MATCH" | "CIC_TIMEOUT" | "RISK_MEDIUM";

export type RejectReason =
  | "DOC_EXPIRED" | "UNDER_AGE" | "RISK_HIGH" | "SANCTION_MATCH" | "LIVENESS_FAILED" | "FACE_MISMATCH"
  | "NO_RESPONSE" | "MANUAL_REJECT";

/* ---------- Định danh ---------- */
/** Chuẩn hoá số CCCD trước khi so (C04 §3): bỏ khoảng trắng, đủ 12 chữ số */
export function normalizeIdNumber(raw: string): string | null {
  const d = String(raw ?? "").replace(/\s+/g, "");
  return /^\d{12}$/.test(d) ? d : null;
}
/** Số hộ chiếu theo MRZ (ICAO 9303): chữ hoa và số, 6–9 ký tự. Hộ chiếu Việt Nam: 1 chữ + 7 số */
export function normalizePassportNo(raw: string | undefined | null): string | null {
  const d = String(raw ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{6,9}$/.test(d) ? d : null;
}
export const maskPassportNo = (p: string) => `${p.slice(0, 1)}•••${p.slice(-3)}`;
export const hashIdNumber = (id: string, salt: string) => createHash("sha256").update(salt + ":" + id).digest("hex");
export const maskIdNumber = (id: string) => `${id.slice(0, 3)}•••••${id.slice(-4)}`;
/** Che họ tên: giữ chữ cái đầu mỗi từ */
export const maskName = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0] + "*".repeat(Math.max(1, w.length - 1))).join(" ");
const norm = (s: string | undefined | null) => String(s ?? "").normalize("NFC").trim().toUpperCase().replace(/\s+/g, " ");

/* ---------- RULE-EKYC-10 · Hợp lệ giấy tờ & tuổi (C05) ---------- */
export function ageOn(dobIso: string, todayMs: number): number {
  const b = new Date(dobIso + "T00:00:00Z"), t = new Date(todayMs);
  let a = t.getUTCFullYear() - b.getUTCFullYear();
  const m = t.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && t.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export type DocCheck =
  | { ok: true; warnings: string[] }
  | { ok: false; reject: "DOC_EXPIRED" | "UNDER_AGE"; message: string };

export function checkDocument(doc: { dob: string; expiry: string }, product: "payment" | "credit", cfg: Config, nowMs: number): DocCheck {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (doc.expiry < today) return { ok: false, reject: "DOC_EXPIRED", message: "Giấy tờ đã hết hạn" };
  const minAge = product === "credit" ? cfg.min_age_credit : cfg.min_age_payment;
  if (ageOn(doc.dob, nowMs) < minAge) return { ok: false, reject: "UNDER_AGE", message: "Chưa đủ điều kiện độ tuổi" };
  const daysLeft = (Date.parse(doc.expiry) - Date.parse(today)) / 86_400_000;
  return { ok: true, warnings: daysLeft < cfg.expiry_warning_days ? ["DOC_EXPIRING_SOON"] : [] };
}

/** Trường định danh OCR so với DG1 trong chip (C05 #5) */
type DocIds = { full_name: string; dob: string; id_number?: string; passport_no?: string };
export function ocrChipMismatch(ocr: DocIds, chip: DocIds) {
  const diff: string[] = [];
  if (norm(ocr.full_name) !== norm(chip.full_name)) diff.push("full_name");
  if (ocr.dob !== chip.dob) diff.push("dob");
  if (ocr.passport_no || chip.passport_no) {
    if (normalizePassportNo(ocr.passport_no) !== normalizePassportNo(chip.passport_no)) diff.push("passport_no");
  }
  if ((ocr.id_number || chip.id_number) && normalizeIdNumber(ocr.id_number ?? "") !== normalizeIdNumber(chip.id_number ?? "")) diff.push("id_number");
  return diff;
}

/* ---------- RULE-EKYC-09 · Trùng khách hàng (C04) ---------- */
export type DedupInput = {
  activeCustomer?: { full_name: string; dob: string } | null;
  openSessionId?: string | null;
  rejectedWithinWindow: boolean;
  otherRecords: { full_name: string | null; dob: string | null }[];
  lookupFailed?: boolean;
};
export type DedupResult =
  | { action: "STOP_DUPLICATE" }
  | { action: "RESUME"; sessionId: string }
  | { action: "CONTINUE"; flags: Flag[] };

export function dedup(me: { full_name: string; dob: string }, x: DedupInput): DedupResult {
  if (x.lookupFailed) return { action: "CONTINUE", flags: ["DEDUP_UNAVAILABLE"] };
  if (x.activeCustomer) return { action: "STOP_DUPLICATE" };
  if (x.openSessionId) return { action: "RESUME", sessionId: x.openSessionId };
  const flags: Flag[] = [];
  if (x.rejectedWithinWindow) flags.push("PRIOR_REJECTION");
  if (x.otherRecords.some((r) => r.full_name && (norm(r.full_name) !== norm(me.full_name) || r.dob !== me.dob))) flags.push("IDENTITY_MISMATCH");
  return { action: "CONTINUE", flags };
}

/* ---------- Cây quyết định tổng (A01 §4, C11 RULE-EKYC-14, C13) ---------- */
export type DecisionInput = {
  flags: Flag[];
  matchSource: "CHIP_DG2" | "OCR_FRONT";
  liveness: number;
  faceMatch: number;
  riskScore: number;
  pep: boolean;
  sanction: boolean;
  cicTimeout: boolean;
};
export type Decision =
  | { outcome: "STP_APPROVED" }
  | { outcome: "REFER"; reasons: ReferReason[] }
  | { outcome: "REJECTED"; reason: RejectReason };

export function decide(x: DecisionInput, cfg: Config): Decision {
  if (x.liveness < cfg.liveness_fail) return { outcome: "REJECTED", reason: "LIVENESS_FAILED" };
  if (x.faceMatch < cfg.face_match_fail) return { outcome: "REJECTED", reason: "FACE_MISMATCH" };
  if (x.sanction && cfg.sanction_action === "REJECT") return { outcome: "REJECTED", reason: "SANCTION_MATCH" };
  if (x.riskScore >= cfg.risk_reject_score) return { outcome: "REJECTED", reason: "RISK_HIGH" };

  const reasons: ReferReason[] = [...x.flags];
  if (x.matchSource === "OCR_FRONT" && !reasons.includes("NFC_SKIPPED") && !reasons.includes("CHIP_AUTH_FAILED")) reasons.push("NFC_SKIPPED");
  if (x.liveness < cfg.liveness_pass || x.faceMatch < cfg.face_match_pass) reasons.push("LIVENESS_BORDERLINE");
  if (x.pep) reasons.push("PEP_MATCH"); // RULE-EKYC-04: PEP luôn REFER bất kể điểm
  if (x.sanction) reasons.push("SANCTION_MATCH");
  if (x.cicTimeout) reasons.push("CIC_TIMEOUT");
  if (x.riskScore >= cfg.risk_refer_score) reasons.push("RISK_MEDIUM");
  return reasons.length ? { outcome: "REFER", reasons: [...new Set(reasons)] } : { outcome: "STP_APPROVED" };
}

/* ---------- RULE-EKYC-13 · Cần Checker (C10) ---------- */
export const needsChecker = (c: { pep: boolean; sanction: boolean; riskScore: number }, cfg: Config) =>
  c.pep || c.sanction || c.riskScore >= cfg.checker_risk_score;

/* ---------- RULE-EKYC-12 · SLA (C09) ---------- */
export type SlaState = "ON_TRACK" | "DUE_SOON" | "BREACHED" | "PAUSED" | "DONE";
export function slaElapsedMs(s: { queued_at: number | null; sla_paused_ms: number; sla_paused_at: number | null; decided_at: number | null }, nowMs: number) {
  if (s.queued_at == null) return 0;
  const end = s.decided_at ?? nowMs;
  const pausedNow = s.sla_paused_at != null && s.decided_at == null ? end - s.sla_paused_at : 0;
  return Math.max(0, end - s.queued_at - s.sla_paused_ms - pausedNow);
}
export function slaState(s: Parameters<typeof slaElapsedMs>[0], cfg: Config, nowMs: number): SlaState {
  if (s.decided_at != null) return "DONE";
  if (s.sla_paused_at != null) return "PAUSED";
  const h = slaElapsedMs(s, nowMs) / 3_600_000;
  return h > cfg.sla_hours ? "BREACHED" : h >= cfg.sla_warning_hours ? "DUE_SOON" : "ON_TRACK";
}

/* ---------- Thông điệp cho khách (không lộ AML/PEP/CIC – BR-16) ---------- */
export function customerSafeReason(code: RejectReason | "STOPPED_DUPLICATE" | string | null): { code: string; message: string } {
  switch (code) {
    case "DOC_EXPIRED": return { code, message: "Giấy tờ đã hết hạn. Vui lòng cập nhật giấy tờ mới." };
    case "UNDER_AGE": return { code, message: "Chưa đủ điều kiện độ tuổi cho sản phẩm này." };
    case "STOPPED_DUPLICATE": return { code, message: "Số CCCD này đã có tài khoản. Vui lòng đăng nhập." };
    case "NO_RESPONSE": return { code, message: "Hồ sơ đã bị huỷ do quá hạn bổ sung." };
    default: return { code: "GENERAL", message: "Hiện chưa thể mở tài khoản trực tuyến. Vui lòng liên hệ quầy giao dịch hoặc tổng đài 1900 6868." };
  }
}

/** Lời nhắn yêu cầu bổ sung không được nhắc PEP, AML, CIC (C07 #5) */
export const FORBIDDEN_MESSAGE = /\b(PEP|AML|CIC|sanction|danh sách cấm|chính trị)\b/i;

export const INFO_ITEMS = ["FRONT_BLURRY", "BACK_BLURRY_MRZ", "BACK_MISSING", "OCR_CHIP_MISMATCH", "OTHER"] as const;
export type InfoItem = (typeof INFO_ITEMS)[number];
