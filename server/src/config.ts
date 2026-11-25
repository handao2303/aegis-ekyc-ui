/* Tham số cấu hình – mọi giá trị đều đổi được qua màn Cấu hình ngưỡng (C10, NFR-SEC-05).
   Nguồn: C05 (tuổi, hạn), C06 (T1/T2), C07 (bổ sung), C09 (SLA), C10 (Checker), C13 (velocity), C11 (ngưỡng sinh trắc). */
export const DEFAULT_CONFIG = {
  // C05 – RULE-EKYC-10
  // 16: người dưới 16 tuổi là trẻ em (Luật Trẻ em 2016); Luật 91/2025 Điều 19 – kênh trực tuyến chưa có luồng người đại diện (P01 PR-02)
  min_age_payment: 16,
  min_age_credit: 18,
  expiry_warning_days: 30,
  // C04 – RULE-EKYC-09
  prior_rejection_days: 30,
  // C06 – RULE-EKYC-11
  abandon_after_minutes: 30,
  expire_after_days: 7,
  // C07
  max_info_requests: 2,
  info_deadline_days: 5,
  // C09 – RULE-EKYC-12
  sla_hours: 24,
  sla_warning_hours: 16,
  sla_escalation_hours: 20,
  claim_release_hours: 2,
  // C10 – RULE-EKYC-13
  checker_risk_score: 70,
  // Cây quyết định (A01 §4)
  risk_refer_score: 50,
  risk_reject_score: 80,
  liveness_pass: 0.85,
  liveness_fail: 0.7,
  face_match_pass: 0.85,
  face_match_fail: 0.7,
  sanction_action: "REFER" as "REFER" | "REJECT",
  max_capture_failures: 3,
  // C13 – RULE-EKYC-16
  velocity_device_sessions_24h: 3,
  velocity_phone_sessions_24h: 3,
  velocity_device_ids_30d: 2,
  velocity_liveness_failures_24h: 5,
  // C12 – thời hạn lưu (chờ C02 chốt)
  retention_withdrawn_hours: 24,
  retention_rejected_days: 1825,
  // CMS điều khoản (IF-02)
  terms_version: "2026.11",
};

export type Config = typeof DEFAULT_CONFIG;
export type ConfigKey = keyof Config;

/** Giới hạn hợp lệ cho từng tham số số – chặn giá trị vô lý khi đổi cấu hình */
export const CONFIG_BOUNDS: Partial<Record<ConfigKey, [number, number]>> = {
  min_age_payment: [16, 25], // không cho hạ dưới 16 tới khi có luồng người đại diện theo pháp luật min_age_credit: [18, 25], expiry_warning_days: [0, 180], prior_rejection_days: [0, 365],
  abandon_after_minutes: [5, 240], expire_after_days: [1, 30], max_info_requests: [1, 5], info_deadline_days: [1, 30],
  sla_hours: [1, 168], sla_warning_hours: [1, 168], sla_escalation_hours: [1, 168], claim_release_hours: [1, 24],
  checker_risk_score: [0, 100], risk_refer_score: [0, 100], risk_reject_score: [0, 100],
  liveness_pass: [0, 1], liveness_fail: [0, 1], face_match_pass: [0, 1], face_match_fail: [0, 1], max_capture_failures: [1, 10],
  velocity_device_sessions_24h: [1, 50], velocity_phone_sessions_24h: [1, 50], velocity_device_ids_30d: [2, 10], velocity_liveness_failures_24h: [1, 50],
  retention_withdrawn_hours: [1, 72], retention_rejected_days: [1, 3650],
};
