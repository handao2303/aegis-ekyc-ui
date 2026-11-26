/* Tham số cấu hình (R05 §3.9). Mọi giá trị có giới hạn để chặn cấu hình vô lý (OUT_OF_RANGE). */
export const DEFAULT_CONFIG = {
  /** RULE-REC-04 – đơn vị 1/100 VND. Giữ 50 triệu tới khi CR-002 được duyệt (ASM-07, DEC-01) */
  gl_threshold_minor: 50_000_000_00,
  /** RULE-REC-06 – giờ từ lúc mở tới khi tự leo thang [D-REC-03] */
  escalation_after_hours: 72,
  /** RULE-REC-01, REQ-REC-16 */
  fuzzy_threshold: 0.95,
  fuzzy_gap: 0.02,
  /** Điểm tối thiểu để coi là ứng viên PARTIAL (thấp hơn → UNMATCHED). Đề xuất của BA */
  partial_floor: 0.6,
  /** RULE-REC-03, REQ-REC-15 */
  n1_timeout_ms: 2000,
  n1_max_items: 20,
  /** REQ-REC-01, 05, 06 */
  min_note_length: 10,
  /** KPI-05, D-REC-07 */
  zero_touch_target_pct: 30,
  /** Tài khoản GL mặc định cho bút toán tự động – ví dụ, Kế toán trưởng cung cấp danh mục thật (R05 §9 câu 3) */
  gl_settlement_debit: "1131.02",
  gl_settlement_credit: "4211.01",
  gl_limit_debit: "1131.04",
  gl_limit_credit: "4211.09",
};

export type Config = typeof DEFAULT_CONFIG;
export type ConfigKey = keyof Config;

export const CONFIG_BOUNDS: Partial<Record<ConfigKey, [number, number]>> = {
  gl_threshold_minor: [1_000_000_00, 1_000_000_000_00],
  escalation_after_hours: [1, 720],
  fuzzy_threshold: [0.8, 1],
  fuzzy_gap: [0, 0.1],
  partial_floor: [0.3, 0.95],
  n1_timeout_ms: [100, 10_000],
  n1_max_items: [2, 200],
  min_note_length: [10, 200],
  zero_touch_target_pct: [0, 100],
};
