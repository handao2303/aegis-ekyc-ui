/* Job nền (C06 §4, C07, C09, C12 §4). Mỗi job trả về số bản ghi bị ảnh hưởng và ghi job_runs. */
import { clock, D, H, type Row } from "./db.ts";
import type { EkycService } from "./service.ts";
import { customerSafeReason, slaElapsedMs } from "./rules.ts";

const SYS = { id: "system", role: "SYSTEM" };

export function runJobs(svc: EkycService) {
  const out: Record<string, number> = {};
  const jobs: [string, () => number][] = [
    ["session-abandon-scan", () => abandonScan(svc)],
    ["session-expire", () => expireSessions(svc)],
    ["info-request-deadline", () => infoDeadlines(svc)],
    ["claim-auto-release", () => releaseIdleClaims(svc)],
    ["sla-escalation", () => slaEscalation(svc)],
    ["retention", () => retention(svc)],
  ];
  for (const [name, fn] of jobs) {
    const n = fn();
    out[name] = n;
    if (n) svc.db.run("INSERT INTO job_runs (job, affected, ran_at) VALUES (?, ?, ?)", name, n, clock.now());
  }
  return out;
}

/** T1: phiên không thao tác quá 30 phút → ABANDONED (giữ last_step) */
export function abandonScan(svc: EkycService) {
  const cfg = svc.cfg();
  const rows = svc.db.all("SELECT id FROM sessions WHERE status IN ('CREATED','CONSENTED','DOC_CAPTURED','LIVENESS_DONE') AND last_activity_at < ?",
    clock.now() - cfg.abandon_after_minutes * 60_000);
  for (const r of rows) {
    svc.db.patchSession(r.id, { status: "ABANDONED" });
    svc.event("ekyc.session.abandoned", r.id);
  }
  return rows.length;
}

/** T2: ABANDONED quá 7 ngày → EXPIRED, xoá ảnh và dữ liệu chip */
export function expireSessions(svc: EkycService) {
  const cfg = svc.cfg(), now = clock.now();
  const rows = svc.db.all("SELECT id FROM sessions WHERE status = 'ABANDONED' AND last_activity_at < ?", now - cfg.expire_after_days * D);
  for (const r of rows) {
    // Xoá ảnh và dữ liệu chip ngay khi hết hạn (C06), chỉ giữ metadata ẩn danh cho funnel
    svc.db.patchSession(r.id, { status: "EXPIRED", decided_at: now, retention_until: now });
    svc.purgePersonalData(r.id);
    svc.audit(r.id, SYS, "DATA_PURGED", { reason: "EXPIRED" });
    svc.event("ekyc.session.expired", r.id);
  }
  return rows.length;
}

/** C07: nhắc trước 1 ngày; quá hạn → REJECTED NO_RESPONSE */
export function infoDeadlines(svc: EkycService) {
  const now = clock.now(), cfg = svc.cfg();
  let n = 0;
  for (const ir of svc.db.all("SELECT ir.*, s.phone FROM info_requests ir JOIN sessions s ON s.id = ir.session_id WHERE ir.status = 'OPEN'")) {
    if (ir.deadline_at <= now) {
      svc.db.run("UPDATE info_requests SET status = 'EXPIRED' WHERE id = ?", ir.id);
      svc.db.patchSession(ir.session_id, { status: "REJECTED", customer_reason: "NO_RESPONSE", decided_at: now, retention_until: now + cfg.retention_rejected_days * D, sla_paused_at: null });
      svc.db.run("INSERT INTO kyc_decisions (session_id, decision, decided_by, internal_reason, decided_at) VALUES (?, 'REJECTED', 'system', 'NO_RESPONSE', ?)", ir.session_id, now);
      svc.audit(ir.session_id, SYS, "AUTO_REJECTED", { reason: "NO_RESPONSE" });
      svc.notify(ir.session_id, "EKYC_EXPIRED", ["PUSH", "SMS"], ir.phone, customerSafeReason("NO_RESPONSE"));
      n++;
    } else if (!ir.reminded_at && ir.deadline_at - now <= D) {
      svc.db.run("UPDATE info_requests SET reminded_at = ? WHERE id = ?", now, ir.id);
      svc.notify(ir.session_id, "EKYC_INFO_REMINDER", ["PUSH"], ir.phone, { deadline_at: ir.deadline_at });
      n++;
    }
  }
  return n;
}

/** RULE-EKYC-12: tự nhả hồ sơ sau 2 giờ không thao tác */
export function releaseIdleClaims(svc: EkycService) {
  const cfg = svc.cfg();
  const rows = svc.db.all("SELECT id, assignee_id FROM sessions WHERE assignee_id IS NOT NULL AND status IN ('REFER','REFER_RESUBMITTED') AND COALESCE(staff_activity_at, claimed_at) < ?",
    clock.now() - cfg.claim_release_hours * H);
  for (const r of rows) {
    svc.db.patchSession(r.id, { assignee_id: null, claimed_at: null });
    svc.audit(r.id, SYS, "CASE_RELEASE", { reason: `auto: ${cfg.claim_release_hours}h không thao tác`, before: r.assignee_id });
  }
  return rows.length;
}

/** 20h → báo trưởng nhóm; 24h → ghi Breach */
export function slaEscalation(svc: EkycService) {
  const cfg = svc.cfg(), now = clock.now();
  let n = 0;
  for (const s of svc.db.all<Row>("SELECT * FROM sessions WHERE status IN ('REFER','REFER_RESUBMITTED','PENDING_CHECKER') AND decided_at IS NULL")) {
    const h = slaElapsedMs(s as any, now) / H;
    if (h >= cfg.sla_escalation_hours && !s.escalated_at) {
      svc.db.patchSession(s.id, { escalated_at: now });
      svc.audit(s.id, SYS, "SLA_ESCALATED", { reason: `${h.toFixed(1)}h` });
      svc.notify(s.id, "SLA_ESCALATION_LEAD", ["INTERNAL"], null, { hours: Math.round(h * 10) / 10 });
      n++;
    }
    if (h > cfg.sla_hours && !s.breached_at) {
      svc.db.patchSession(s.id, { breached_at: now });
      svc.audit(s.id, SYS, "SLA_BREACHED", { reason: `${h.toFixed(1)}h` });
      n++;
    }
  }
  return n;
}

/** C12: xoá/ẩn danh dữ liệu cá nhân khi quá retention_until */
export function retention(svc: EkycService) {
  const now = clock.now();
  const rows = svc.db.all("SELECT id FROM sessions WHERE retention_until IS NOT NULL AND retention_until < ? AND purged_at IS NULL", now);
  for (const r of rows) {
    svc.purgePersonalData(r.id);
    svc.audit(r.id, SYS, "DATA_PURGED");
  }
  // Bộ đếm velocity chỉ cần cửa sổ dài nhất (30 ngày, C13); quá hạn thì xoá vì key chứa số điện thoại / mã thiết bị
  svc.db.run("DELETE FROM velocity_events WHERE created_at < ?", now - 30 * D);
  return rows.length;
}
