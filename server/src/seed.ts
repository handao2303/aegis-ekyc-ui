/* Dữ liệu mẫu cho môi trường dev/demo: nhân viên, khách cũ (TD-08) và hàng đợi Compliance.
   Tên và số giấy tờ hư cấu; số CCCD hàng đợi khác với bộ TD để không lẫn khi test. */
import { clock, H, D } from "./db.ts";
import type { EkycService } from "./service.ts";
import { maskIdNumber } from "./rules.ts";

export const STAFF = [
  { id: "u-anh", name: "Nguyễn Minh Anh", role: "OFFICER" },
  { id: "u-yen", name: "Trần Hải Yến", role: "OFFICER" },
  { id: "u-huy", name: "Lê Quang Huy", role: "LEAD" },
  { id: "u-trang", name: "Phạm Thu Trang", role: "CS" },
] as const;

type SeedCase = {
  id: string; name: string; idNo: string; dob: string; hours: number; risk: number; reasons: string[];
  status: "REFER" | "REFER_RESUBMITTED" | "PENDING_CHECKER" | "PENDING_CUSTOMER_INFO";
  assignee?: string; maker?: string; device: string; nfc: boolean; liveness: number; face: number; requests: number; pep?: boolean;
  dobChip?: string;
};

const QUEUE: SeedCase[] = [
  { id: "EKS-2611-0031", name: "LÊ VĂN PHÚC", idNo: "048088106677", dob: "1988-09-14", hours: 22.4, risk: 41.5, reasons: ["CIC_TIMEOUT"], status: "REFER", assignee: "u-yen", device: "Samsung A54 · Android 14", nfc: true, liveness: 0.97, face: 0.93, requests: 0 },
  { id: "EKS-2611-0042", name: "NGUYỄN THỊ MINH THƯ", idNo: "089192105678", dob: "1992-03-15", dobChip: "1992-08-15", hours: 17.1, risk: 58.2, reasons: ["LIVENESS_BORDERLINE", "DOC_DATA_MISMATCH"], status: "REFER_RESUBMITTED", device: "iPhone 13 · iOS 18", nfc: true, liveness: 0.71, face: 0.82, requests: 1 },
  { id: "EKS-2611-0039", name: "PHẠM QUỐC BẢO", idNo: "001075104455", dob: "1975-01-30", hours: 26.3, risk: 64.0, reasons: ["PEP_MATCH"], status: "REFER", device: "iPhone 15 · iOS 18", nfc: true, liveness: 0.99, face: 0.96, requests: 0, pep: true },
  { id: "EKS-2611-0045", name: "ĐỖ THANH HƯƠNG", idNo: "079099105522", dob: "1999-04-12", hours: 9.6, risk: 47.0, reasons: ["NFC_SKIPPED"], status: "REFER", device: "Xiaomi Redmi 9 · Android 11", nfc: false, liveness: 0.94, face: 0.79, requests: 0 },
  { id: "EKS-2611-0047", name: "VŨ HOÀNG LONG", idNo: "034001101313", dob: "2001-10-10", hours: 6.2, risk: 72.8, reasons: ["DEVICE_MULTI_IDENTITY", "RISK_MEDIUM"], status: "REFER", assignee: "u-anh", device: "Pixel 7 · Android 15", nfc: true, liveness: 0.91, face: 0.88, requests: 0 },
  { id: "EKS-2611-0036", name: "TRỊNH MAI LAN", idNo: "001083103636", dob: "1983-02-07", hours: 3.4, risk: 61.3, reasons: ["PEP_MATCH"], status: "PENDING_CHECKER", maker: "u-yen", device: "iPhone 12 · iOS 17", nfc: true, liveness: 0.98, face: 0.95, requests: 0, pep: true },
  { id: "EKS-2611-0028", name: "HỒ ĐỨC THỊNH", idNo: "040090102828", dob: "1990-06-30", hours: 12.0, risk: 39.9, reasons: ["PRIOR_REJECTION"], status: "PENDING_CUSTOMER_INFO", device: "Oppo Reno 8 · Android 13", nfc: true, liveness: 0.95, face: 0.9, requests: 2 },
  { id: "EKS-2611-0050", name: "BÙI NGỌC ÁNH", idNo: "001196103344", dob: "1996-11-21", hours: 1.3, risk: 55.6, reasons: ["LIVENESS_BORDERLINE"], status: "REFER", device: "iPhone 14 · iOS 18", nfc: true, liveness: 0.74, face: 0.89, requests: 0 },
];

/** Chạy fn với đồng hồ đặt lùi về thời điểm ms (để lịch sử hồ sơ có giờ thật) */
function at(ms: number, fn: () => void) {
  const saved = { fixed: clock.fixed, offset: clock.offsetMs };
  clock.fixed = ms;
  try { fn(); } finally { clock.fixed = saved.fixed; clock.offsetMs = saved.offset; }
}
const at0 = (queued: number, i: number) => queued + (i + 1) * 2 * H;

export function seedIfEmpty(svc: EkycService) {
  if (svc.db.get("SELECT 1 FROM staff LIMIT 1")) return false;
  seed(svc);
  return true;
}

