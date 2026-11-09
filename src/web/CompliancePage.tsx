import { ReactNode, createContext, useContext, useMemo, useState } from "react";
import {
  BarChart3, Check, ChevronRight, Clock, Eye, FileSearch, Hand, Inbox, Lock, Search,
  Settings2, ShieldAlert, Smartphone, UserCheck, XCircle, FilePlus2, History,
} from "lucide-react";
import { Alert, Badge, Button, Card, KV, Modal, Tabs, cx } from "../components/ui";
import { IdCardArt } from "../mobile/MobileShell";
import { CASES, Case, ME, REASONS, STATUS, riskBand, sla } from "./data";
import { useLang } from "../i18n";
import { DonePage, SlaReport, ThresholdConfig } from "./pages";

type Filter = "all" | "mine" | "resubmitted" | "checker";
export type View = "queue" | "checker" | "done" | "sla" | "config";

/** standalone = chạy trong app Compliance (sidebar do layout ngoài cung cấp) */
export default function CompliancePage({ standalone, layout }: { standalone?: boolean; layout?: (nav: ReactNode, body: ReactNode) => ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [cases, setCases] = useState(CASES);
  const [viewState, setViewState] = useState<View>("queue");
  const view = viewState;
  const setView = (v: View) => { setOpenId(null); setViewState(v); window.scrollTo(0, 0); };
  const update = (id: string, patch: Partial<Case>) => setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const current = cases.find((c) => c.id === openId);
  const counts = { queue: cases.filter((c) => !c.decision && c.status !== "pending_customer").length, checker: cases.filter((c) => !c.decision && c.status === "pending_checker").length };

  let body: ReactNode;
  if (current) body = <CaseDetail c={current} onBack={() => setOpenId(null)} update={update} standalone={standalone} />;
  else if (view === "done") body = <DonePage cases={cases} onOpen={setOpenId} />;
  else if (view === "sla") body = <SlaReport cases={cases} />;
  else if (view === "config") body = <ThresholdConfig />;
  else body = <Queue key={view} cases={cases} onOpen={setOpenId} update={update} initialTab={view === "checker" ? "checker" : "all"} />;

  if (standalone && layout) return <ViewContext.Provider value={{ view, setView, counts }}>{layout(<ComplianceNav />, body)}</ViewContext.Provider>;
  return (
    <ViewContext.Provider value={{ view, setView, counts }}>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block"><Card className="p-2"><ComplianceNav /></Card></aside>
        <div className="min-w-0">{body}</div>
      </div>
    </ViewContext.Provider>
  );
}

type ViewCtx = { view: View; setView: (v: View) => void; counts: { queue: number; checker: number } };
export const ViewContext = createContext<ViewCtx>({ view: "queue", setView: () => {}, counts: { queue: 0, checker: 0 } });

export function ComplianceNav({ view: v, setView: sv, counts: ct }: Partial<ViewCtx> = {}) {
  const { tr } = useLang();
  const ctx = useContext(ViewContext);
  const view = v ?? ctx.view, setView = sv ?? ctx.setView, counts = ct ?? ctx.counts;
  const items: { id: View; icon: typeof Inbox; label: string; count?: number }[] = [
    { id: "queue", icon: Inbox, label: tr("Hàng đợi xét duyệt", "Review queue"), count: counts.queue },
    { id: "checker", icon: UserCheck, label: tr("Chờ Checker", "Awaiting checker"), count: counts.checker },
    { id: "done", icon: History, label: tr("Đã xử lý", "Completed") },
    { id: "sla", icon: BarChart3, label: tr("Báo cáo SLA", "SLA report") },
    { id: "config", icon: Settings2, label: tr("Cấu hình ngưỡng", "Thresholds") },
  ];
  return (
    <nav className="flex flex-col gap-0.5" aria-label={tr("Điều hướng", "Navigation")}>
      {items.map(({ id, icon: Icon, label, count }) => (
        <button key={id} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}
          className={cx("interactive flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-body-sm", view === id ? "bg-action-subtle font-semibold text-action-subtle-fg" : "text-fg-secondary")}
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {count !== undefined && <span className="text-caption tabular">{count}</span>}
        </button>
      ))}
    </nav>
  );
}

