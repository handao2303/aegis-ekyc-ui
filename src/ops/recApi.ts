/* Kết nối reconciliation-service (services/reconciliation, R05).
   - Chạy local (localhost, IP nội bộ): tự dùng http://<cùng máy>:8788/api/v1/rec
   - ?rec-api=<url> chỉ định riêng; ?api=off tắt mọi backend, ?api=on bật lại (dùng chung lựa chọn với eKYC)
   - Không có backend (GitHub Pages) → UI giữ chế độ demo với dữ liệu mẫu */
import { useCallback, useEffect, useState } from "react";

const PRIVATE = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/;

export function recBase(): string | null {
  if (typeof window === "undefined") return null;
  const qs = new URLSearchParams(window.location.search);
  const explicit = qs.get("rec-api");
  if (explicit) return explicit.replace(/\/$/, "");
  let off = qs.get("api") === "off";
  try {
    if (qs.get("api") === "on") localStorage.removeItem("aegis.api");
    off ||= localStorage.getItem("aegis.api") === "off";
  } catch { /* storage bị chặn */ }
  if (off) return null;
  const { hostname, protocol } = window.location;
  return PRIVATE.test(hostname) && protocol === "http:" ? `http://${hostname}:8788/api/v1/rec` : null;
}

export class RecApiError extends Error {
  status: number; code: string; extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

/** Người dùng UAT trên UI ↔ mã nhân viên trong service (thay cho SSO ở API Gateway) */
export const STAFF_ID: Record<string, string> = { "Lê Hoàng Nam": "u-nam", "Phạm Thu Trang": "u-trang", "Đỗ Minh Quân": "u-quan" };

export function recClient(base: string, staffName: string) {
  const staff = STAFF_ID[staffName] ?? "u-nam";
  const call = async <T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> => {
    let r: Response;
    try {
      r = await fetch(base + path, {
        method,
        headers: { "content-type": "application/json", "x-staff-id": staff, ...(method === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch { throw new RecApiError(0, "NETWORK", "Không kết nối được reconciliation-service"); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = (data as any).error ?? {}; throw new RecApiError(r.status, e.code ?? "ERROR", e.message ?? "Có lỗi xảy ra", e); }
    return data as T;
  };
  return {
    staff,
    get: <T = any>(p: string) => call<T>("GET", p),
    post: <T = any>(p: string, b?: unknown) => call<T>("POST", p, b ?? {}),
  };
}
export type RecClient = ReturnType<typeof recClient>;

/** Kiểm tra backend một lần khi tải trang (1,5 giây), trả về client hoặc null */
export function useRecBackend(staffName: string) {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const b = recBase();
    if (!b) { setBase(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    fetch(b + "/health", { signal: ctrl.signal }).then((r) => setBase(r.ok ? b : null)).catch(() => setBase(null)).finally(() => clearTimeout(t));
    return () => { clearTimeout(t); ctrl.abort(); };
  }, []);
  const client = base ? recClient(base, staffName) : null;
  return { checking: base === undefined, client };
}

/** Tải lại toàn bộ dữ liệu màn hình sau mỗi thao tác – đơn giản, luôn đúng với trạng thái server */
export function useRecData<T>(client: RecClient | null, load: (c: RecClient) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = client?.staff ?? null;
  const reload = useCallback(async () => {
    if (!client) return;
    try { setData(await load(client)); setError(null); } catch (e) { setError((e as Error).message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload };
}
