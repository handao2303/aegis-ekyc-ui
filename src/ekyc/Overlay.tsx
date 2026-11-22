/* Thành phần phụ cho chế độ kết nối backend: thanh tải, thông báo lỗi, chọn hồ sơ mẫu */
import { AlertCircle, FlaskConical, X } from "lucide-react";
import { PERSONAS } from "../../server/src/personas";
import { useEkyc } from "./EkycContext";

/** Đặt trong khung app (position: relative) */
export function EkycOverlay() {
  const ek = useEkyc();
  if (!ek?.live) return null;
  return (
    <>
      {ek.busy && <div className="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden"><div className="h-full w-1/3 animate-[busy_1s_ease-in-out_infinite] bg-action" /></div>}
      {ek.error && (
        <div role="alert" className="absolute inset-x-3 top-3 z-50 flex items-start gap-2 rounded-lg bg-danger-subtle p-3 text-body-sm text-danger shadow-overlay" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">{ek.error}</span>
          {ek.error.includes("thử lại sau") && <button onClick={() => { ek.newDevice(); ek.clearError(); }} className="shrink-0 font-semibold underline">Đổi máy test</button>}
          <button onClick={ek.clearError} aria-label="Đóng" className="shrink-0"><X className="size-4" /></button>
        </div>
      )}
    </>
  );
}

/** Chọn hồ sơ mẫu TD-xx (C17) – chỉ hiện khi có backend */
export function PersonaPicker({ compact }: { compact?: boolean }) {
  const ek = useEkyc();
  if (!ek?.live) return null;
  return (
    <div className={compact ? "" : "mt-4 rounded-lg border border-dashed border-line-strong p-3"}>
      <label htmlFor="persona" className="flex items-center gap-1.5 text-caption font-semibold text-fg-secondary">
        <FlaskConical className="size-3.5" /> Bản test · hồ sơ mẫu
      </label>
      <select id="persona" value={ek.persona.code} onChange={(e) => ek.setPersona(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-md border border-line-strong bg-bg-surface px-2 text-body-sm outline-none focus:border-action focus:ring-4 focus:ring-focus">
        {PERSONAS.map((p) => <option key={p.code} value={p.code}>{p.code} · {p.label}</option>)}
      </select>
      <p className="mt-1 text-caption text-fg-tertiary">Kỳ vọng: {ek.persona.expect}</p>
    </div>
  );
}