/* ================= Hàng đợi ================= */
function Queue({ cases: all, onOpen, update, initialTab = "all" }: { cases: Case[]; onOpen: (id: string) => void; update: (id: string, p: Partial<Case>) => void; initialTab?: Filter }) {
  const { tr, pick } = useLang();
  const [tab, setTab] = useState<Filter>(initialTab);
  const cases = all.filter((c) => !c.decision);
  const [q, setQ] = useState("");
  const open = cases.filter((c) => c.status !== "pending_customer");
  const stats = {
    waiting: open.length,
    warn: open.filter((c) => c.hours >= 16 && c.hours <= 24).length,
    breach: open.filter((c) => c.hours > 24).length,
    checker: cases.filter((c) => c.status === "pending_checker").length,
  };
  const order = (c: Case) => (c.status === "resubmitted" ? 0 : c.hours > 16 ? 1 : 2);
  const rows = useMemo(
    () =>
      cases
        .filter((c) => (tab === "mine" ? c.assignee === ME : tab === "resubmitted" ? c.status === "resubmitted" : tab === "checker" ? c.status === "pending_checker" : true))
        .filter((c) => !q || c.id.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => order(a) - order(b) || b.hours - a.hours),
    [cases, tab, q],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption text-fg-tertiary">{tr("eKYC › Xét duyệt", "eKYC › Review")}</p>
          <h1 className="text-headline">{tr("Hàng đợi xét duyệt", "Review queue")}</h1>
          <p className="text-body-sm text-fg-secondary">{tr("Hồ sơ cần xử lý trong 24 giờ kể từ khi vào hàng đợi.", "Applications must be decided within 24 hours of entering the queue.")}</p>
        </div>
        <p className="text-caption text-fg-tertiary tabular">{tr("Cập nhật 09:41 · 09/11/2026", "Updated 09:41 · 9 Nov 2026")}</p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-subtle bg-[var(--border-subtle)] xl:grid-cols-4">
        <Stat icon={<Inbox className="size-4" />} label={tr("Đang chờ xử lý", "Open cases")} value={stats.waiting} />
        <Stat icon={<Clock className="size-4" />} label={tr("Sắp quá SLA", "Due within 8h")} value={stats.warn} tone="warning" />
        <Stat icon={<ShieldAlert className="size-4" />} label={tr("Quá SLA", "SLA breached")} value={stats.breach} tone="danger" />
        <Stat icon={<UserCheck className="size-4" />} label={tr("Chờ Checker", "Awaiting checker")} value={stats.checker} tone="info" />
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-col gap-3 px-4 pt-3 md:flex-row md:items-end md:justify-between">
          <Tabs<Filter>
            ariaLabel={tr("Lọc hàng đợi", "Filter queue")}
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: tr("Tất cả", "All"), count: cases.length },
              { value: "mine", label: tr("Của tôi", "Mine"), count: cases.filter((c) => c.assignee === ME).length },
              { value: "resubmitted", label: tr("Đã bổ sung", "Resubmitted"), count: cases.filter((c) => c.status === "resubmitted").length },
              { value: "checker", label: tr("Chờ Checker", "Checker"), count: stats.checker },
            ]}
          />
          <label className="relative mb-2 block md:w-64">
            <span className="sr-only">{tr("Tìm hồ sơ", "Search cases")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
            <input id="queue-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Mã hồ sơ hoặc họ tên", "Case ID or name")}
              className="h-9 w-full rounded-md border border-line-strong bg-bg-surface pl-9 pr-3 text-body-sm outline-none focus:border-action focus:ring-4 focus:ring-focus" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-body-sm">
            <thead className="bg-bg-base">
              <tr className="border-y border-line-subtle text-caption font-semibold text-fg-tertiary">
                {[tr("Hồ sơ", "Case"), tr("Lý do chuyển duyệt", "Referral reason"), tr("Điểm rủi ro", "Risk score"), "SLA", tr("Trạng thái", "Status"), tr("Người xử lý", "Assignee"), ""].map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = sla(c.hours, c.status === "pending_customer");
                return (
                  <tr key={c.id} className="interactive cursor-pointer border-b border-line-subtle last:border-0" onClick={() => onOpen(c.id)}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-semibold">{c.masked}</p>
                      <p className="text-caption text-fg-tertiary tabular">{c.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">{c.reasons.map((r) => <Badge key={r} tone={REASONS[r].tone}>{pick(REASONS[r].label)}</Badge>)}</div>
                    </td>
                    <td className="px-4 py-3"><RiskMeter value={c.risk} /></td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={s.tone} dot>{pick(s.label)}</Badge>
                      <p className="mt-1 text-caption text-fg-tertiary tabular">{pick(s.left)}</p>
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS[c.status].tone}>{pick(STATUS[c.status].label)}</Badge></td>
                    <td className="px-4 py-3 text-fg-secondary">{c.assignee ?? <span className="text-fg-tertiary">—</span>}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {!c.assignee && c.status !== "pending_customer" ? (
                        <Button size="sm" variant="secondary" icon={<Hand className="size-4" />} onClick={() => { update(c.id, { assignee: ME, status: c.status === "resubmitted" ? "resubmitted" : "in_progress" }); onOpen(c.id); }}>{tr("Nhận", "Claim")}</Button>
                      ) : (
                        <Button size="sm" variant="ghost" iconRight={<ChevronRight className="size-4" />} onClick={() => onOpen(c.id)}>{tr("Xem", "View")}</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-fg-tertiary">{tr("Không có hồ sơ phù hợp bộ lọc.", "No cases match this filter.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line-subtle px-4 py-2.5 text-caption text-fg-tertiary">
          <span className="tabular">{tr(`Hiển thị ${rows.length} / ${cases.length} hồ sơ`, `Showing ${rows.length} of ${cases.length} cases`)}</span>
          <span>{tr("Ưu tiên: Đã bổ sung → Sắp quá SLA → Cũ nhất", "Priority: Resubmitted → Due soon → Oldest")}</span>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, tone = "neutral" }: { icon: ReactNode; label: string; value: number; tone?: "neutral" | "warning" | "danger" | "info" }) {
  const c = { neutral: "text-fg-tertiary", warning: "text-warning", danger: "text-danger", info: "text-info" }[tone];
  return (
    <div className="bg-bg-surface px-4 py-3.5">
      <p className={cx("flex items-center gap-1.5 text-caption font-semibold", c)}>{icon}{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-8 tabular">{value}</p>
    </div>
  );
}

function RiskMeter({ value }: { value: number }) {
  const tone = riskBand(value);
  const bar = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone as "success"];
  return (
    <div className="flex items-center gap-2" aria-label={`Risk ${value}`}>
      <span className="w-10 font-semibold tabular">{value.toFixed(1)}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-sunken"><span className={cx("block h-full rounded-full", bar)} style={{ width: `${value}%` }} /></span>
    </div>
  );
}

/* ================= Chi tiết hồ sơ ================= */
function CaseDetail({ c, onBack, update, standalone }: { c: Case; onBack: () => void; update: (id: string, p: Partial<Case>) => void; standalone?: boolean }) {
  const { tr, pick } = useLang();
  const [modal, setModal] = useState<null | "approve" | "request" | "reject">(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [reqSel, setReqSel] = useState<number[]>([]);
  const [rejReason, setRejReason] = useState("");
  const [note, setNote] = useState("");
  const s = sla(c.hours, c.status === "pending_customer");
  const needsChecker = c.reasons.includes("PEP_MATCH") || c.reasons.includes("SANCTION_MATCH") || c.risk >= 70;
  const mine = c.assignee === ME;
  const lockedByOther = !!c.assignee && !mine;
  const isCheckerView = c.status === "pending_checker";
  const canRequest = c.requestCount < 2;
  const has = (r: Case["reasons"][number]) => c.reasons.includes(r);

  const REQ = [tr("Ảnh mặt trước bị mờ", "Front photo blurred"), tr("Ảnh mặt sau mờ / không đọc được MRZ", "Back photo blurred / MRZ unreadable"), tr("Thiếu ảnh mặt sau", "Back photo missing"), tr("Thông tin OCR khác chip", "OCR data differs from chip"), tr("Khác (ghi rõ bên dưới)", "Other (explain below)")];
  const REJ = [tr("Giấy tờ có dấu hiệu giả mạo", "Signs of a forged document"), tr("Khuôn mặt không khớp giấy tờ", "Face doesn't match the ID"), tr("Trùng danh sách cấm (Sanction)", "Sanctions match confirmed"), tr("Không đáp ứng điều kiện sản phẩm", "Doesn't meet product criteria"), tr("Khác", "Other")];
  const close = () => { setModal(null); setNote(""); setReqSel([]); setRejReason(""); };
  const textarea = "mt-1.5 w-full rounded-md border border-line-strong bg-bg-surface p-3 text-body-sm outline-none focus:border-action focus:ring-4 focus:ring-focus";

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav className="text-caption text-fg-tertiary" aria-label="breadcrumb">
            <button onClick={onBack} className="hover:underline">{tr("Hàng đợi xét duyệt", "Review queue")}</button> › <span className="tabular">{c.id}</span>
          </nav>
          <h1 className="mt-1 text-headline">{revealed ? c.name : c.masked}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS[c.status].tone}>{pick(STATUS[c.status].label)}</Badge>
            <Badge tone={s.tone} dot>{pick(s.label)} · {pick(s.left)}</Badge>
            {c.requestCount > 0 && <Badge tone="info">{tr(`Đã yêu cầu bổ sung ${c.requestCount}/2`, `Info requested ${c.requestCount}/2`)}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!revealed && <Button variant="secondary" size="sm" icon={<Eye className="size-4" />} onClick={() => setRevealed(true)}>{tr("Xem họ tên đầy đủ", "Show full name")}</Button>}
          {!c.assignee && c.status !== "pending_customer" && <Button size="sm" icon={<Hand className="size-4" />} onClick={() => update(c.id, { assignee: ME, status: "in_progress" })}>{tr("Nhận xử lý", "Claim case")}</Button>}
        </div>
      </div>

      {done && <Alert tone="success" title={done} />}
      {lockedByOther && !isCheckerView && <Alert tone="info" title={tr(`${c.assignee} đang xử lý hồ sơ này`, `${c.assignee} is working on this case`)}>{tr("Bạn chỉ có thể xem. Hồ sơ tự nhả sau 2 giờ không thao tác.", "View only. The case is released after 2 hours of inactivity.")}</Alert>}
      {isCheckerView && <Alert tone="warning" title={tr("Chờ Checker phê duyệt", "Awaiting checker approval")}>{tr(`Maker: ${c.assignee}. Checker phải là người khác Maker.`, `Maker: ${c.assignee}. The checker must be a different person.`)}</Alert>}
      {!c.assignee && c.status !== "pending_customer" && <Alert tone="info" title={tr("Nhận xử lý để ra quyết định", "Claim this case to make a decision")} />}
      {revealed && <p className="-mt-3 text-caption text-fg-tertiary">{tr("Đã ghi nhật ký: xem dữ liệu cá nhân · ", "Logged: personal data viewed · ")}{ME} · 09:42</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-4">
            <h2 className="text-title-sm">{tr("Lý do chuyển duyệt", "Referral reasons")}</h2>
            <ul className="mt-3 flex flex-col divide-y divide-[var(--border-subtle)]">
              {c.reasons.map((r) => (
                <li key={r} className="flex items-center justify-between gap-3 py-2.5">
                  <Badge tone={REASONS[r].tone} dot>{pick(REASONS[r].label)}</Badge>
                  <code className="text-caption text-fg-tertiary">{r}</code>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-title-sm">{tr("Giấy tờ", "ID document")}</h2>
              <Badge tone={c.nfc ? "success" : "warning"} dot>{c.nfc ? tr("Chip hợp lệ", "Chip verified") : tr("Không đọc chip", "Chip not read")}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <figure><IdCardArt side="front" /><figcaption className="mt-1 text-caption text-fg-tertiary">{tr("Mặt trước", "Front")}</figcaption></figure>
              <figure><IdCardArt side="back" /><figcaption className="mt-1 text-caption text-fg-tertiary">{tr("Mặt sau", "Back")}</figcaption></figure>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-body-sm">
                <caption className="sr-only">{tr("So sánh OCR và chip", "OCR vs chip comparison")}</caption>
                <thead><tr className="border-b border-line-subtle text-left text-caption text-fg-tertiary"><th className="py-2 pr-3 font-semibold">{tr("Trường", "Field")}</th><th className="py-2 pr-3 font-semibold">OCR</th><th className="py-2 pr-3 font-semibold">{tr("Chip", "Chip")} (DG1)</th><th className="py-2" /></tr></thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {[
                    [tr("Họ tên", "Name"), (revealed ? c.name : c.masked).toUpperCase(), (revealed ? c.name : c.masked).toUpperCase(), true],
                    [tr("Số CCCD", "ID number"), "089•••••5678", "089•••••5678", true],
                    [tr("Ngày sinh", "Date of birth"), `15/03/${c.dob}`, has("DOC_DATA_MISMATCH") ? `15/08/${c.dob}` : `15/03/${c.dob}`, !has("DOC_DATA_MISMATCH")],
                    [tr("Hết hạn", "Expiry"), "15/03/2032", c.nfc ? "15/03/2032" : "—", true],
                  ].map(([f, a, b, ok]) => (
                    <tr key={String(f)} className={cx(!ok && "bg-warning-subtle")}>
                      <td className="py-2 pr-3 text-fg-tertiary">{f}</td>
                      <td className="py-2 pr-3 tabular">{a}</td>
                      <td className="py-2 pr-3 tabular">{b}</td>
                      <td className="py-2">{ok ? <Check className="size-4 text-success" aria-label="OK" /> : <Badge tone="warning">{tr("Lệch", "Mismatch")}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-title-sm">{tr("Khuôn mặt", "Face check")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KV label="Liveness" value={c.liveness.toFixed(2)} mono highlight={c.liveness < 0.8 ? "warning" : undefined} />
              <KV label="Face match" value={c.faceMatch.toFixed(2)} mono highlight={c.faceMatch < 0.85 ? "warning" : undefined} />
              <KV label={tr("Nguồn so khớp", "Match source")} value={c.matchSource === "CHIP_DG2" ? tr("Ảnh trong chip", "Chip photo") : tr("Ảnh in trên thẻ", "Printed photo")} highlight={c.matchSource === "OCR_FRONT" ? "warning" : undefined} />
              <KV label={tr("Ngưỡng đạt / biên", "Pass / borderline")} value="0.85 / 0.70" mono />
            </dl>
            {c.matchSource === "OCR_FRONT" && <Alert tone="warning" className="mt-3">{tr("So khớp với ảnh in trên thẻ có độ tin cậy thấp hơn ảnh trong chip. Không được duyệt tự động.", "Matching against the printed photo is less reliable than the chip photo. Not eligible for auto-approval.")}</Alert>}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title-sm">{tr("Sàng lọc rủi ro", "Risk screening")}</h2>
              <Badge tone="danger"><Lock className="size-3" />{tr("Chỉ Compliance", "Compliance only")}</Badge>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-display leading-none tabular">{c.risk.toFixed(1)}</span>
              <Badge tone={riskBand(c.risk)}>{c.risk >= 70 ? tr("Vùng cao", "High") : c.risk >= 50 ? tr("Vùng trung bình", "Medium") : tr("Vùng thấp", "Low")}</Badge>
            </div>
            <div className="relative mt-3 flex h-2 gap-0.5 overflow-visible">
              <span className="h-full w-1/2 rounded-l-full bg-success opacity-70" /><span className="h-full w-1/5 bg-warning opacity-70" /><span className="h-full w-[30%] rounded-r-full bg-danger opacity-70" />
              <span className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-[var(--bg-surface)] bg-fg-primary" style={{ left: `${c.risk}%` }} aria-hidden />
            </div>
            <div className="mt-1 flex justify-between text-caption text-fg-tertiary tabular"><span>0</span><span>50</span><span>70</span><span>100</span></div>
            <dl className="mt-4 divide-y divide-[var(--border-subtle)]">
              {[
                ["PEP", has("PEP_MATCH") ? tr("Trùng 1 bản ghi", "1 record matched") : tr("Không", "None"), has("PEP_MATCH")],
                ["Sanction", has("SANCTION_MATCH") ? tr("Nghi trùng", "Possible match") : tr("Không", "None"), has("SANCTION_MATCH")],
                ["CIC", has("CIC_TIMEOUT") ? tr("Quá thời gian – tra lại", "Timed out – retry") : tr("Nhóm 1", "Group 1"), has("CIC_TIMEOUT")],
                ["AML", tr("Không cảnh báo", "No alerts"), false],
              ].map(([k, v, flag]) => (
                <div key={String(k)} className="flex justify-between py-2 text-body-sm"><dt className="text-fg-tertiary">{k}</dt><dd className={cx("font-semibold", flag && "text-danger")}>{v}</dd></div>
              ))}
            </dl>
            {has("CIC_TIMEOUT") && <Button className="mt-3" size="sm" variant="secondary" icon={<FileSearch className="size-4" />}>{tr("Tra cứu lại CIC", "Retry CIC check")}</Button>}
          </Card>

          <Card className="p-4">
            <h2 className="text-title-sm">{tr("Thiết bị", "Device")}</h2>
            <dl className="mt-3 divide-y divide-[var(--border-subtle)] text-body-sm">
              <div className="flex justify-between gap-3 py-2"><dt className="text-fg-tertiary">{tr("Thiết bị", "Device")}</dt><dd className="flex items-center gap-1.5 text-right"><Smartphone className="size-4 text-fg-tertiary" />{c.device}</dd></div>
              <div className="flex justify-between gap-3 py-2"><dt className="text-fg-tertiary">{tr("CCCD khác trên máy (30 ngày)", "Other IDs on device (30d)")}</dt><dd className={cx("font-semibold tabular", has("DEVICE_MULTI_IDENTITY") && "text-danger")}>{has("DEVICE_MULTI_IDENTITY") ? "2" : "0"}</dd></div>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-title-sm">{tr("Lịch sử hồ sơ", "Case history")}</h2>
            <ol className="mt-3 flex flex-col gap-3 text-body-sm">
              {([
                ["09:42", tr("Mở chi tiết hồ sơ", "Case opened"), ME],
                c.status === "resubmitted" ? [tr("Hôm qua 21:10", "Yesterday 21:10"), tr("Khách đã bổ sung ảnh mặt sau", "Customer resubmitted back photo"), tr("Khách hàng", "Customer")] : null,
                c.requestCount > 0 ? [tr("Hôm qua 15:02", "Yesterday 15:02"), tr("Yêu cầu bổ sung: ảnh mặt sau", "Info requested: back photo"), "Trần Hải Yến"] : null,
                [tr(`${Math.round(c.hours)} giờ trước`, `${Math.round(c.hours)}h ago`), tr("Hệ thống chuyển REFER", "System referred case"), "risk-engine"],
              ].filter(Boolean) as string[][]).map(([t, a, who]) => (
                <li key={a} className="flex gap-3">
                  <span className="w-24 shrink-0 text-caption text-fg-tertiary tabular">{t}</span>
                  <span className="min-w-0"><span className="block">{a}</span><span className="text-caption text-fg-tertiary">{who}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Thanh quyết định */}
      <div className={cx("fixed bottom-0 right-0 z-20 border-t border-line-subtle bg-bg-surface", standalone ? "left-0 lg:left-[248px]" : "left-0")} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className={cx("gutter flex flex-wrap items-center justify-between gap-3 py-3", !standalone && "mx-auto max-w-[1320px] lg:!pl-[268px]")}>
          <p className="text-caption text-fg-tertiary">
            {lockedByOther && !isCheckerView ? tr("Chỉ xem – hồ sơ do người khác xử lý", "View only – assigned to someone else") : needsChecker && !isCheckerView ? tr("Phê duyệt hồ sơ này cần người thứ hai (Maker-Checker)", "Approving this case needs a second approver (maker-checker)") : tr("Mọi quyết định được ghi nhật ký và không thể sửa", "All decisions are logged and can't be changed")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<FilePlus2 className="size-4" />} disabled={lockedByOther || isCheckerView || !canRequest || !c.assignee || !!c.decision} onClick={() => setModal("request")}>{tr("Yêu cầu bổ sung", "Request info")}</Button>
            <Button variant="danger" icon={<XCircle className="size-4" />} disabled={(lockedByOther && !isCheckerView) || !c.assignee || !!c.decision} onClick={() => setModal("reject")}>{tr("Từ chối", "Reject")}</Button>
            <Button icon={<Check className="size-4" />} disabled={(lockedByOther && !isCheckerView) || !c.assignee || !!c.decision} onClick={() => setModal("approve")}>
              {isCheckerView ? tr("Checker phê duyệt", "Approve as checker") : needsChecker ? tr("Phê duyệt · gửi Checker", "Approve · send to checker") : tr("Phê duyệt", "Approve")}
            </Button>
          </div>
        </div>
      </div>

      <Modal open={modal === "approve"} onClose={close} title={isCheckerView ? tr("Xác nhận phê duyệt (Checker)", "Confirm approval (checker)") : needsChecker ? tr("Gửi Checker phê duyệt", "Send to checker") : tr("Phê duyệt hồ sơ", "Approve application")}
        footer={<><Button variant="ghost" onClick={close}>{tr("Huỷ", "Cancel")}</Button><Button onClick={() => {
          if (needsChecker && !isCheckerView) { update(c.id, { status: "pending_checker" }); setDone(tr("Đã gửi hồ sơ cho Checker phê duyệt", "Sent to checker for approval")); }
          else { update(c.id, { decision: { type: "approved", by: ME, at: "09:45 · 09/11/2026" } }); setDone(tr("Đã phê duyệt – tài khoản đang được tạo, khách sẽ nhận SMS và thông báo", "Approved – the account is being created and the customer will be notified")); }
          close();
        }}>{needsChecker && !isCheckerView ? tr("Gửi Checker", "Send to checker") : tr("Phê duyệt", "Approve")}</Button></>}
      >
        {needsChecker && !isCheckerView
          ? <Alert tone="warning" title={tr("Hồ sơ rủi ro cao", "High-risk case")}>{tr("Có cờ PEP/Sanction hoặc điểm rủi ro vùng cao. Tài khoản chỉ được tạo sau khi một Checker khác phê duyệt.", "PEP/sanctions flag or high risk score. The account is only created after a second person approves.")}</Alert>
          : <p className="text-body-sm text-fg-secondary">{tr("Tài khoản sẽ được tạo và khách nhận thông báo ngay. Quyết định không thể hoàn tác.", "The account will be created and the customer notified immediately. This can't be undone.")}</p>}
        <label htmlFor="approve-note" className="mt-4 block text-body-sm font-medium">{tr("Ghi chú nội bộ", "Internal note")}</label>
        <textarea id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={textarea} placeholder={tr("Căn cứ phê duyệt (khuyến nghị)", "Basis for approval (recommended)")} />
      </Modal>

      <Modal open={modal === "request"} onClose={close} title={tr("Yêu cầu khách bổ sung", "Request more information")}
        footer={<><Button variant="ghost" onClick={close}>{tr("Huỷ", "Cancel")}</Button><Button disabled={reqSel.length === 0} onClick={() => { update(c.id, { status: "pending_customer", requestCount: c.requestCount + 1 }); setDone(tr("Đã gửi yêu cầu bổ sung – SLA tạm dừng đến khi khách gửi lại", "Request sent – SLA paused until the customer responds")); close(); }}>{tr("Gửi yêu cầu", "Send request")}</Button></>}
      >
        <p className="text-body-sm text-fg-secondary">{tr(`Khách nhận SMS và thông báo kèm đường dẫn mở thẳng màn hình bổ sung. Hạn 5 ngày. Lần ${c.requestCount + 1}/2.`, `The customer gets an SMS and a push notification linking straight to the upload screen. 5-day deadline. Request ${c.requestCount + 1} of 2.`)}</p>
        <fieldset className="mt-4">
          <legend className="text-body-sm font-medium">{tr("Hạng mục cần bổ sung", "Items needed")} <span className="text-danger">*</span></legend>
          <div className="mt-2 flex flex-col gap-1">
            {REQ.map((r, i) => (
              <label key={i} htmlFor={`req-${i}`} className="interactive flex cursor-pointer items-center gap-3 rounded-md px-2 py-2">
                <input id={`req-${i}`} type="checkbox" className="size-4 accent-[var(--action-primary-bg)]" checked={reqSel.includes(i)} onChange={(e) => setReqSel(e.target.checked ? [...reqSel, i] : reqSel.filter((x) => x !== i))} />
                <span className="text-body-sm">{r}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label htmlFor="req-note" className="mt-3 block text-body-sm font-medium">{tr("Lời nhắn cho khách", "Message to customer")}</label>
        <textarea id="req-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={textarea} />
        <p className="mt-1 text-caption text-fg-tertiary">{tr("Không ghi thông tin về PEP, AML hay CIC trong lời nhắn.", "Don't mention PEP, AML or CIC in this message.")}</p>
      </Modal>

      <Modal open={modal === "reject"} onClose={close} title={tr("Từ chối hồ sơ", "Reject application")}
        footer={<><Button variant="ghost" onClick={close}>{tr("Huỷ", "Cancel")}</Button><Button variant="danger" disabled={!rejReason} onClick={() => { update(c.id, { decision: { type: "rejected", by: ME, at: "09:45 · 09/11/2026" } }); setDone(tr("Đã từ chối hồ sơ – khách nhận thông báo với lý do chung", "Rejected – the customer receives a general notice")); close(); }}>{tr("Xác nhận từ chối", "Confirm rejection")}</Button></>}
      >
        <Alert tone="danger" title={tr("Quyết định không thể hoàn tác", "This can't be undone")}>{tr("Khách nhận thông báo với lý do chung, không thấy lý do nội bộ.", "The customer sees a general reason, not the internal one.")}</Alert>
        <label htmlFor="rej-reason" className="mt-4 block text-body-sm font-medium">{tr("Lý do nội bộ", "Internal reason")} <span className="text-danger">*</span></label>
        <select id="rej-reason" value={rejReason} onChange={(e) => setRejReason(e.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-line-strong bg-bg-surface px-3 text-body-sm outline-none focus:border-action focus:ring-4 focus:ring-focus">
          <option value="">{tr("Chọn lý do", "Select a reason")}</option>
          {REJ.map((r) => <option key={r}>{r}</option>)}
        </select>
        <label htmlFor="rej-note" className="mt-3 block text-body-sm font-medium">{tr("Ghi chú", "Note")}</label>
        <textarea id="rej-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={textarea} />
      </Modal>
    </div>
  );
}
