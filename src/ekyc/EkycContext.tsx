/* Điều phối luồng eKYC của khách với ekyc-service.
   Mỗi lần chuyển màn đi qua transition(from, to): ở chế độ live sẽ gọi API tương ứng và
   quyết định màn tiếp theo theo kết quả backend; ở chế độ demo giữ nguyên hành vi cũ. */
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiErr, backendAvailable, type SessionResult } from "./api";
import { PERSONAS, findPersona, type Persona } from "../../server/src/personas";
import type { Outcome, ScreenKey } from "../mobile/screens";

type Sess = { id: string; token: string; terms: string };
type DocResp = { next: string; reason?: { code: string; message: string }; expiry?: string; warnings?: string[]; resume_session_id?: string; resume_token?: string | null };
type Resumable = { session_id: string; token: string; status: string; last_step: string; resume_screen: string; reconsent_required: boolean; expires_at: number } | null;

export type DocKind = "CCCD" | "PASSPORT";
type Ctx = {
  live: boolean | null;
  /** Loại giấy tờ khách chọn (eKYC-02); bản live lấy theo hồ sơ mẫu */
  docType: DocKind;
  chooseDocType: (t: DocKind) => void;
  persona: Persona;
  setPersona: (code: string) => void;
  session: Sess | null;
  result: SessionResult | null;
  doc: DocResp | null;
  resumable: Resumable;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  /** NfcScan báo đã đọc chip (true) hay bỏ qua (false) */
  chipRead: React.MutableRefObject<boolean>;
  /** Màn Đồng ý báo khách có chọn mục tuỳ chọn "Nhận ưu đãi" không */
  marketing: React.MutableRefObject<boolean>;
  /** Rút lại đồng ý (C12) – trả về thông điệp từ backend */
  withdraw: (scope: "identity" | "screening" | "marketing") => Promise<{ result: string; message: string } | null>;
  outcome: Outcome | null;
  transition: (from: ScreenKey, to: ScreenKey) => Promise<ScreenKey | null>;
  refreshResult: () => Promise<ScreenKey | null>;
  newDevice: () => void;
};

const EkycCtx = createContext<Ctx | null>(null);
export const useEkyc = () => useContext(EkycCtx);

const LS = { persona: "aegis.persona", install: "aegis.install", session: "aegis.session" };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const rand = () => Math.random().toString(36).slice(2, 8);

