/* Dữ liệu mẫu — tên người và số liệu đều hư cấu */
import type { Tone } from "../components/ui";
import type { L10n } from "../i18n";

export type ReasonCode =
  | "LIVENESS_BORDERLINE" | "PEP_MATCH" | "SANCTION_MATCH" | "CIC_TIMEOUT" | "DOC_DATA_MISMATCH"
  | "NFC_SKIPPED" | "DEVICE_MULTI_IDENTITY" | "PRIOR_REJECTION" | "RISK_MEDIUM";

export const REASONS: Record<ReasonCode, { label: L10n; tone: Tone }> = {
  LIVENESS_BORDERLINE: { label: { vi: "Liveness vùng biên", en: "Borderline liveness" }, tone: "warning" },
  PEP_MATCH: { label: { vi: "Trùng danh sách PEP", en: "PEP match" }, tone: "danger" },
  SANCTION_MATCH: { label: { vi: "Nghi trùng Sanction", en: "Possible sanctions hit" }, tone: "danger" },
  CIC_TIMEOUT: { label: { vi: "CIC quá thời gian", en: "CIC timeout" }, tone: "info" },
  DOC_DATA_MISMATCH: { label: { vi: "OCR ≠ chip", en: "OCR ≠ chip" }, tone: "warning" },
  NFC_SKIPPED: { label: { vi: "Bỏ qua NFC", en: "NFC skipped" }, tone: "neutral" },
  DEVICE_MULTI_IDENTITY: { label: { vi: "Thiết bị nhiều danh tính", en: "Multiple IDs on device" }, tone: "danger" },
  PRIOR_REJECTION: { label: { vi: "Từng bị từ chối", en: "Previously rejected" }, tone: "warning" },
  RISK_MEDIUM: { label: { vi: "Rủi ro trung bình", en: "Medium risk" }, tone: "warning" },
};

export type CaseStatus = "new" | "in_progress" | "resubmitted" | "pending_customer" | "pending_checker";
export const STATUS: Record<CaseStatus, { label: L10n; tone: Tone }> = {
  new: { label: { vi: "Mới", en: "New" }, tone: "neutral" },
  in_progress: { label: { vi: "Đang xử lý", en: "In progress" }, tone: "brand" },
  resubmitted: { label: { vi: "Đã bổ sung", en: "Resubmitted" }, tone: "info" },
  pending_customer: { label: { vi: "Chờ khách bổ sung", en: "Awaiting customer" }, tone: "neutral" },
  pending_checker: { label: { vi: "Chờ Checker", en: "Awaiting checker" }, tone: "warning" },
};

export type Case = {
  id: string;
  name: string;
  masked: string;
  dob: string;
  hours: number;
  risk: number;
  reasons: ReasonCode[];
  status: CaseStatus;
  assignee?: string;
  device: string;
  nfc: boolean;
  liveness: number;
  faceMatch: number;
  matchSource: "CHIP_DG2" | "OCR_FRONT";
  requestCount: number;
  decision?: { type: "approved" | "rejected"; by: string; at: string };
};

export const ME = "Nguyễn Minh Anh";

