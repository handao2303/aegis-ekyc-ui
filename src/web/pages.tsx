/* Các trang phụ của Compliance: Đã xử lý · Báo cáo SLA · Cấu hình ngưỡng */
import { ReactNode, useState } from "react";
import { ChevronRight, Download, RotateCcw, Save } from "lucide-react";
import { Alert, Badge, Button, Card, Tabs, cx } from "../components/ui";
import { useLang } from "../i18n";
import { Case, ME, REASONS, ReasonCode } from "./data";

function Header({ crumb, title, desc, actions }: { crumb: string; title: string; desc: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-caption text-fg-tertiary">{crumb}</p>
        <h1 className="text-headline">{title}</h1>
        <p className="text-body-sm text-fg-secondary">{desc}</p>
      </div>
      {actions}
    </div>
  );
}

/* ================= Đã xử lý ================= */
const HISTORY = [
  { id: "EKS-2611-0012", masked: "Tr*** V** H***", type: "approved" as const, by: "Trần Hải Yến", checker: "—", at: "08/11/2026 16:20", mins: 42 },
  { id: "EKS-2611-0009", masked: "Ng***n Q*** A**", type: "rejected" as const, by: ME, checker: "—", at: "08/11/2026 14:05", mins: 95 },
  { id: "EKS-2611-0007", masked: "Ph** Th* L**", type: "approved" as const, by: "Lê Thu Hà", checker: ME, at: "08/11/2026 11:48", mins: 310 },
  { id: "EKS-2611-0004", masked: "Đ** M*** T**", type: "approved" as const, by: ME, checker: "—", at: "07/11/2026 17:31", mins: 28 },
  { id: "EKS-2611-0002", masked: "H** V** N**", type: "rejected" as const, by: "Trần Hải Yến", checker: "—", at: "07/11/2026 09:12", mins: 1510 },
];