export function seed(svc: EkycService) {
  const db = svc.db, now = clock.now();
  db.tx(() => {
    for (const s of STAFF) db.run("INSERT INTO staff (id, name, role) VALUES (?, ?, ?)", s.id, s.name, s.role);

    // TD-08: khách đã có tài khoản active (C04 #2)
    db.run("INSERT INTO customers (id_number_hash, full_name, dob, account_no, status, opened_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)",
      svc.hashId("038085008899"), "HOÀNG THỊ LAN", "1985-06-25", "190312345678", now - 400 * D);

    // TD-13: máy dev-shared-13 đã từng dùng một CCCD khác trong 30 ngày (C13)
    db.run("INSERT INTO velocity_events (kind, key, value, created_at) VALUES ('device_ids', 'dev-shared-13', ?, ?)", svc.hashId("034001009999"), now - 3 * D);

    for (const c of QUEUE) {
      const queued = now - c.hours * H;
      const doc = { full_name: c.name, id_number: c.idNo, dob: c.dob, expiry: "2032-03-15", sex: "F" };
      const chip = c.nfc ? { dg1: { full_name: c.name, id_number: c.idNo, dob: c.dobChip ?? c.dob, expiry: "2032-03-15" }, sod_valid: true, chip_auth: true } : null;
      const paused = c.status === "PENDING_CUSTOMER_INFO" ? now - 5 * H : null;
      db.run(`INSERT INTO sessions (id, token, status, last_step, product, device_id, device_model, phone, terms_version, id_number_hash, id_number_masked,
          full_name, dob, sex, doc_expiry, ocr_json, chip_json, chip_verified, match_source, liveness, face_match, risk_score, pep, sanction, cic_json,
          flags_json, reasons_json, info_request_count, resubmitted, queued_at, sla_paused_at, sla_paused_ms, assignee_id, claimed_at, staff_activity_at,
          pending_maker_id, created_at, updated_at, last_activity_at)
        VALUES (?, ?, ?, 'LIVENESS_DONE', 'payment', ?, ?, ?, '2026.11', ?, ?, ?, ?, 'F', '2032-03-15', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, "seed-" + c.id, c.status, "dev-" + c.id, c.device, "0902" + c.id.slice(-6), svc.hashId(c.idNo), maskIdNumber(c.idNo),
        c.name, c.dob, JSON.stringify(doc), chip ? JSON.stringify(chip) : null, c.nfc ? 1 : 0, c.nfc ? "CHIP_DG2" : "OCR_FRONT", c.liveness, c.face, c.risk, c.pep ? 1 : 0,
        JSON.stringify(c.reasons.includes("CIC_TIMEOUT") ? { timeout: true } : { group: 1, score: 10 }),
        JSON.stringify(c.reasons.filter((r) => !["LIVENESS_BORDERLINE", "PEP_MATCH", "CIC_TIMEOUT", "RISK_MEDIUM"].includes(r))), JSON.stringify(c.reasons),
        c.requests, c.status === "REFER_RESUBMITTED" ? 1 : 0, queued, paused, c.status === "REFER_RESUBMITTED" ? 6 * H : 0,
        c.assignee ?? null, c.assignee ? now - 0.5 * H : null, c.assignee ? now - 0.5 * H : null, c.maker ?? null, queued - 0.2 * H, now - 0.5 * H, queued);
      at(queued, () => svc.audit(c.id, { id: "system", role: "SYSTEM" }, "REFERRED", { after: c.reasons }));
      if (c.requests) {
        for (let i = 0; i < c.requests; i++) {
          const reqAt = at0(queued, i);
          const open = c.status === "PENDING_CUSTOMER_INFO" && i === c.requests - 1;
          at(at0(queued, i), () => svc.audit(c.id, { id: "u-yen", role: "OFFICER" }, "INFO_REQUESTED", { after: { items: ["BACK_BLURRY_MRZ"] } }));
          if (!open) at(at0(queued, i) + 4 * H, () => svc.audit(c.id, { id: "customer", role: "CUSTOMER" }, "INFO_RESUBMITTED"));
          db.run("INSERT INTO info_requests (session_id, items_json, message, requested_by, requested_at, deadline_at, status, fulfilled_at) VALUES (?, ?, ?, 'u-yen', ?, ?, ?, ?)",
            c.id, JSON.stringify(["BACK_BLURRY_MRZ"]), "Ảnh mặt sau bị loá, vui lòng chụp lại nơi đủ sáng.", reqAt, reqAt + 5 * D, open ? "OPEN" : "FULFILLED", open ? null : reqAt + 4 * H);
        }
      }
      if (c.assignee) at(now - 0.5 * H, () => svc.audit(c.id, { id: c.assignee!, role: "OFFICER" }, "CASE_CLAIM"));
      if (c.maker) at(now - 1 * H, () => svc.audit(c.id, { id: c.maker!, role: "OFFICER" }, "DECISION_APPROVE", { after: "PENDING_CHECKER" }));
    }
  });
}