export const CASES: Case[] = [
  { id: "EKS-2611-0031", name: "Lê Văn Phúc", masked: "Lê V** P***", dob: "1988", hours: 22.4, risk: 41.5, reasons: ["CIC_TIMEOUT"], status: "in_progress", assignee: "Trần Hải Yến", device: "Samsung A54 · Android 14", nfc: true, liveness: 0.97, faceMatch: 0.93, matchSource: "CHIP_DG2", requestCount: 0 },
  { id: "EKS-2611-0042", name: "Nguyễn Thị Minh Thư", masked: "Ng***n T** M*** T**", dob: "1992", hours: 17.1, risk: 58.2, reasons: ["LIVENESS_BORDERLINE", "DOC_DATA_MISMATCH"], status: "resubmitted", device: "iPhone 13 · iOS 18", nfc: true, liveness: 0.71, faceMatch: 0.82, matchSource: "CHIP_DG2", requestCount: 1 },
  { id: "EKS-2611-0039", name: "Phạm Quốc Bảo", masked: "Ph** Q*** B**", dob: "1975", hours: 26.3, risk: 64.0, reasons: ["PEP_MATCH"], status: "new", device: "iPhone 15 · iOS 18", nfc: true, liveness: 0.99, faceMatch: 0.96, matchSource: "CHIP_DG2", requestCount: 0 },
  { id: "EKS-2611-0045", name: "Đỗ Thanh Hương", masked: "Đ* Th*** H****", dob: "1999", hours: 9.6, risk: 47.0, reasons: ["NFC_SKIPPED"], status: "new", device: "Xiaomi Redmi 9 · Android 11", nfc: false, liveness: 0.94, faceMatch: 0.79, matchSource: "OCR_FRONT", requestCount: 0 },
  { id: "EKS-2611-0047", name: "Vũ Hoàng Long", masked: "V* H**** L***", dob: "2001", hours: 6.2, risk: 72.8, reasons: ["DEVICE_MULTI_IDENTITY", "RISK_MEDIUM"], status: "in_progress", assignee: ME, device: "Pixel 7 · Android 15", nfc: true, liveness: 0.91, faceMatch: 0.88, matchSource: "CHIP_DG2", requestCount: 0 },
  { id: "EKS-2611-0036", name: "Trịnh Mai Lan", masked: "Tr*** M** L**", dob: "1983", hours: 3.4, risk: 61.3, reasons: ["PEP_MATCH"], status: "pending_checker", assignee: "Trần Hải Yến", device: "iPhone 12 · iOS 17", nfc: true, liveness: 0.98, faceMatch: 0.95, matchSource: "CHIP_DG2", requestCount: 0 },
  { id: "EKS-2611-0028", name: "Hồ Đức Thịnh", masked: "H* Đ** Th***", dob: "1990", hours: 12.0, risk: 39.9, reasons: ["PRIOR_REJECTION"], status: "pending_customer", device: "Oppo Reno 8 · Android 13", nfc: true, liveness: 0.95, faceMatch: 0.9, matchSource: "CHIP_DG2", requestCount: 2 },
  { id: "EKS-2611-0050", name: "Bùi Ngọc Ánh", masked: "B** Ng** Á**", dob: "1996", hours: 1.3, risk: 55.6, reasons: ["LIVENESS_BORDERLINE"], status: "new", device: "iPhone 14 · iOS 18", nfc: true, liveness: 0.74, faceMatch: 0.89, matchSource: "CHIP_DG2", requestCount: 0 },
];

/* SLA 24h: Trong hạn < 16h · Sắp quá hạn 16–24h · Quá hạn > 24h (RULE-EKYC-12) */
export function sla(hours: number, paused?: boolean): { tone: Tone; label: L10n; left: L10n } {
  if (paused) return { tone: "neutral", label: { vi: "Tạm dừng", en: "Paused" }, left: { vi: "Chờ khách", en: "Awaiting customer" } };
  const left = 24 - hours;
  const h = Math.floor(Math.abs(left));
  const m = String(Math.round((Math.abs(left) % 1) * 60)).padStart(2, "0");
  if (left < 0) return { tone: "danger", label: { vi: "Quá SLA", en: "SLA breached" }, left: { vi: `trễ ${h}g ${m}p`, en: `${h}h ${m}m over` } };
  if (hours >= 16) return { tone: "warning", label: { vi: "Sắp quá hạn", en: "Due soon" }, left: { vi: `còn ${h}g ${m}p`, en: `${h}h ${m}m left` } };
  return { tone: "success", label: { vi: "Trong hạn", en: "On track" }, left: { vi: `còn ${h}g ${m}p`, en: `${h}h ${m}m left` } };
}

export const riskBand = (r: number): Tone => (r >= 70 ? "danger" : r >= 50 ? "warning" : "success");