/** Mỗi trình duyệt là một "thiết bị" riêng để velocity (C13) không chặn nhau; TD-13 cố ý dùng chung máy */
function deviceFor(p: Persona, install: string) {
  if (p.code === "TD-13") return { id: p.device.id, phone: p.phone };
  let h = 0;
  for (const ch of install + p.code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { id: `${p.device.id}-${install}`, phone: p.phone.slice(0, 6) + String(h % 10000).padStart(4, "0") };
}

const outcomeScreen = (r: SessionResult): ScreenKey =>
  r.status === "PENDING_CUSTOMER_INFO" ? "requestInfo" : r.outcome === "approved" ? "approved" : r.outcome === "rejected" ? "rejected" : "refer";

export function EkycProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<boolean | null>(null);
  const [personaCode, setPersonaCode] = useState<string>(() => {
    if (typeof window === "undefined") return "TD-01";
    const q = new URLSearchParams(window.location.search).get("td");
    return (q && PERSONAS.some((p) => p.code === q.toUpperCase()) ? q.toUpperCase() : read(LS.persona)) ?? "TD-01";
  });
  const persona = findPersona(personaCode);
  const [install, setInstall] = useState(() => (typeof window === "undefined" ? "x" : read(LS.install) ?? (() => { const v = rand(); write(LS.install, v); return v; })()));
  const [session, setSession] = useState<Sess | null>(() => { const s = typeof window === "undefined" ? null : read(LS.session); return s ? JSON.parse(s) : null; });
  const [result, setResult] = useState<SessionResult | null>(null);
  const [doc, setDoc] = useState<DocResp | null>(null);
  const [resumable, setResumable] = useState<Resumable>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chipRead = useRef(true);
  const marketing = useRef(false);
  const [demoDoc, setDemoDoc] = useState<DocKind>("CCCD");
  const docType: DocKind = live ? persona.ocr.doc_type ?? "CCCD" : demoDoc;
  /** Đổi loại giấy tờ: bản live chuyển sang hồ sơ mẫu tương ứng nhưng giữ phiên đang làm */
  const chooseDocType = (t: DocKind) => {
    setDemoDoc(t);
    if (live && (persona.ocr.doc_type ?? "CCCD") !== t) {
      const code = t === "PASSPORT" ? "TD-14" : "TD-01";
      setPersonaCode(code); write(LS.persona, code);
    }
  };
  const pending = useRef<Promise<SessionResult> | null>(null);
  const dev = deviceFor(persona, install);

  useEffect(() => { backendAvailable().then(setLive); }, []);
  useEffect(() => { write(LS.session, session ? JSON.stringify(session) : null); }, [session]);
  // Mở lại app khi đang có phiên: lấy trạng thái mới nhất
  useEffect(() => {
    if (!live || !session) return;
    api<SessionResult>("GET", `/api/sessions/${session.id}`, undefined, { "x-session-token": session.token }).then(setResult).catch(() => setSession(null));
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPersona = (code: string) => { setPersonaCode(code); write(LS.persona, code); setSession(null); setResult(null); setDoc(null); };
  const newDevice = () => { const v = rand(); write(LS.install, v); setInstall(v); setSession(null); setResult(null); };
  const h = (s: Sess) => ({ "x-session-token": s.token });

  const createAndConsent = async (): Promise<Sess> => {
    const created = await api<{ session_id: string; token: string; terms_version: string }>("POST", "/api/sessions", {
      device_id: dev.id, device_model: persona.device.model, device_rooted: persona.device.rooted, phone: dev.phone, product: persona.product,
    });
    const s = { id: created.session_id, token: created.token, terms: created.terms_version };
    await api("POST", `/api/sessions/${s.id}/consent`, { scopes: ["identity", "screening", ...(marketing.current ? ["marketing"] : [])], terms_version: s.terms }, h(s));
    setSession(s); setResult(null); setDoc(null);
    return s;
  };

  const transition = useCallback(async (from: ScreenKey, to: ScreenKey): Promise<ScreenKey | null> => {
    if (!live) return to;
    setError(null);
    const s = session;
    try {
      setBusy(true);
      // Bắt đầu lại từ đầu
      if (from === "intro" && to === "consent") { setSession(null); setResult(null); setDoc(null); return to; }
      if (from === "consent" && to === "docType") { await createAndConsent(); return to; }
      // Phiên đã kết thúc (hết hạn giấy tờ, trùng, từ chối) mà khách thử lại → phiên mới
      if (["expiredDoc", "duplicate", "rejected"].includes(from) && to === "docType") { await createAndConsent(); return to; }

      if (from === "intro" && to === "resume") {
        const r = await api<Resumable & { session_id: string | null }>("GET", `/api/sessions/resume?device_id=${encodeURIComponent(dev.id)}`);
        if (!r.session_id) { setError("Không có hồ sơ đang làm dở trên máy này."); return null; }
        setResumable(r); setSession({ id: r.session_id, token: r.token, terms: "" });
        return to;
      }
      if (from === "resume" && s) {
        if (to === "intro") { await api("POST", `/api/sessions/${s.id}/cancel`, {}, h(s)); setSession(null); return to; }
        if (resumable?.reconsent_required) return "reconsent";
        const r = await api<{ next: string }>("POST", `/api/sessions/${s.id}/resume`, {}, h(s));
        return r.next === "LIVENESS" ? "liveness" : r.next === "DOC" ? "docType" : "consent";
      }
      if (from === "reconsent" && s) {
        const meta = await api<{ terms_version: string }>("GET", "/api/meta");
        await api("POST", `/api/sessions/${s.id}/consent`, { scopes: ["identity", "screening"], terms_version: meta.terms_version }, h(s));
        const r = await api<{ next: string }>("POST", `/api/sessions/${s.id}/resume`, {}, h(s));
        setResumable(null);
        return r.next === "LIVENESS" ? "liveness" : r.next === "DOC" ? "docType" : "consent";
      }

      if (!s) return to; // chưa có phiên (vd. mở thẳng một màn) – đi tiếp như demo

      // RULE-EKYC-07: lỗi đọc giấy tờ
      if (to === "unreadable" || (from === "unreadable" && to === "refer")) {
        let r = await api<{ next: string; status?: string }>("POST", `/api/sessions/${s.id}/capture-failures`, {}, h(s));
        if (to === "refer") while (r.next !== "REFER") r = await api("POST", `/api/sessions/${s.id}/capture-failures`, {}, h(s));
        if (r.next === "REFER") { setResult(await api("GET", `/api/sessions/${s.id}`, undefined, h(s))); return "refer"; }
        return "unreadable";
      }
      // Bổ sung hồ sơ (C07): chụp lại xong thì gửi luôn
      if (from === "captureBack" && result?.status === "PENDING_CUSTOMER_INFO") {
        const r = await api<SessionResult>("POST", `/api/sessions/${s.id}/info-request/submit`, { items: result.info_request?.items ?? [] }, h(s));
        setResult(r);
        return "refer";
      }
      if (from === "ocrReview" && to === "nfc") {
        const r = await api<DocResp>("POST", `/api/sessions/${s.id}/document`, persona.ocr, h(s));
        setDoc(r);
        if (r.next === "DUPLICATE") return "duplicate";
        if (r.next === "EXPIRED_DOC") return "expiredDoc";
        if (r.next === "REJECTED") { setResult(await api("GET", `/api/sessions/${s.id}`, undefined, h(s))); return "rejected"; }
        if (r.next === "RESUME") {
          if (r.resume_session_id && r.resume_token) setSession({ id: r.resume_session_id, token: r.resume_token, terms: s.terms });
          setResumable({ session_id: r.resume_session_id!, token: r.resume_token ?? "", status: "ABANDONED", last_step: "", resume_screen: "", reconsent_required: false, expires_at: 0 });
          return "resume";
        }
        return "nfc";
      }
      if (from === "nfc" && to === "liveness") {
        const body = chipRead.current && persona.chip ? persona.chip : { skipped: true };
        await api("POST", `/api/sessions/${s.id}/chip`, body, h(s));
        return to;
      }
      if (from === "liveness" && to === "verifying") {
        pending.current = api<SessionResult>("POST", `/api/sessions/${s.id}/liveness`, { liveness: persona.liveness, face_match: persona.face_match }, h(s));
        pending.current.catch(() => {});
        return to;
      }
      if (from === "verifying") {
        const r = await (pending.current ?? api<SessionResult>("GET", `/api/sessions/${s.id}`, undefined, h(s)));
        pending.current = null;
        setResult(r);
        return outcomeScreen(r);
      }
      return to;
    } catch (e) {
      const err = e as ApiErr;
      if (err.code === "TRY_LATER") setError("Vui lòng thử lại sau.");
      else if (err.code === "TERMS_OUTDATED") return "reconsent";
      else setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [live, session, persona, dev.id, dev.phone, result, resumable]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshResult = useCallback(async () => {
    if (!live || !session) return null;
    try {
      const r = await api<SessionResult>("GET", `/api/sessions/${session.id}`, undefined, h(session));
      setResult(r);
      return outcomeScreen(r);
    } catch (e) { setError((e as Error).message); return null; }
  }, [live, session]);

  const withdraw = useCallback(async (scope: "identity" | "screening" | "marketing") => {
    if (!live || !session) return null;
    try {
      const r = await api<{ result: string; message: string }>("POST", `/api/sessions/${session.id}/consents/withdraw`, { scope }, h(session));
      if (r.result === "CANCELLED") { setSession(null); setResult(null); }
      return r;
    } catch (e) { setError((e as Error).message); return null; }
  }, [live, session]);

  const value = useMemo<Ctx>(() => ({
    live, docType, chooseDocType, persona, setPersona, session, result, doc, resumable, busy, error, clearError: () => setError(null), chipRead, marketing, withdraw,
    outcome: result?.outcome ?? null, transition, refreshResult, newDevice,
  }), [live, docType, persona, session, result, doc, resumable, busy, error, transition, refreshResult, withdraw]); // eslint-disable-line react-hooks/exhaustive-deps

  return <EkycCtx.Provider value={value}>{children}</EkycCtx.Provider>;
}

/** Bọc hàm go của màn hình: mọi lần chuyển màn đi qua transition() */
export function useFlowGo(current: ScreenKey, rawGo: (k: ScreenKey) => void) {
  const ek = useEkyc();
  return useCallback((to: ScreenKey) => {
    if (!ek || !ek.live) return rawGo(to);
    ek.transition(current, to).then((next) => { if (next) rawGo(next); });
  }, [ek, current, rawGo]);
}
