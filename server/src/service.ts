/* ekyc-service: nghiệp vụ phiên eKYC (khách) và xét duyệt (Compliance).
   Mỗi phương thức ghi rõ tài liệu nguồn. Lỗi nghiệp vụ ném ApiError → HTTP status tương ứng. */
import { randomBytes } from "node:crypto";
import { clock, D, H, type Db, type Row } from "./db.ts";
import { DEFAULT_CONFIG, CONFIG_BOUNDS, type Config, type ConfigKey } from "./config.ts";
import {
  checkDocument, customerSafeReason, decide, dedup, FORBIDDEN_MESSAGE, hashIdNumber, INFO_ITEMS, maskIdNumber, maskName,
  maskPassportNo, needsChecker, normalizeIdNumber, normalizePassportNo, ocrChipMismatch, slaElapsedMs, slaState, type Flag, type InfoItem, type ReferReason,
} from "./rules.ts";
import { AdapterError, amlScreen, cbsCreateAccount, cbsLookup, cicLookup, riskScore, sendNotification, type CicResult } from "./adapters.ts";

export class ApiError extends Error {
  status: number; code: string; extra?: Row;
  constructor(status: number, code: string, message: string, extra?: Row) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

export type Staff = { id: string; name: string; role: "OFFICER" | "LEAD" | "CS" };
type Actor = { id: string; role: string };
const SYSTEM: Actor = { id: "system", role: "SYSTEM" };
const CUSTOMER: Actor = { id: "customer", role: "CUSTOMER" };

/** Trạng thái phiên (C03 §1) */
export const ACTIVE = ["CREATED", "CONSENTED", "DOC_CAPTURED", "LIVENESS_DONE"] as const;
export const IN_QUEUE = ["REFER", "REFER_RESUBMITTED", "PENDING_CHECKER", "PENDING_CUSTOMER_INFO"] as const;
const FINAL = ["STP_APPROVED", "APPROVED", "REJECTED", "STOPPED_DUPLICATE", "EXPIRED", "CANCELLED"];

/** Khoá tra CIC/AML: số định danh, hoặc quốc tịch + số hộ chiếu với người nước ngoài */
const screeningKey = (ocr: Row): string => ocr.id_number ?? `${ocr.nationality}:${ocr.passport_no}`;
const j = <T>(s: string | null | undefined, d: T): T => (s ? (JSON.parse(s) as T) : d);
const inList = (v: string, list: readonly string[]) => list.includes(v);

export class EkycService {
  db: Db;
  private salt: string;
  constructor(db: Db, salt = "aegis-dev-salt") { this.db = db; this.salt = salt; }

