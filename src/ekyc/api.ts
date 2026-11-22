/* Kết nối ekyc-service.
   - Chạy local (localhost, IP mạng nội bộ): tự dùng http://<cùng máy>:8787
   - ?api=<url> để chỉ định, ?api=off để tắt; lựa chọn được nhớ trong trình duyệt
   - Không có backend (vd. GitHub Pages): app chạy chế độ demo như trước */

const KEY = "aegis.api";
const PRIVATE = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/;

export function apiBase(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("api");
  try {
    if (q === "off") { localStorage.setItem(KEY, "off"); return null; }
    if (q) { localStorage.setItem(KEY, q); return q.replace(/\/$/, ""); }
    const saved = localStorage.getItem(KEY);
    if (saved === "off") return null;
    if (saved) return saved;
  } catch { /* trình duyệt chặn storage */ }
  const { hostname, protocol } = window.location;
  return PRIVATE.test(hostname) && protocol === "http:" ? `http://${hostname}:8787` : null;
}

let probe: Promise<boolean> | null = null;
/** Kiểm tra backend một lần cho mỗi lần tải trang */
export function backendAvailable(): Promise<boolean> {
  if (probe) return probe;
  const base = apiBase();
  if (!base) return (probe = Promise.resolve(false));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  probe = fetch(base + "/health", { signal: ctrl.signal }).then((r) => r.ok).catch(() => false).finally(() => clearTimeout(t));
  return probe;
}

export class ApiErr extends Error {
  status: number; code: string; extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

export async function api<T = any>(method: "GET" | "POST", path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const base = apiBase();
  if (!base) throw new ApiErr(0, "OFFLINE", "Chưa kết nối backend");
  let r: Response;
  try {
    r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiErr(0, "NETWORK", "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = (data as any).error ?? {};
    throw new ApiErr(r.status, e.code ?? "ERROR", e.message ?? "Có lỗi xảy ra", e);
  }
  return data as T;
}

/* ---------- Kiểu dữ liệu trả về (khớp server/src/service.ts) ---------- */
export type SessionResult = {
  session_id: string; status: string; outcome: "approved" | "refer" | "rejected" | null; last_step: string | null;
  account_no: string | null; holder: string | null; reason: { code: string; message: string } | null;
  queued_at: number | null; decided_at: number | null;
  info_request: { id: number; items: string[]; message: string | null; deadline_at: number } | null;
};

export type Staff = { id: string; name: string; role: "OFFICER" | "LEAD" | "CS" };

export type CaseItem = {
  id: string; status: "REFER" | "REFER_RESUBMITTED" | "PENDING_CHECKER" | "PENDING_CUSTOMER_INFO" | "APPROVED" | "REJECTED";
  name_masked: string; dob_year: string | null; reasons: string[]; risk_score: number | null;
  sla: { state: "ON_TRACK" | "DUE_SOON" | "BREACHED" | "PAUSED" | "DONE"; elapsed_hours: number; limit_hours: number; warning_hours: number };
  assignee: Staff | null; pending_maker: Staff | null; resubmitted: boolean; info_request_count: number;
  device: string | null; nfc: boolean; liveness: number | null; face_match: number | null; match_source: "CHIP_DG2" | "OCR_FRONT" | null;
  queued_at: number | null; decided_at: number | null;
  decision: { decision: string; by: string; at: number } | null;
};

type DocView = { full_name: string; id_number: string; dob: string; expiry: string } | null;
export type CaseDetail = CaseItem & {
  full_name?: string;
  document: { ocr: DocView; chip: DocView; chip_verified: boolean; mismatch: string[]; expiry: string | null; purged: boolean };
  biometric: { liveness: number | null; face_match: number | null; match_source: string | null; pass: number; borderline: number };
  screening: null | { risk_score: number | null; pep: boolean; sanction: boolean; cic: { group?: number; score?: number; timeout?: boolean } | null };
  device: { model: string | null; rooted: boolean; other_ids_30d: number };
  needs_checker: boolean;
  info_requests: { id: number; items: string[]; message: string | null; requested_by: string; requested_at: number; deadline_at: number; status: string }[];
  history: { id: number; action: string; actor_id: string; actor_name: string | null; role: string; reason: string | null; created_at: number }[];
  limits: { max_info_requests: number; info_deadline_days: number };
};

export const fmtTime = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};