export function DonePage({ cases, onOpen }: { cases: Case[]; onOpen: (id: string) => void }) {
  const { tr } = useLang();
  const [tab, setTab] = useState<"all" | "approved" | "rejected">("all");
  const mine = cases.filter((c) => c.decision).map((c) => ({ id: c.id, masked: c.masked, type: c.decision!.type, by: c.decision!.by, checker: "—", at: c.decision!.at, mins: Math.round(c.hours * 60), live: true }));
  const rows = [...mine, ...HISTORY.map((h) => ({ ...h, live: false }))].filter((r) => tab === "all" || r.type === tab);
  const fmt = (m: number) => (m >= 60 ? tr(`${Math.floor(m / 60)}g ${m % 60}p`, `${Math.floor(m / 60)}h ${m % 60}m`) : tr(`${m} phút`, `${m} min`));
  return (
    <div className="flex flex-col gap-5">
      <Header crumb={tr("eKYC › Xét duyệt", "eKYC › Review")} title={tr("Hồ sơ đã xử lý", "Completed cases")} desc={tr("Quyết định đã ghi nhật ký, không thể chỉnh sửa.", "Decisions are logged and can't be changed.")}
        actions={<Button variant="secondary" size="sm" icon={<Download className="size-4" />}>{tr("Xuất Excel", "Export to Excel")}</Button>} />
      <Card className="overflow-hidden">
        <div className="px-4 pt-3">
          <Tabs ariaLabel={tr("Lọc quyết định", "Filter decisions")} value={tab} onChange={setTab} items={[
            { value: "all", label: tr("Tất cả", "All"), count: mine.length + HISTORY.length },
            { value: "approved", label: tr("Đã duyệt", "Approved") },
            { value: "rejected", label: tr("Từ chối", "Rejected") },
          ]} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-body-sm">
            <thead className="bg-bg-base">
              <tr className="border-y border-line-subtle text-caption font-semibold text-fg-tertiary">
                {[tr("Hồ sơ", "Case"), tr("Quyết định", "Decision"), "Maker", "Checker", tr("Thời gian", "Decided at"), tr("Thời gian xử lý", "Handling time"), ""].map((h, i) => <th key={i} className="px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cx("border-b border-line-subtle last:border-0", r.live && "interactive cursor-pointer")} onClick={() => r.live && onOpen(r.id)}>
                  <td className="whitespace-nowrap px-4 py-3"><p className="font-semibold">{r.masked}</p><p className="text-caption text-fg-tertiary tabular">{r.id}</p></td>
                  <td className="px-4 py-3">{r.type === "approved" ? <Badge tone="success" dot>{tr("Đã duyệt", "Approved")}</Badge> : <Badge tone="danger" dot>{tr("Từ chối", "Rejected")}</Badge>}</td>
                  <td className="px-4 py-3">{r.by}</td>
                  <td className="px-4 py-3 text-fg-secondary">{r.checker}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular text-fg-secondary">{r.at}</td>
                  <td className="px-4 py-3 tabular">{fmt(r.mins)}{r.mins > 1440 && <Badge tone="danger" className="ml-2">{tr("Quá SLA", "Breached")}</Badge>}</td>
                  <td className="px-4 py-3 text-right">{r.live && <ChevronRight className="ml-auto size-4 text-fg-tertiary" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================= Báo cáo SLA ================= */
const DAYS = [
  { d: "03/11", total: 38, inSla: 37 }, { d: "04/11", total: 42, inSla: 40 }, { d: "05/11", total: 51, inSla: 46 },
  { d: "06/11", total: 47, inSla: 45 }, { d: "07/11", total: 55, inSla: 50 }, { d: "08/11", total: 33, inSla: 33 }, { d: "09/11", total: 12, inSla: 11 },
];
const BY_REASON: [ReasonCode, number][] = [["LIVENESS_BORDERLINE", 74], ["NFC_SKIPPED", 61], ["CIC_TIMEOUT", 38], ["DOC_DATA_MISMATCH", 29], ["PEP_MATCH", 12], ["DEVICE_MULTI_IDENTITY", 9]];

export function SlaReport({ cases }: { cases: Case[] }) {
  const { tr, pick } = useLang();
  const total = DAYS.reduce((a, b) => a + b.total, 0);
  const inSla = DAYS.reduce((a, b) => a + b.inSla, 0);
  const max = Math.max(...DAYS.map((d) => d.total));
  const maxReason = Math.max(...BY_REASON.map((r) => r[1]));
  const open = cases.filter((c) => !c.decision && c.status !== "pending_customer");
  return (
    <div className="flex flex-col gap-5">
      <Header crumb={tr("eKYC › Báo cáo", "eKYC › Reports")} title={tr("Báo cáo SLA", "SLA report")} desc={tr("7 ngày gần nhất · cam kết xử lý trong 24 giờ", "Last 7 days · 24-hour handling commitment")}
        actions={<Button variant="secondary" size="sm" icon={<Download className="size-4" />}>{tr("Xuất báo cáo", "Export report")}</Button>} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-subtle bg-[var(--border-subtle)] xl:grid-cols-4">
        {[
          [tr("Hồ sơ đã xử lý", "Cases decided"), String(total), ""],
          [tr("Tỷ lệ đúng SLA", "Within SLA"), `${((inSla / total) * 100).toFixed(1)}%`, tr("Mục tiêu ≥ 95%", "Target ≥ 95%")],
          [tr("Thời gian xử lý trung vị", "Median handling time"), tr("3g 12p", "3h 12m"), ""],
          [tr("Đang mở", "Currently open"), String(open.length), tr(`${open.filter((c) => c.hours > 24).length} quá SLA`, `${open.filter((c) => c.hours > 24).length} breached`)],
        ].map(([l, v, n]) => (
          <div key={l} className="bg-bg-surface px-4 py-3.5">
            <p className="text-caption font-semibold text-fg-tertiary">{l}</p>
            <p className="mt-1 text-[28px] font-bold leading-8 tabular">{v}</p>
            {n && <p className="mt-0.5 text-caption text-fg-tertiary">{n}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-title-sm">{tr("Hồ sơ xử lý theo ngày", "Cases decided per day")}</h2>
            <div className="flex gap-3 text-caption text-fg-secondary">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-action" />{tr("Đúng SLA", "Within SLA")}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-danger" />{tr("Quá SLA", "Breached")}</span>
            </div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3 border-b border-line-subtle" role="img" aria-label={tr("Biểu đồ cột hồ sơ theo ngày", "Bar chart of cases per day")}>
            {DAYS.map((d) => (
              <div key={d.d} className="flex h-full flex-1 flex-col justify-end gap-1">
                <span className="text-center text-caption tabular text-fg-secondary">{d.total}</span>
                <div className="flex flex-col overflow-hidden rounded-t-sm" style={{ height: `${(d.total / max) * 85}%` }}>
                  <span className="bg-danger" style={{ height: `${((d.total - d.inSla) / d.total) * 100}%` }} />
                  <span className="flex-1 bg-action" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3">{DAYS.map((d) => <span key={d.d} className="flex-1 text-center text-caption tabular text-fg-tertiary">{d.d}</span>)}</div>
        </Card>
        <Card className="p-4">
          <h2 className="text-title-sm">{tr("Lý do chuyển duyệt nhiều nhất", "Top referral reasons")}</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {BY_REASON.map(([r, n]) => (
              <li key={r}>
                <div className="flex justify-between text-body-sm"><span>{pick(REASONS[r].label)}</span><span className="font-semibold tabular">{n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-bg-sunken"><div className="h-full rounded-full bg-action" style={{ width: `${(n / maxReason) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-fg-tertiary">{tr("Liveness vùng biên và bỏ qua NFC chiếm 60% hồ sơ chuyển duyệt — nên xem lại ngưỡng liveness.", "Borderline liveness and skipped NFC make up 60% of referrals — consider reviewing the liveness threshold.")}</p>
        </Card>
      </div>
    </div>
  );
}

/* ================= Cấu hình ngưỡng ================= */
type Field = { id: string; label: [string, string]; hint: [string, string]; value: number; step: number; unit?: string };
const DEFAULTS: Field[] = [
  { id: "risk-stp", label: ["Điểm rủi ro tối đa để duyệt tự động", "Max risk score for auto-approval"], hint: ["Dưới ngưỡng này → STP_APPROVED", "Below this → STP_APPROVED"], value: 50, step: 1 },
  { id: "risk-reject", label: ["Điểm rủi ro tự từ chối", "Risk score for auto-rejection"], hint: ["Từ ngưỡng này trở lên → REJECTED", "At or above this → REJECTED"], value: 85, step: 1 },
  { id: "liveness-pass", label: ["Liveness – ngưỡng đạt", "Liveness – pass"], hint: ["Thấp hơn → vùng biên", "Below this → borderline"], value: 0.85, step: 0.01 },
  { id: "liveness-border", label: ["Liveness – ngưỡng biên", "Liveness – borderline"], hint: ["Thấp hơn → không đạt", "Below this → fail"], value: 0.7, step: 0.01 },
  { id: "sla", label: ["SLA xử lý hồ sơ REFER", "REFER handling SLA"], hint: ["Tính từ lúc vào hàng đợi", "From entering the queue"], value: 24, step: 1, unit: "h" },
  { id: "retry", label: ["Số lần chụp lại tối đa", "Max photo retries"], hint: ["Vượt → chuyển duyệt tay", "Exceeded → manual review"], value: 3, step: 1 },
  { id: "velocity", label: ["Số phiên tối đa / thiết bị / 24h", "Max sessions per device / 24h"], hint: ["Vượt → chặn thiết bị 24h", "Exceeded → device blocked 24h"], value: 3, step: 1 },
];

export function ThresholdConfig() {
  const { tr } = useLang();
  const [vals, setVals] = useState<Record<string, number>>(Object.fromEntries(DEFAULTS.map((f) => [f.id, f.value])));
  const [saved, setSaved] = useState(false);
  const changed = DEFAULTS.filter((f) => vals[f.id] !== f.value);
  const invalid = vals["risk-stp"] >= vals["risk-reject"] || vals["liveness-border"] >= vals["liveness-pass"];
  return (
    <div className="flex flex-col gap-5">
      <Header crumb={tr("eKYC › Cấu hình", "eKYC › Settings")} title={tr("Cấu hình ngưỡng", "Thresholds")} desc={tr("Thay đổi cần một người thứ hai phê duyệt trước khi có hiệu lực.", "Changes need a second approver before they take effect.")} />
      {saved && <Alert tone="success" title={tr("Đã gửi thay đổi chờ phê duyệt", "Changes submitted for approval")}>{tr(`${changed.length} thay đổi · đã ghi nhật ký · ${ME}`, `${changed.length} change(s) · logged · ${ME}`)}</Alert>}
      {invalid && <Alert tone="danger" title={tr("Giá trị không hợp lệ", "Invalid values")}>{tr("Ngưỡng duyệt tự động phải nhỏ hơn ngưỡng từ chối, ngưỡng biên phải nhỏ hơn ngưỡng đạt.", "Auto-approve must be below auto-reject, and borderline must be below pass.")}</Alert>}
      <Card className="divide-y divide-[var(--border-subtle)]">
        {DEFAULTS.map((f) => {
          const dirty = vals[f.id] !== f.value;
          return (
            <div key={f.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
              <label htmlFor={f.id} className="min-w-0">
                <span className="flex items-center gap-2 text-body-sm font-semibold">{tr(...f.label)}{dirty && <Badge tone="warning">{tr("Đã sửa", "Edited")}</Badge>}</span>
                <span className="block text-caption text-fg-tertiary">{tr(...f.hint)} · {tr("mặc định", "default")} {f.value}{f.unit ?? ""}</span>
              </label>
              <div className="relative">
                <input id={f.id} type="number" step={f.step} value={vals[f.id]} onChange={(e) => { setSaved(false); setVals({ ...vals, [f.id]: Number(e.target.value) }); }}
                  className="h-10 w-full rounded-md border border-line-strong bg-bg-surface px-3 pr-8 text-right text-body-sm tabular outline-none focus:border-action focus:ring-4 focus:ring-focus" />
                {f.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-caption text-fg-tertiary">{f.unit}</span>}
              </div>
            </div>
          );
        })}
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" icon={<RotateCcw className="size-4" />} disabled={!changed.length} onClick={() => { setVals(Object.fromEntries(DEFAULTS.map((f) => [f.id, f.value]))); setSaved(false); }}>{tr("Khôi phục mặc định", "Reset to defaults")}</Button>
        <Button icon={<Save className="size-4" />} disabled={!changed.length || invalid} onClick={() => setSaved(true)}>{tr("Gửi phê duyệt", "Submit for approval")}</Button>
      </div>
    </div>
  );
}