  /* ================= Hạ tầng chung ================= */
  cfg(): Config {
    const c: Row = { ...DEFAULT_CONFIG };
    for (const r of this.db.all<{ key: string; value: string }>("SELECT key, value FROM config")) c[r.key] = JSON.parse(r.value);
    return c as Config;
  }
  audit(sessionId: string | null, actor: Actor, action: string, opts: { before?: unknown; after?: unknown; reason?: string; ip?: string } = {}) {
    const ba = opts.before !== undefined || opts.after !== undefined ? JSON.stringify({ before: opts.before ?? null, after: opts.after ?? null }) : null;
    this.db.run("INSERT INTO audit_event (session_id, actor_id, role, action, before_after, reason, ip_device, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      sessionId, actor.id, actor.role, action, ba, opts.reason ?? null, opts.ip ?? null, clock.now());
  }
  event(type: string, sessionId: string | null, payload: Row = {}) {
    this.db.run("INSERT INTO events (type, session_id, payload, created_at) VALUES (?, ?, ?, ?)", type, sessionId, JSON.stringify(payload), clock.now());
  }
  /** C08: retry 3 lần, thất bại → DEAD_LETTER; không rollback quyết định KYC */
  notify(sessionId: string | null, template: string, channels: ("PUSH" | "SMS" | "INTERNAL")[], recipient: string | null, payload: Row = {}) {
    let attempts = 0, ok = false;
    while (attempts < 3 && !ok) { attempts++; ok = sendNotification(recipient); }
    this.db.run("INSERT INTO notifications (session_id, template, channels, recipient, payload, status, attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      sessionId, template, channels.join("+"), recipient, JSON.stringify(payload), ok ? "SENT" : "DEAD_LETTER", attempts, clock.now());
    if (!ok) this.event("ops.notification.dead_letter", sessionId, { template });
  }
  staff(id: string | undefined): Staff {
    const s = id ? this.db.get<Staff>("SELECT id, name, role FROM staff WHERE id = ?", id) : undefined;
    if (!s) throw new ApiError(401, "UNAUTHENTICATED", "Cần đăng nhập nhân viên (x-staff-id)");
    return s;
  }
  private session(id: string): Row {
    const s = this.db.get("SELECT * FROM sessions WHERE id = ?", id);
    if (!s) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
    return s;
  }
  /** Khách chỉ thao tác được phiên của mình (token cấp khi tạo phiên) */
  sessionForToken(id: string, token: string | undefined): Row {
    const s = this.session(id);
    if (!token || s.token !== token) throw new ApiError(403, "FORBIDDEN", "Phiên không hợp lệ");
    return s;
  }
  private nextId(): string {
    const d = new Date(clock.now());
    const prefix = `EKS-${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}-`;
    const n = (this.db.get<{ n: number | null }>("SELECT MAX(CAST(substr(id, 10) AS INTEGER)) AS n FROM sessions WHERE id LIKE ?", prefix + "%")?.n ?? 0) + 1;
    return prefix + String(n).padStart(4, "0");
  }
  hashId(idNumber: string) { return hashIdNumber(idNumber, this.salt); }
  private touch(id: string, patch: Row = {}) { this.db.patchSession(id, { ...patch, last_activity_at: clock.now() }); }
  private velocityCount(kind: string, key: string, sinceMs: number, distinct = false) {
    const col = distinct ? "COUNT(DISTINCT value)" : "COUNT(*)";
    return this.db.get<{ n: number }>(`SELECT ${col} AS n FROM velocity_events WHERE kind = ? AND key = ? AND created_at >= ?`, kind, key, clock.now() - sinceMs)?.n ?? 0;
  }
  private velocity(kind: string, key: string, value: string | null = null) {
    this.db.run("INSERT INTO velocity_events (kind, key, value, created_at) VALUES (?, ?, ?, ?)", kind, key, value, clock.now());
  }

  /* ================= Khách hàng: vòng đời phiên ================= */

  /** POST /sessions – C13 velocity trước khi tạo (RULE-EKYC-16) */
  createSession(input: { device_id: string; device_model?: string; device_rooted?: boolean; phone?: string; product?: "payment" | "credit" }) {
    if (!input?.device_id) throw new ApiError(422, "VALIDATION", "Thiếu device_id");
    const cfg = this.cfg();
    const devSessions = this.velocityCount("device_session", input.device_id, D);
    const phoneSessions = input.phone ? this.velocityCount("phone_session", input.phone, D) : 0;
    const livenessFails = this.velocityCount("liveness_fail", input.device_id, D);
    const rule = devSessions >= cfg.velocity_device_sessions_24h ? "DEVICE_VELOCITY"
      : phoneSessions >= cfg.velocity_phone_sessions_24h ? "PHONE_VELOCITY"
      : livenessFails >= cfg.velocity_liveness_failures_24h ? "LIVENESS_ABUSE" : null;
    if (rule) {
      this.event("ekyc.fraud.velocity_hit", null, { rule, device_id: input.device_id });
      // Khách chỉ thấy thông điệp chung, không biết quy tắc nào (C13)
      throw new ApiError(429, "TRY_LATER", "Vui lòng thử lại sau");
    }
    const id = this.nextId(), token = randomBytes(18).toString("base64url"), now = clock.now();
    this.db.run(`INSERT INTO sessions (id, token, status, last_step, product, device_id, device_model, device_rooted, phone, created_at, updated_at, last_activity_at)
      VALUES (?, ?, 'CREATED', 'CREATED', ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, token, input.product === "credit" ? "credit" : "payment", input.device_id, input.device_model ?? null, input.device_rooted ? 1 : 0, input.phone ?? null, now, now, now);
    this.velocity("device_session", input.device_id);
    if (input.phone) this.velocity("phone_session", input.phone);
    this.event("ekyc.session.created", id);
    return { session_id: id, token, terms_version: cfg.terms_version };
  }

  /** POST /sessions/:id/consent – SCRUM-17, re-consent SCRUM-46 */
  consent(id: string, token: string, input: { scopes: string[]; terms_version: string }) {
    const s = this.sessionForToken(id, token), cfg = this.cfg();
    if (input?.terms_version !== cfg.terms_version) throw new ApiError(409, "TERMS_OUTDATED", "Điều khoản đã thay đổi, vui lòng đọc lại", { terms_version: cfg.terms_version });
    const scopes = new Set(input.scopes ?? []);
    if (!scopes.has("identity") || !scopes.has("screening")) throw new ApiError(422, "CONSENT_REQUIRED", "Cần đồng ý 2 mục bắt buộc");
    if (inList(s.status, FINAL)) throw new ApiError(409, "SESSION_CLOSED", "Phiên đã kết thúc");
    for (const sc of scopes) this.db.run("INSERT INTO consents (session_id, scope, status, terms_version, created_at) VALUES (?, ?, 'GRANTED', ?, ?)", id, sc, cfg.terms_version, clock.now());
    const patch: Row = { terms_version: cfg.terms_version };
    if (s.status === "CREATED") Object.assign(patch, { status: "CONSENTED", last_step: "CONSENTED" });
    this.touch(id, patch);
    return { status: patch.status ?? s.status, next: s.status === "CREATED" ? "DOC" : this.stepToScreen(s.last_step) };
  }

  /** POST /sessions/:id/capture-failures – RULE-EKYC-07: lần 3 thất bại → REFER */
  captureFailure(id: string, token: string) {
    const s = this.sessionForToken(id, token), cfg = this.cfg();
    const n = s.capture_failures + 1;
    if (n >= cfg.max_capture_failures) {
      this.touch(id, { capture_failures: n });
      this.toRefer(id, ["OCR_UNREADABLE"], s.phone);
      return { capture_failures: n, remaining: 0, status: "REFER", next: "REFER" };
    }
    this.touch(id, { capture_failures: n });
    return { capture_failures: n, remaining: cfg.max_capture_failures - n, next: "RETRY" };
  }

  /** POST /sessions/:id/document – OCR xong: C05 (hạn, tuổi) rồi C04 (trùng), trước Liveness.
   *  Giấy tờ: CCCD/thẻ Căn cước (số định danh 12 số) hoặc hộ chiếu (số hộ chiếu + quốc tịch).
   *  Hộ chiếu Việt Nam có in số định danh → tra trùng như CCCD; hộ chiếu nước ngoài tra theo quốc tịch + số hộ chiếu và luôn REFER. */
  async submitDocument(id: string, token: string, ocr: { doc_type?: "CCCD" | "PASSPORT"; full_name: string; id_number?: string; passport_no?: string; nationality?: string; dob: string; sex?: string; expiry: string; issued?: string; origin?: string }) {
    const s = this.sessionForToken(id, token), cfg = this.cfg(), now = clock.now();
    if (!inList(s.status, ["CONSENTED", "DOC_CAPTURED"])) throw new ApiError(409, "INVALID_STATE", `Không gửi giấy tờ được ở trạng thái ${s.status}`);
    const docType = ocr?.doc_type === "PASSPORT" ? "PASSPORT" : "CCCD";
    const nationality = docType === "PASSPORT" ? String(ocr.nationality ?? "").toUpperCase() : "VNM";
    const passportNo = docType === "PASSPORT" ? normalizePassportNo(ocr.passport_no) : null;
    const idNumber = ocr?.id_number ? normalizeIdNumber(ocr.id_number) : null;
    const datesOk = /^\d{4}-\d{2}-\d{2}$/.test(ocr?.dob ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(ocr?.expiry ?? "");
    if (!ocr?.full_name || !datesOk) throw new ApiError(422, "VALIDATION", "Dữ liệu OCR không hợp lệ");
    if (docType === "CCCD" && !idNumber) throw new ApiError(422, "VALIDATION", "Số CCCD phải đủ 12 chữ số");
    if (docType === "PASSPORT") {
      if (!passportNo || !/^[A-Z]{3}$/.test(nationality)) throw new ApiError(422, "VALIDATION", "Số hộ chiếu hoặc quốc tịch không hợp lệ");
      if (nationality === "VNM" && !idNumber) throw new ApiError(422, "VALIDATION", "Hộ chiếu Việt Nam cần số định danh cá nhân 12 số");
    }
    const foreign = docType === "PASSPORT" && nationality !== "VNM";
    // Khoá tra trùng: số định danh nếu có, không thì quốc tịch + số hộ chiếu
    const lookupKey = idNumber ?? `P:${nationality}:${passportNo}`;
    const idHash = hashIdNumber(lookupKey, this.salt);
    const base = {
      doc_type: docType, nationality, passport_masked: passportNo ? maskPassportNo(passportNo) : null,
      id_number_hash: idHash, id_number_masked: idNumber ? maskIdNumber(idNumber) : null, full_name: ocr.full_name, dob: ocr.dob, sex: ocr.sex ?? null,
      doc_expiry: ocr.expiry, ocr_json: JSON.stringify({ ...ocr, doc_type: docType, nationality, id_number: idNumber ?? undefined, passport_no: passportNo ?? undefined }),
    };

    // RULE-EKYC-10
    const dc = checkDocument({ dob: ocr.dob, expiry: ocr.expiry }, s.product, cfg, now);
    if (!dc.ok) {
      this.touch(id, base);
      this.finalReject(id, dc.reject, SYSTEM, s.phone);
      return { status: "REJECTED", next: dc.reject === "DOC_EXPIRED" ? "EXPIRED_DOC" : "REJECTED", reason: customerSafeReason(dc.reject), expiry: ocr.expiry };
    }

    // RULE-EKYC-09
    let customer, lookupFailed = false;
    try { customer = await cbsLookup(this.db, idHash, idNumber ?? ""); } catch (e) { if (e instanceof AdapterError) lookupFailed = true; else throw e; }
    const open = this.db.get<{ id: string }>(`SELECT id FROM sessions WHERE id_number_hash = ? AND id <> ? AND status IN ('ABANDONED','CREATED','CONSENTED','DOC_CAPTURED','LIVENESS_DONE') ORDER BY last_activity_at DESC LIMIT 1`, idHash, id);
    const prior = this.db.get(`SELECT id FROM sessions WHERE id_number_hash = ? AND id <> ? AND status = 'REJECTED' AND decided_at >= ?`, idHash, id, now - cfg.prior_rejection_days * D);
    const others = this.db.all<{ full_name: string | null; dob: string | null }>("SELECT full_name, dob FROM sessions WHERE id_number_hash = ? AND id <> ? AND purged_at IS NULL", idHash, id);
    const dd = dedup({ full_name: ocr.full_name, dob: ocr.dob }, {
      activeCustomer: customer && customer.status === "ACTIVE" ? customer : null,
      openSessionId: open?.id ?? null, rejectedWithinWindow: !!prior, otherRecords: others, lookupFailed,
    });
    if (dd.action === "STOP_DUPLICATE") {
      this.touch(id, { ...base, status: "STOPPED_DUPLICATE", last_step: "DOC_CAPTURED", decided_at: now, customer_reason: "STOPPED_DUPLICATE", retention_until: now + cfg.expire_after_days * D });
      this.event("ekyc.session.stopped_duplicate", id);
      return { status: "STOPPED_DUPLICATE", next: "DUPLICATE", reason: customerSafeReason("STOPPED_DUPLICATE") };
    }
    if (dd.action === "RESUME") {
      // Mở lại phiên cũ (C06); phiên hiện tại huỷ, tăng velocity nếu khác thiết bị
      const old = this.session(dd.sessionId);
      if (old.device_id !== s.device_id) this.velocity("device_ids", s.device_id, idHash);
      this.touch(id, { status: "CANCELLED", decided_at: now, retention_until: now });
      return { status: "CANCELLED", next: "RESUME", resume_session_id: dd.sessionId, resume_token: old.device_id === s.device_id ? old.token : null };
    }

    // C13: số CCCD khác nhau trên cùng thiết bị trong 30 ngày
    this.velocity("device_ids", s.device_id, idHash);
    const flags: Flag[] = [...dd.flags];
    if (this.velocityCount("device_ids", s.device_id, 30 * D, true) >= cfg.velocity_device_ids_30d) flags.push("DEVICE_MULTI_IDENTITY");
    if (s.device_rooted) flags.push("DEVICE_RISK");
    // Người nước ngoài: cần kiểm tra thị thực/thẻ tạm trú và mục đích mở tài khoản – không STP
    if (foreign) flags.push("FOREIGN_NATIONAL");
    this.touch(id, { ...base, status: "DOC_CAPTURED", last_step: "DOC_CAPTURED", flags_json: JSON.stringify(flags), warnings_json: JSON.stringify(dc.warnings) });
    return { status: "DOC_CAPTURED", next: "NFC", warnings: dc.warnings };
  }

  /** POST /sessions/:id/chip – C11: chip hợp lệ ⇒ nguồn so khớp CHIP_DG2; OCR ≠ chip ⇒ cờ */
  submitChip(id: string, token: string, input: { skipped?: boolean; dg1?: { full_name: string; id_number?: string; passport_no?: string; nationality?: string; dob: string; expiry: string }; sod_valid?: boolean; chip_auth?: boolean }) {
    const s = this.sessionForToken(id, token);
    if (s.status !== "DOC_CAPTURED") throw new ApiError(409, "INVALID_STATE", `Không đọc chip được ở trạng thái ${s.status}`);
    const flags = new Set<Flag>(j<Flag[]>(s.flags_json, []));
    flags.delete("NFC_SKIPPED"); flags.delete("CHIP_AUTH_FAILED"); flags.delete("DOC_DATA_MISMATCH");
    let matchSource: "CHIP_DG2" | "OCR_FRONT" = "OCR_FRONT", verified = 0, diff: string[] = [];
    if (input?.skipped || !input?.dg1) flags.add("NFC_SKIPPED");
    else if (!input.sod_valid) flags.add("CHIP_AUTH_FAILED");
    else {
      verified = 1; matchSource = "CHIP_DG2";
      diff = ocrChipMismatch(j(s.ocr_json, {} as any), input.dg1);
      if (diff.length) flags.add("DOC_DATA_MISMATCH");
    }
    this.touch(id, { chip_json: input?.dg1 ? JSON.stringify(input) : null, chip_verified: verified, match_source: matchSource, flags_json: JSON.stringify([...flags]) });
    return { chip_verified: !!verified, match_source: matchSource, mismatch: diff, next: "LIVENESS" };
  }

  /** POST /sessions/:id/liveness – nhận kết quả SDK, sàng lọc CIC/AML, ra quyết định (A01 §3–4) */
  async submitLiveness(id: string, token: string, input: { liveness: number; face_match: number }) {
    const s = this.sessionForToken(id, token), cfg = this.cfg();
    if (s.status !== "DOC_CAPTURED" || !s.match_source) throw new ApiError(409, "INVALID_STATE", "Cần hoàn tất bước giấy tờ và chip trước");
    const liveness = Number(input?.liveness), face = Number(input?.face_match);
    if (!(liveness >= 0 && liveness <= 1) || !(face >= 0 && face <= 1)) throw new ApiError(422, "VALIDATION", "Điểm liveness / face_match phải trong 0–1");
    if (liveness < cfg.liveness_fail) this.velocity("liveness_fail", s.device_id);
    this.touch(id, { status: "LIVENESS_DONE", last_step: "LIVENESS_DONE", liveness, face_match: face });

    // SCREENING
    this.db.patchSession(id, { status: "SCREENING" });
    const idNumber = screeningKey(j<Row>(s.ocr_json, {}));
    let cic: CicResult | null = null, cicTimeout = false;
    try { cic = await cicLookup(idNumber); } catch (e) { if (e instanceof AdapterError) cicTimeout = true; else throw e; }
    const aml = await amlScreen(idNumber);
    const risk = riskScore(idNumber, cic, aml);
    this.db.patchSession(id, { cic_json: JSON.stringify(cic ?? { timeout: true }), pep: aml.pep ? 1 : 0, sanction: aml.sanction ? 1 : 0, risk_score: risk });

    const d = decide({ flags: j<Flag[]>(s.flags_json, []), matchSource: s.match_source, liveness, faceMatch: face, riskScore: risk, pep: aml.pep, sanction: aml.sanction, cicTimeout }, cfg);
    if (d.outcome === "REJECTED") { this.finalReject(id, d.reason, SYSTEM, s.phone); return this.result(id); }
    if (d.outcome === "REFER") { this.toRefer(id, d.reasons, s.phone); return this.result(id); }
    this.approve(id, "STP_APPROVED", SYSTEM, null, null);
    return this.result(id);
  }

  /** GET /sessions/:id – trạng thái cho app (không lộ lý do nội bộ) */
  result(id: string) {
    const s = this.session(id);
    const outcome = inList(s.status, ["STP_APPROVED", "APPROVED"]) ? "approved" : s.status === "REJECTED" ? "rejected" : inList(s.status, IN_QUEUE) ? "refer" : null;
    const ir = s.status === "PENDING_CUSTOMER_INFO" ? this.openInfoRequest(id) : null;
    return {
      session_id: id, status: s.status, outcome, last_step: s.last_step,
      account_no: s.account_no ?? null, holder: s.account_no ? s.full_name : null,
      reason: s.status === "REJECTED" ? customerSafeReason(s.customer_reason) : null,
      queued_at: s.queued_at, decided_at: s.decided_at,
      info_request: ir ? { id: ir.id, items: j<string[]>(ir.items_json, []), message: ir.message, deadline_at: ir.deadline_at } : null,
    };
  }

  /** GET /sessions/resume?device_id – phiên dở gần nhất của thiết bị (C06) */
  findResumable(deviceId: string) {
    const cfg = this.cfg();
    const s = this.db.get(`SELECT * FROM sessions WHERE device_id = ? AND status IN ('ABANDONED','CREATED','CONSENTED','DOC_CAPTURED','LIVENESS_DONE') ORDER BY last_activity_at DESC LIMIT 1`, deviceId);
    if (!s) return null;
    return {
      session_id: s.id, token: s.token, status: s.status, last_step: s.last_step,
      resume_screen: this.stepToScreen(s.last_step), reconsent_required: !!s.terms_version && s.terms_version !== cfg.terms_version,
      expires_at: s.last_activity_at + cfg.expire_after_days * D,
    };
  }
  private stepToScreen(step: string | null) {
    // Liveness luôn làm lại (RULE-EKYC-11) nên LIVENESS_DONE quay về bước khuôn mặt
    return step === "DOC_CAPTURED" || step === "LIVENESS_DONE" ? "LIVENESS" : step === "CONSENTED" ? "DOC" : "CONSENT";
  }

  /** POST /sessions/:id/resume */
  resume(id: string, token: string) {
    const s = this.sessionForToken(id, token), cfg = this.cfg();
    if (!inList(s.status, ["ABANDONED", ...ACTIVE])) throw new ApiError(409, "INVALID_STATE", "Không thể tiếp tục phiên này");
    if (s.terms_version && s.terms_version !== cfg.terms_version) throw new ApiError(409, "TERMS_OUTDATED", "Cần đồng ý lại điều khoản", { terms_version: cfg.terms_version });
    const back = s.last_step === "LIVENESS_DONE" ? "DOC_CAPTURED" : s.last_step ?? "CREATED";
    this.touch(id, { status: back, last_step: back, liveness: null, face_match: null });
    this.audit(id, CUSTOMER, "SESSION_RESUMED", { before: s.status, after: back });
    return { status: back, next: this.stepToScreen(back) };
  }

  /** POST /sessions/:id/cancel – Làm lại từ đầu: xoá dữ liệu tạm */
  cancel(id: string, token: string) {
    const s = this.sessionForToken(id, token);
    if (inList(s.status, FINAL) || inList(s.status, IN_QUEUE)) throw new ApiError(409, "INVALID_STATE", "Không huỷ được hồ sơ đã gửi");
    this.purgePersonalData(id);
    this.touch(id, { status: "CANCELLED", decided_at: clock.now() });
    return { status: "CANCELLED" };
  }

  /** POST /sessions/:id/consents/withdraw – RULE-EKYC-15 (C12) */
  withdrawConsent(id: string, token: string, scope: string) {
    const s = this.sessionForToken(id, token), cfg = this.cfg(), now = clock.now();
    if (!["identity", "screening", "marketing"].includes(scope)) throw new ApiError(422, "VALIDATION", "Phạm vi không hợp lệ");
    this.db.run("INSERT INTO consents (session_id, scope, status, terms_version, created_at) VALUES (?, ?, 'WITHDRAWN', ?, ?)", id, scope, s.terms_version ?? cfg.terms_version, now);
    this.audit(id, CUSTOMER, "CONSENT_WITHDRAWN", { reason: scope });
    if (scope === "marketing") return { result: "WITHDRAWN", message: "Đã ngừng gửi ưu đãi." };
    if (s.account_no) return { result: "RETAINED", message: "Bạn đã có tài khoản nên dữ liệu định danh phải được lưu theo quy định phòng, chống rửa tiền. Chúng tôi ngừng mọi xử lý ngoài mục đích bắt buộc." };
    this.touch(id, { status: "CANCELLED", decided_at: now, retention_until: now + cfg.retention_withdrawn_hours * H });
    this.event("ekyc.consent.withdrawn", id);
    return { result: "CANCELLED", message: "Đã rút lại đồng ý. Dữ liệu sẽ được xoá trong 24 giờ.", delete_by: now + cfg.retention_withdrawn_hours * H };
  }

  /** GET /sessions/:id/notifications – hộp thư của khách (bản demo) */
  customerNotifications(id: string, token: string) {
    this.sessionForToken(id, token);
    return this.db.all("SELECT id, template, channels, status, payload, created_at FROM notifications WHERE session_id = ? AND channels <> 'INTERNAL' ORDER BY id DESC", id)
      .map((n) => ({ ...n, payload: j(n.payload, {}) }));
  }

  /** POST /sessions/:id/info-request/submit – khách gửi bổ sung (C07) */
  submitInfo(id: string, token: string, docs: { items: string[] }) {
    const s = this.sessionForToken(id, token), now = clock.now();
    if (s.status !== "PENDING_CUSTOMER_INFO") throw new ApiError(409, "INVALID_STATE", "Hồ sơ không chờ bổ sung");
    const ir = this.openInfoRequest(id)!;
    const need = j<string[]>(ir.items_json, []);
    const got = new Set(docs?.items ?? []);
    const missing = need.filter((x) => !got.has(x));
    if (missing.length) throw new ApiError(422, "MISSING_ITEMS", "Còn thiếu hạng mục cần bổ sung", { missing });
    this.db.run("UPDATE info_requests SET status = 'FULFILLED', fulfilled_at = ? WHERE id = ?", now, ir.id);
    this.touch(id, { status: "REFER_RESUBMITTED", resubmitted: 1, sla_paused_ms: s.sla_paused_ms + (now - (s.sla_paused_at ?? now)), sla_paused_at: null });
    this.audit(id, CUSTOMER, "INFO_RESUBMITTED", { after: need });
    this.event("ekyc.info.resubmitted", id);
    return this.result(id);
  }
  private openInfoRequest(id: string) {
    return this.db.get("SELECT * FROM info_requests WHERE session_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1", id);
  }

  /* ================= Chuyển trạng thái dùng chung ================= */
  private toRefer(id: string, reasons: ReferReason[], phone: string | null) {
    const now = clock.now();
    this.db.patchSession(id, { status: "REFER", reasons_json: JSON.stringify(reasons), queued_at: now, sla_paused_at: null, sla_paused_ms: 0 });
    this.audit(id, SYSTEM, "REFERRED", { after: reasons });
    this.event("ekyc.decision.referred", id, { reasons });
    this.notify(id, "EKYC_UNDER_REVIEW", ["PUSH"], phone, { hours: this.cfg().sla_hours });
  }
  private finalReject(id: string, reason: string, actor: Actor, phone: string | null, note?: string) {
    const now = clock.now(), cfg = this.cfg();
    this.db.patchSession(id, { status: "REJECTED", customer_reason: reason, decided_at: now, retention_until: now + cfg.retention_rejected_days * D, assignee_id: null });
    this.db.run("INSERT INTO kyc_decisions (session_id, decision, decided_by, maker_id, internal_reason, note, decided_at) VALUES (?, 'REJECTED', ?, ?, ?, ?, ?)",
      id, actor.id, actor.role === "SYSTEM" ? null : actor.id, reason, note ?? null, now);
    this.audit(id, actor, actor.role === "SYSTEM" ? "AUTO_REJECTED" : "DECISION_REJECT", { reason });
    this.event("ekyc.decision.completed", id, { decision: "REJECTED" });
    this.notify(id, "EKYC_REJECTED", ["PUSH", "SMS"], phone, customerSafeReason(reason));
  }
  /** Tạo tài khoản CBS (idempotency key = session id) rồi mới phát sự kiện (SIT-10) */
  private approve(id: string, status: "STP_APPROVED" | "APPROVED", actor: Actor, makerId: string | null, checkerId: string | null, note?: string) {
    const s = this.session(id), now = clock.now();
    const accountNo = cbsCreateAccount(this.db, id);
    const ocr = j<Row>(s.ocr_json, {});
    this.db.run(`INSERT INTO customers (id_number_hash, full_name, dob, account_no, status, opened_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)
      ON CONFLICT(id_number_hash) DO UPDATE SET status = 'ACTIVE', account_no = excluded.account_no`, s.id_number_hash, ocr.full_name, ocr.dob, accountNo, now);
    this.db.patchSession(id, { status, account_no: accountNo, decided_at: now, assignee_id: null, pending_maker_id: null });
    this.db.run("INSERT INTO kyc_decisions (session_id, decision, decided_by, maker_id, checker_id, note, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, status, actor.id, makerId, checkerId, note ?? null, now);
    this.audit(id, actor, status === "STP_APPROVED" ? "AUTO_APPROVED" : checkerId ? "CHECKER_APPROVE" : "DECISION_APPROVE", { after: { account_no: accountNo } });
    this.event("ekyc.decision.completed", id, { decision: status, account_no: accountNo, product: s.product });
    // Push đi qua APNs/FCM ở nước ngoài → không mang số tài khoản (P01 §4.1); số tài khoản chỉ gửi qua SMS
    this.notify(id, "EKYC_APPROVED", ["PUSH"], s.phone, {});
    this.notify(id, "EKYC_APPROVED", ["SMS"], s.phone, { account_no: accountNo });
  }
  /** Xoá dữ liệu cá nhân của một hồ sơ (C12, D01 §5). Giữ device_id và id_number_hash cho chống gian lận lặp lại – chờ DPO chốt (D01 §7) */
  purgePersonalData(id: string) {
    this.db.patchSession(id, {
      ocr_json: null, chip_json: null, full_name: null, dob: null, sex: null, id_number_masked: null, passport_masked: null,
      phone: null, cic_json: null, liveness: null, face_match: null, purged_at: clock.now(),
    });
    this.db.run("UPDATE notifications SET recipient = NULL, payload = NULL WHERE session_id = ?", id);
  }

  /* ================= Compliance: hàng đợi & xét duyệt ================= */

  /** Dòng trong hàng đợi (PII che, không có dữ liệu sàng lọc) */
  private item(s: Row, viewer: Staff) {
    const cfg = this.cfg(), now = clock.now();
    const assignee = s.assignee_id ? this.db.get<Staff>("SELECT id, name, role FROM staff WHERE id = ?", s.assignee_id) : null;
    const maker = s.pending_maker_id ? this.db.get<Staff>("SELECT id, name, role FROM staff WHERE id = ?", s.pending_maker_id) : null;
    const decision = this.db.get("SELECT decision, decided_by, maker_id, checker_id, decided_at FROM kyc_decisions WHERE session_id = ? ORDER BY id DESC LIMIT 1", s.id);
    const decider = decision ? this.db.get<Staff>("SELECT id, name FROM staff WHERE id = ?", decision.checker_id ?? decision.decided_by) : null;
    return {
      id: s.id, status: s.status, doc_type: s.doc_type ?? "CCCD", nationality: s.nationality ?? null,
      name_masked: s.full_name ? maskName(s.full_name) : "—",
      dob_year: s.dob ? s.dob.slice(0, 4) : null,
      reasons: j<string[]>(s.reasons_json, []),
      risk_score: viewer.role === "CS" ? null : s.risk_score,
      sla: { state: slaState(s as any, cfg, now), elapsed_hours: Math.round((slaElapsedMs(s as any, now) / H) * 10) / 10, limit_hours: cfg.sla_hours, warning_hours: cfg.sla_warning_hours },
      assignee, pending_maker: maker, resubmitted: !!s.resubmitted, info_request_count: s.info_request_count,
      device: s.device_model, nfc: !!s.chip_verified, liveness: s.liveness, face_match: s.face_match, match_source: s.match_source,
      queued_at: s.queued_at, decided_at: s.decided_at,
      decision: decision ? { decision: decision.decision, by: decider?.name ?? decision.decided_by, at: decision.decided_at } : null,
    };
  }

  /** GET /cases?view=queue|checker|done|mine – thứ tự: Đã bổ sung → Sắp quá SLA → Cũ nhất (RULE-EKYC-12) */
  listCases(viewer: Staff, view = "queue") {
    let rows: Row[];
    if (view === "done") rows = this.db.all("SELECT s.* FROM sessions s WHERE s.queued_at IS NOT NULL AND s.status IN ('APPROVED','REJECTED') ORDER BY s.decided_at DESC LIMIT 200");
    else rows = this.db.all(`SELECT * FROM sessions WHERE status IN ('REFER','REFER_RESUBMITTED','PENDING_CHECKER','PENDING_CUSTOMER_INFO')`);
    let items = rows.map((r) => this.item(r, viewer));
    if (view === "checker") items = items.filter((i) => i.status === "PENDING_CHECKER");
    if (view === "mine") items = items.filter((i) => i.assignee?.id === viewer.id);
    if (view !== "done") {
      const rank = (i: (typeof items)[number]) => (i.status === "REFER_RESUBMITTED" ? 0 : i.sla.state === "BREACHED" || i.sla.state === "DUE_SOON" ? 1 : 2);
      items.sort((a, b) => rank(a) - rank(b) || b.sla.elapsed_hours - a.sla.elapsed_hours);
    }
    const open = items.filter((i) => i.status !== "PENDING_CUSTOMER_INFO");
    return {
      items,
      stats: view === "done" ? undefined : {
        open: open.length,
        due_soon: open.filter((i) => i.sla.state === "DUE_SOON").length,
        breached: open.filter((i) => i.sla.state === "BREACHED").length,
        checker: items.filter((i) => i.status === "PENDING_CHECKER").length,
      },
    };
  }

  /** GET /cases/:id – ghi CASE_VIEW; phần sàng lọc chỉ cho Compliance (VIEW_SENSITIVE) */
  caseDetail(id: string, viewer: Staff, opts: { pii?: boolean } = {}) {
    const s = this.session(id), cfg = this.cfg();
    if (s.queued_at == null) throw new ApiError(404, "NOT_FOUND", "Hồ sơ không thuộc hàng đợi xét duyệt");
    const canSensitive = viewer.role !== "CS";
    if (opts.pii && !canSensitive) throw new ApiError(403, "FORBIDDEN", "Vai trò không được xem dữ liệu cá nhân đầy đủ");
    // Mỗi lần mở đều ghi; tải lại trong cùng 1 phút (sau thao tác) không ghi trùng
    const recent = (action: string) => !!this.db.get("SELECT 1 FROM audit_event WHERE session_id = ? AND actor_id = ? AND action = ? AND created_at > ?", id, viewer.id, action, clock.now() - 60_000);
    if (opts.pii) this.audit(id, viewer, "VIEW_PII");
    else if (!recent("CASE_VIEW")) {
      this.audit(id, viewer, "CASE_VIEW");
      if (canSensitive) this.audit(id, viewer, "VIEW_SENSITIVE");
    }
    const ocr = j<Row | null>(s.ocr_json, null), chip = j<Row | null>(s.chip_json, null)?.dg1 ?? null;
    const show = (v: Row | null) => v && {
      full_name: opts.pii ? v.full_name : maskName(v.full_name),
      id_number: v.id_number ? (opts.pii ? v.id_number : maskIdNumber(v.id_number)) : null,
      passport_no: v.passport_no ? (opts.pii ? v.passport_no : maskPassportNo(v.passport_no)) : null,
      nationality: v.nationality ?? null, dob: v.dob, expiry: v.expiry,
    };
    const deviceIds = this.velocityCount("device_ids", s.device_id, 30 * D, true);
    return {
      ...this.item(s, viewer),
      full_name: opts.pii ? s.full_name : undefined,
      product: s.product,
      document: { ocr: show(ocr), chip: show(chip), chip_verified: !!s.chip_verified, mismatch: ocr && chip ? ocrChipMismatch(ocr as any, chip as any) : [], expiry: s.doc_expiry, purged: !!s.purged_at },
      biometric: { liveness: s.liveness, face_match: s.face_match, match_source: s.match_source, pass: cfg.liveness_pass, borderline: cfg.liveness_fail },
      screening: canSensitive ? { risk_score: s.risk_score, pep: !!s.pep, sanction: !!s.sanction, cic: j(s.cic_json, null) } : null,
      device: { model: s.device_model, rooted: !!s.device_rooted, other_ids_30d: Math.max(0, deviceIds - 1) },
      needs_checker: needsChecker({ pep: !!s.pep, sanction: !!s.sanction, riskScore: s.risk_score ?? 0 }, cfg),
      info_requests: this.db.all("SELECT id, items_json, message, requested_by, requested_at, deadline_at, status, fulfilled_at FROM info_requests WHERE session_id = ? ORDER BY id", id)
        .map((r) => ({ ...r, items: j(r.items_json, []), items_json: undefined })),
      history: this.history(id),
      limits: { max_info_requests: cfg.max_info_requests, info_deadline_days: cfg.info_deadline_days },
    };
  }
  history(id: string) {
    return this.db.all(`SELECT a.id, a.action, a.actor_id, a.role, a.reason, a.before_after, a.created_at, st.name AS actor_name
      FROM audit_event a LEFT JOIN staff st ON st.id = a.actor_id WHERE a.session_id = ? ORDER BY a.id DESC`, id)
      .map((a) => ({ ...a, before_after: j(a.before_after, null) }));
  }

  /** POST /cases/:id/claim – một hồ sơ chỉ một người giữ (RULE-EKYC-12) */
  claim(id: string, viewer: Staff) {
    if (viewer.role === "CS") throw new ApiError(403, "FORBIDDEN", "Vai trò CS không xử lý hồ sơ");
    const s = this.session(id), now = clock.now();
    if (!inList(s.status, ["REFER", "REFER_RESUBMITTED"])) throw new ApiError(409, "INVALID_STATE", "Hồ sơ không ở trạng thái chờ xử lý");
    if (s.assignee_id && s.assignee_id !== viewer.id) throw new ApiError(409, "ALREADY_CLAIMED", "Hồ sơ đang do người khác xử lý");
    this.db.patchSession(id, { assignee_id: viewer.id, claimed_at: now, staff_activity_at: now });
    this.audit(id, viewer, "CASE_CLAIM");
    return this.item(this.session(id), viewer);
  }
  release(id: string, viewer: Staff) {
    const s = this.session(id);
    if (s.assignee_id !== viewer.id && viewer.role !== "LEAD") throw new ApiError(403, "FORBIDDEN", "Chỉ người giữ hồ sơ hoặc trưởng nhóm mới nhả được");
    this.db.patchSession(id, { assignee_id: null, claimed_at: null });
    this.audit(id, viewer, "CASE_RELEASE");
    return this.item(this.session(id), viewer);
  }
  private requireAssignee(s: Row, viewer: Staff) {
    if (s.assignee_id !== viewer.id) throw new ApiError(403, "NOT_ASSIGNEE", "Cần nhận xử lý hồ sơ trước khi thao tác");
  }

  /** POST /cases/:id/info-requests – C07 */
  requestInfo(id: string, viewer: Staff, input: { items: string[]; message?: string }) {
    const s = this.session(id), cfg = this.cfg(), now = clock.now();
    this.requireAssignee(s, viewer);
    if (!inList(s.status, ["REFER", "REFER_RESUBMITTED"])) throw new ApiError(409, "INVALID_STATE", "Không yêu cầu bổ sung được ở trạng thái này");
    if (s.info_request_count >= cfg.max_info_requests) throw new ApiError(409, "LIMIT_REACHED", `Đã yêu cầu bổ sung tối đa ${cfg.max_info_requests} lần`);
    const items = (input?.items ?? []).filter((x): x is InfoItem => (INFO_ITEMS as readonly string[]).includes(x));
    if (!items.length) throw new ApiError(422, "VALIDATION", "Chọn ít nhất 1 hạng mục cần bổ sung");
    if (items.includes("OTHER") && !input.message?.trim()) throw new ApiError(422, "VALIDATION", "Hạng mục Khác cần lời nhắn");
    if (input.message && FORBIDDEN_MESSAGE.test(input.message)) throw new ApiError(422, "FORBIDDEN_CONTENT", "Lời nhắn không được nhắc PEP, AML, CIC");
    const deadline = now + cfg.info_deadline_days * D;
    const r = this.db.run("INSERT INTO info_requests (session_id, items_json, message, requested_by, requested_at, deadline_at, status) VALUES (?, ?, ?, ?, ?, ?, 'OPEN')",
      id, JSON.stringify(items), input.message ?? null, viewer.id, now, deadline);
    this.db.patchSession(id, { status: "PENDING_CUSTOMER_INFO", info_request_count: s.info_request_count + 1, sla_paused_at: now, staff_activity_at: now, assignee_id: null, resubmitted: 0 });
    this.audit(id, viewer, "INFO_REQUESTED", { after: { items, message: input.message ?? null } });
    this.event("ekyc.info.requested", id, { items });
    this.notify(id, "EKYC_INFO_REQUESTED", ["PUSH", "SMS"], s.phone, { items, deadline_at: deadline, deep_link: `aegis://ekyc/info-request/${r.lastInsertRowid}` });
    return this.item(this.session(id), viewer);
  }

  /** POST /cases/:id/decision – Maker (C10) */
  makerDecision(id: string, viewer: Staff, input: { decision: "APPROVE" | "REJECT"; reason?: string; note?: string }) {
    const s = this.session(id), cfg = this.cfg();
    this.requireAssignee(s, viewer);
    if (!inList(s.status, ["REFER", "REFER_RESUBMITTED"])) throw new ApiError(409, "INVALID_STATE", "Hồ sơ không chờ quyết định của Maker");
    if (input?.decision === "REJECT") {
      if (!input.reason?.trim()) throw new ApiError(422, "VALIDATION", "Từ chối cần lý do nội bộ");
      this.finalReject(id, "MANUAL_REJECT", viewer, s.phone, `${input.reason}${input.note ? " · " + input.note : ""}`);
      return this.item(this.session(id), viewer);
    }
    if (input?.decision !== "APPROVE") throw new ApiError(422, "VALIDATION", "decision phải là APPROVE hoặc REJECT");
    if (needsChecker({ pep: !!s.pep, sanction: !!s.sanction, riskScore: s.risk_score ?? 0 }, cfg)) {
      this.db.patchSession(id, { status: "PENDING_CHECKER", pending_maker_id: viewer.id, assignee_id: null, staff_activity_at: clock.now() });
      this.audit(id, viewer, "DECISION_APPROVE", { after: "PENDING_CHECKER", reason: input.note });
      this.notify(null, "CHECKER_REQUESTED", ["INTERNAL"], null, { session_id: id, maker: viewer.name });
      return this.item(this.session(id), viewer);
    }
    this.approve(id, "APPROVED", viewer, viewer.id, null, input.note);
    return this.item(this.session(id), viewer);
  }

  /** POST /cases/:id/checker – Checker khác Maker (RULE-EKYC-13) */
  checkerDecision(id: string, viewer: Staff, input: { decision: "APPROVE" | "RETURN"; reason?: string }) {
    const s = this.session(id);
    if (viewer.role === "CS") throw new ApiError(403, "FORBIDDEN", "Vai trò CS không phê duyệt");
    if (s.status !== "PENDING_CHECKER") throw new ApiError(409, "INVALID_STATE", "Hồ sơ không chờ Checker");
    if (s.pending_maker_id === viewer.id) {
      this.audit(id, viewer, "CHECKER_BLOCKED_SAME_PERSON");
      throw new ApiError(403, "MAKER_CHECKER_SAME", "Checker phải là người khác Maker");
    }
    if (input?.decision === "RETURN") {
      if (!input.reason?.trim()) throw new ApiError(422, "VALIDATION", "Trả lại cần lý do");
      this.db.patchSession(id, { status: "REFER", assignee_id: s.pending_maker_id, pending_maker_id: null, staff_activity_at: clock.now() });
      this.audit(id, viewer, "CHECKER_RETURN", { reason: input.reason });
      return this.item(this.session(id), viewer);
    }
    if (input?.decision !== "APPROVE") throw new ApiError(422, "VALIDATION", "decision phải là APPROVE hoặc RETURN");
    this.approve(id, "APPROVED", viewer, s.pending_maker_id, viewer.id);
    return this.item(this.session(id), viewer);
  }

  /** POST /cases/:id/cic-retry – tra cứu lại CIC khi lần đầu quá thời gian */
  async retryCic(id: string, viewer: Staff) {
    const s = this.session(id);
    if (viewer.role === "CS") throw new ApiError(403, "FORBIDDEN", "Không đủ quyền");
    const idNumber = screeningKey(j<Row>(s.ocr_json, {}));
    try {
      const cic = await cicLookup(idNumber);
      const aml = { pep: !!s.pep, sanction: !!s.sanction, hits: 0 };
      const risk = riskScore(idNumber, cic, aml);
      const reasons = j<string[]>(s.reasons_json, []).filter((r) => r !== "CIC_TIMEOUT");
      this.db.patchSession(id, { cic_json: JSON.stringify(cic), risk_score: risk, reasons_json: JSON.stringify(reasons) });
      this.audit(id, viewer, "CIC_RETRY", { after: cic });
      return { ok: true, cic, risk_score: risk };
    } catch (e) {
      if (!(e instanceof AdapterError)) throw e;
      this.audit(id, viewer, "CIC_RETRY", { reason: e.code });
      throw new ApiError(503, "CIC_UNAVAILABLE", "CIC vẫn chưa phản hồi, thử lại sau");
    }
  }

  /* ================= Cấu hình ngưỡng – hai người (NFR-SEC-05) ================= */
  configView() {
    const cfg = this.cfg();
    const pending = this.db.all(`SELECT c.*, st.name AS requested_by_name FROM config_changes c LEFT JOIN staff st ON st.id = c.requested_by WHERE c.status = 'PENDING' ORDER BY c.id DESC`);
    const recent = this.db.all(`SELECT c.*, a.name AS requested_by_name, b.name AS approved_by_name FROM config_changes c
      LEFT JOIN staff a ON a.id = c.requested_by LEFT JOIN staff b ON b.id = c.approved_by WHERE c.status <> 'PENDING' ORDER BY c.id DESC LIMIT 20`);
    return { values: cfg, bounds: CONFIG_BOUNDS, pending, recent };
  }
  requestConfigChange(viewer: Staff, input: { key: string; value: unknown; reason?: string }) {
    if (viewer.role === "CS") throw new ApiError(403, "FORBIDDEN", "Không đủ quyền");
    const cfg = this.cfg();
    if (!(input?.key in DEFAULT_CONFIG)) throw new ApiError(422, "VALIDATION", "Tham số không tồn tại");
    const key = input.key as ConfigKey, cur = cfg[key];
    let value: unknown = input.value;
    if (typeof cur === "number") {
      value = Number(value);
      const b = CONFIG_BOUNDS[key];
      if (!Number.isFinite(value) || (b && ((value as number) < b[0] || (value as number) > b[1]))) throw new ApiError(422, "OUT_OF_RANGE", `Giá trị phải trong khoảng ${b?.[0]}–${b?.[1]}`);
    }
    if (!input.reason || input.reason.trim().length < 10) throw new ApiError(422, "VALIDATION", "Lý do thay đổi tối thiểu 10 ký tự");
    if (JSON.stringify(value) === JSON.stringify(cur)) throw new ApiError(422, "VALIDATION", "Giá trị mới giống giá trị hiện tại");
    const r = this.db.run("INSERT INTO config_changes (key, old_value, new_value, reason, requested_by, status, created_at) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)",
      key, JSON.stringify(cur), JSON.stringify(value), input.reason, viewer.id, clock.now());
    this.audit(null, viewer, "CONFIG_CHANGE_REQUESTED", { before: { [key]: cur }, after: { [key]: value }, reason: input.reason });
    return { id: Number(r.lastInsertRowid), status: "PENDING" };
  }
  decideConfigChange(viewer: Staff, changeId: number, approve: boolean) {
    const c = this.db.get("SELECT * FROM config_changes WHERE id = ?", changeId);
    if (!c || c.status !== "PENDING") throw new ApiError(404, "NOT_FOUND", "Không có đề xuất chờ duyệt");
    if (viewer.role !== "LEAD") throw new ApiError(403, "FORBIDDEN", "Chỉ trưởng nhóm Compliance phê duyệt cấu hình");
    if (c.requested_by === viewer.id) throw new ApiError(403, "MAKER_CHECKER_SAME", "Người đề xuất không được tự phê duyệt");
    this.db.tx(() => {
      this.db.run("UPDATE config_changes SET status = ?, approved_by = ?, decided_at = ? WHERE id = ?", approve ? "APPROVED" : "REJECTED", viewer.id, clock.now(), changeId);
      if (approve) this.db.run("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", c.key, c.new_value);
      this.audit(null, viewer, approve ? "CONFIG_CHANGE_APPROVED" : "CONFIG_CHANGE_REJECTED", { before: { [c.key]: JSON.parse(c.old_value) }, after: { [c.key]: JSON.parse(c.new_value) } });
    });
    return this.configView();
  }

  /* ================= Báo cáo (C09, C18) ================= */
  slaReport(days = 7) {
    const cfg = this.cfg(), now = clock.now(), since = now - days * D;
    const decided = this.db.all("SELECT * FROM sessions WHERE queued_at IS NOT NULL AND decided_at >= ? AND status IN ('APPROVED','REJECTED')", since);
    const hours = decided.map((s) => slaElapsedMs(s as any, now) / H).sort((a, b) => a - b);
    const median = hours.length ? (hours.length % 2 ? hours[(hours.length - 1) / 2] : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2) : null;
    const within = hours.filter((h) => h <= cfg.sla_hours).length;
    const byStaff = this.db.all(`SELECT st.name, COUNT(*) AS n FROM kyc_decisions d JOIN staff st ON st.id = COALESCE(d.checker_id, d.decided_by)
      WHERE d.decided_at >= ? GROUP BY st.name ORDER BY n DESC`, since);
    const open = this.listCases({ id: "system", name: "system", role: "LEAD" }).stats!;
    const perDay: { day: string; total: number; within: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - i * D;
      const ds = decided.filter((s) => s.decided_at >= start && s.decided_at < start + D);
      perDay.push({ day: new Date(start).toISOString().slice(0, 10), total: ds.length, within: ds.filter((s) => slaElapsedMs(s as any, now) / H <= cfg.sla_hours).length });
    }
    return {
      period_days: days, decided: decided.length, within_sla: within, sla_rate: decided.length ? within / decided.length : null,
      median_hours: median, breaches: decided.filter((s) => slaElapsedMs(s as any, now) / H > cfg.sla_hours).length + open.breached,
      escalated: this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE escalated_at >= ?", since)?.n ?? 0,
      open, by_staff: byStaff, per_day: perDay,
    };
  }
  kpi(days = 30) {
    const since = clock.now() - days * D;
    const all = this.db.all("SELECT status, last_step, match_source, reasons_json, customer_reason, queued_at, info_request_count FROM sessions WHERE created_at >= ?", since);
    const decidedSt = ["STP_APPROVED", "APPROVED", "REJECTED"];
    const decided = all.filter((s) => decidedSt.includes(s.status) || inList(s.status, IN_QUEUE));
    const stp = all.filter((s) => s.status === "STP_APPROVED").length;
    const reached = (steps: string[]) => all.filter((s) => steps.includes(s.last_step ?? "") || decidedSt.includes(s.status) || inList(s.status, IN_QUEUE)).length;
    const reasons: Record<string, number> = {};
    for (const s of all) for (const r of j<string[]>(s.reasons_json, [])) reasons[r] = (reasons[r] ?? 0) + 1;
    const rejects: Record<string, number> = {};
    for (const s of all.filter((x) => x.status === "REJECTED")) rejects[s.customer_reason ?? "?"] = (rejects[s.customer_reason ?? "?"] ?? 0) + 1;
    const withMatch = all.filter((s) => s.match_source);
    const infoReq = all.filter((s) => s.info_request_count > 0);
    return {
      period_days: days,
      sessions: all.length,
      stp_rate: decided.length ? stp / decided.length : null,
      completion_rate: all.length ? decided.length / all.length : null,
      funnel: {
        CREATED: all.length,
        CONSENTED: reached(["CONSENTED", "DOC_CAPTURED", "LIVENESS_DONE"]),
        DOC_CAPTURED: reached(["DOC_CAPTURED", "LIVENESS_DONE"]),
        LIVENESS_DONE: reached(["LIVENESS_DONE"]),
        DECIDED: decided.length,
      },
      refer_reasons: reasons, reject_reasons: rejects,
      nfc_fallback_rate: withMatch.length ? withMatch.filter((s) => s.match_source === "OCR_FRONT").length / withMatch.length : null,
      rescue_rate: infoReq.length ? infoReq.filter((s) => s.status === "APPROVED").length / infoReq.length : null,
      velocity_hits: this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE type = 'ekyc.fraud.velocity_hit' AND created_at >= ?", since)?.n ?? 0,
    };
  }
}
