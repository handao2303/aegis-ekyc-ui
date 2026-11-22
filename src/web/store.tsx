/* Nguồn dữ liệu cho Aegis Compliance.
   Có ekyc-service: đọc/ghi qua API (mọi quy tắc SLA, Maker-Checker, audit do backend thực thi).
   Không có: dùng dữ liệu mẫu trong data.ts như bản demo cũ. */
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, backendAvailable, fmtTime, type CaseDetail, type CaseItem, type Staff } from "../ekyc/api";
import { CASES, ME, type Case, type CaseStatus, type ReasonCode } from "./data";

const DEMO_STAFF: Staff = { id: "demo", name: ME, role: "OFFICER" };
const LS_ME = "aegis.staff";

const STATUS_MAP: Record<string, CaseStatus> = {
  REFER_RESUBMITTED: "resubmitted", PENDING_CHECKER: "pending_checker", PENDING_CUSTOMER_INFO: "pending_customer",
};

export function toCase(i: CaseItem): Case {
  return {
    id: i.id,
    name: i.name_masked,
    masked: i.name_masked,
    dob: i.dob_year ?? "—",
    hours: i.sla.elapsed_hours,
    risk: i.risk_score ?? 0,
    reasons: i.reasons as ReasonCode[],
    status: STATUS_MAP[i.status] ?? (i.assignee ? "in_progress" : "new"),
    assignee: i.status === "PENDING_CHECKER" ? i.pending_maker?.name : i.assignee?.name,
    device: i.device ?? "—",
    nfc: i.nfc,
    liveness: i.liveness ?? 0,
    faceMatch: i.face_match ?? 0,
    matchSource: i.match_source ?? "OCR_FRONT",
    requestCount: i.info_request_count,
    decision: i.decision ? { type: i.decision.decision === "REJECTED" ? "rejected" : "approved", by: i.decision.by, at: fmtTime(i.decision.at) } : undefined,
    live: i,
  };
}

type Act = (c: Case) => Promise<string | null>;
type Store = {
  live: boolean | null;
  me: Staff;
  staffList: Staff[];
  setMe: (id: string) => void;
  cases: Case[];
  stats: { open: number; due_soon: number; breached: number; checker: number } | null;
  refresh: () => Promise<void>;
  /** Patch cục bộ cho chế độ demo */
  update: (id: string, p: Partial<Case>) => void;
  loadDetail: (id: string, pii?: boolean) => Promise<CaseDetail | null>;
  act: {
    claim: Act;
    release: Act;
    requestInfo: (c: Case, items: string[], message: string) => Promise<string | null>;
    approve: (c: Case, note: string) => Promise<string | null>;
    reject: (c: Case, reason: string, note: string) => Promise<string | null>;
    checker: (c: Case, approve: boolean, reason?: string) => Promise<string | null>;
    retryCic: Act;
  };
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
};

const Ctx = createContext<Store | null>(null);
export const useCaseStore = () => useContext(Ctx)!;

export function CaseStoreProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<boolean | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([DEMO_STAFF]);
  const [meId, setMeId] = useState<string>(() => { try { return localStorage.getItem(LS_ME) ?? "u-anh"; } catch { return "u-anh"; } });
  const [cases, setCases] = useState<Case[]>(CASES);
  const [stats, setStats] = useState<Store["stats"]>(null);
  const me = live ? staffList.find((s) => s.id === meId) ?? staffList[0] : DEMO_STAFF;
  const hdr = useMemo(() => ({ "x-staff-id": me.id }), [me.id]);

  const get = useCallback(<T,>(path: string) => api<T>("GET", path, undefined, hdr), [hdr]);
  const post = useCallback(<T,>(path: string, body?: unknown) => api<T>("POST", path, body ?? {}, hdr), [hdr]);

  useEffect(() => {
    backendAvailable().then(async (ok) => {
      if (ok) {
        try {
          const meta = await api<{ staff: Staff[] }>("GET", "/api/meta");
          setStaffList(meta.staff);
        } catch { ok = false; }
      }
      setLive(ok);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!live) return;
    const q = await get<{ items: CaseItem[]; stats: Store["stats"] }>("/api/cases?view=queue");
    const done = await get<{ items: CaseItem[] }>("/api/cases?view=done");
    setCases([...q.items, ...done.items].map(toCase));
    setStats(q.stats);
  }, [live, get]);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  // Tự làm mới mỗi 20 giây để thấy hồ sơ mới từ app khách
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => refresh().catch(() => {}), 20_000);
    return () => clearInterval(t);
  }, [live, refresh]);

  const update = useCallback((id: string, p: Partial<Case>) => setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c))), []);
  const setMe = (id: string) => { setMeId(id); try { localStorage.setItem(LS_ME, id); } catch { /* bỏ qua */ } };

  /** Bọc hành động live: gọi API rồi làm mới; trả về thông báo lỗi (nếu có) */
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try { await fn(); await refresh(); return null; } catch (e) { await refresh().catch(() => {}); return (e as Error).message; }
  }, [refresh]);

  const act: Store["act"] = {
    claim: (c) => live ? run(() => post(`/api/cases/${c.id}/claim`)) : (update(c.id, { assignee: ME, status: c.status === "resubmitted" ? "resubmitted" : "in_progress" }), Promise.resolve(null)),
    release: (c) => live ? run(() => post(`/api/cases/${c.id}/release`)) : (update(c.id, { assignee: undefined, status: "new" }), Promise.resolve(null)),
    requestInfo: (c, items, message) => live
      ? run(() => post(`/api/cases/${c.id}/info-requests`, { items, message: message || undefined }))
      : (update(c.id, { status: "pending_customer", requestCount: c.requestCount + 1 }), Promise.resolve(null)),
    approve: (c, note) => {
      const needs = c.reasons.includes("PEP_MATCH") || c.reasons.includes("SANCTION_MATCH") || c.risk >= 70;
      if (live) return run(() => post(`/api/cases/${c.id}/decision`, { decision: "APPROVE", note: note || undefined }));
      update(c.id, needs ? { status: "pending_checker" } : { decision: { type: "approved", by: ME, at: fmtTime(Date.now()) } });
      return Promise.resolve(null);
    },
    reject: (c, reason, note) => live
      ? run(() => post(`/api/cases/${c.id}/decision`, { decision: "REJECT", reason, note: note || undefined }))
      : (update(c.id, { decision: { type: "rejected", by: ME, at: fmtTime(Date.now()) } }), Promise.resolve(null)),
    checker: (c, approve, reason) => live
      ? run(() => post(`/api/cases/${c.id}/checker`, approve ? { decision: "APPROVE" } : { decision: "RETURN", reason }))
      : (update(c.id, approve ? { decision: { type: "approved", by: ME, at: fmtTime(Date.now()) } } : { status: "in_progress" }), Promise.resolve(null)),
    retryCic: (c) => live ? run(() => post(`/api/cases/${c.id}/cic-retry`)) : Promise.resolve(null),
  };

  const loadDetail = useCallback(async (id: string, pii = false) => {
    if (!live) return null;
    return get<CaseDetail>(`/api/cases/${id}${pii ? "?pii=1" : ""}`);
  }, [live, get]);

  const value: Store = { live, me, staffList, setMe, cases, stats, refresh, update, loadDetail, act, get, post };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Đổi người dùng để thử Maker-Checker (chỉ bản UAT có backend) */
export function StaffSwitcher() {
  const s = useCaseStore();
  if (!s.live) return null;
  const ROLE = { OFFICER: "Compliance Officer", LEAD: "Trưởng nhóm Compliance", CS: "CS / Vận hành" };
  return (
    <label className="block px-2 pt-2">
      <span className="text-caption font-semibold text-fg-tertiary">Đăng nhập UAT với vai trò</span>
      <select value={s.me.id} onChange={(e) => s.setMe(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-line-strong bg-bg-surface px-2 text-body-sm outline-none focus:border-action focus:ring-4 focus:ring-focus">
        {s.staffList.map((st) => <option key={st.id} value={st.id}>{st.name} · {ROLE[st.role]}</option>)}
      </select>
    </label>
  );
}

export const initials = (name: string) => name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase();
export const roleLabel = (r: Staff["role"]) => ({ OFFICER: "Compliance Officer", LEAD: "Trưởng nhóm Compliance", CS: "CS / Vận hành" })[r];
