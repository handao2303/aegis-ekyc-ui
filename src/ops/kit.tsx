/* Bộ khung dashboard vận hành (Đối soát, Hạn mức) – phong cách sidebar xám, vùng làm việc trắng, gradient tím → cam */
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight, Bell, ChevronDown, CreditCard, Download, LogOut, Search, ShieldCheck, Sparkles, X,
  type LucideIcon,
} from "lucide-react";
import { cx } from "../components/ui";
import { LangSwitch, useLang } from "../i18n";

/* ---------- Định dạng ---------- */

/** 1.250.000.000 → "1,25 tỷ ₫"; dưới 1 tỷ hiển thị triệu */
export function vnd(n: number, compact = true) {
  const abs = Math.abs(n);
  if (compact && abs >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ ₫`;
  if (compact && abs >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr ₫`;
  return `${n.toLocaleString("vi-VN")} ₫`;
}
export const pct = (n: number, d = 1) => `${n.toLocaleString("vi-VN", { maximumFractionDigits: d, minimumFractionDigits: d })}%`;

/* ---------- Nhãn trạng thái dạng viên ---------- */

export type PillTone = "success" | "pending" | "error" | "warning" | "neutral" | "brand";
const pillCls: Record<PillTone, string> = {
  success: "bg-[#e8f7ef] text-[#157347]",
  pending: "bg-[#eaf1ff] text-[#1d4fbf]",
  error: "bg-[#fdf0ee] text-[#b42318]",
  warning: "bg-[#fef4dd] text-[#8a5300]",
  neutral: "bg-bg-sunken text-fg-secondary",
  brand: "bg-[#f3ecfe] text-[#6a2fb5]",
};
export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold", pillCls[tone], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

/* ---------- Thẻ & bảng ---------- */

export function Panel({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("min-w-0 rounded-[20px] border border-line-subtle bg-bg-surface", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={pad ? "p-5 pt-4" : "pt-3"}>{children}</div>
    </section>
  );
}

/** Thẻ chỉ số: con số lớn + mô tả, dải nhãn ở đáy; featured = dải gradient */
export function StatCard({ icon: Icon, value, caption, label, delta, featured, onClick }: {
  icon: LucideIcon; value: string; caption: string; label: string; delta?: { text: string; good: boolean }; featured?: boolean; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cx(
        "interactive flex min-w-0 flex-col overflow-hidden rounded-[16px] border text-left",
        featured ? "border-[#f7b31b]/70 shadow-[0_0_0_1px_rgba(247,179,27,0.35)]" : "border-line-subtle",
      )}
    >
      <div className="flex items-start gap-3 bg-bg-surface p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line-subtle text-fg-secondary"><Icon className="size-[18px]" aria-hidden /></span>
        <span className="min-w-0">
          <span className="block truncate text-[18px] font-semibold tabular leading-6">{value}</span>
          <span className="block truncate text-caption text-fg-tertiary">{caption}</span>
        </span>
        {delta && (
          <span className={cx("ml-auto shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold tabular", delta.good ? "bg-[#e8f7ef] text-[#157347]" : "bg-[#fdf0ee] text-[#b42318]")}>{delta.text}</span>
        )}
      </div>
      <div className={cx("flex items-center justify-between px-4 py-2 text-body-sm", featured ? "text-white" : "bg-bg-sunken text-fg-secondary")} style={featured ? { background: "var(--grad-action)" } : undefined}>
        <span className="truncate font-medium">{label}</span>
      </div>
    </Tag>
  );
}

export function Table({ head, children, empty, minWidth = 720 }: { head: ReactNode[]; children: ReactNode; empty?: boolean; minWidth?: number }) {
  const { tr } = useLang();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-body-sm" style={{ minWidth }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={cx("whitespace-nowrap border-b border-line-subtle bg-bg-sunken px-4 py-2.5 text-left text-caption font-semibold text-fg-secondary", i === 0 && "rounded-l-[10px]", i === head.length - 1 && "rounded-r-[10px]")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line-subtle [&_td]:px-4 [&_td]:py-3 [&_tr:last-child_td]:border-0">{children}</tbody>
      </table>
      {empty && <p className="py-10 text-center text-body-sm text-fg-tertiary">{tr("Không có dữ liệu phù hợp bộ lọc.", "Nothing matches these filters.")}</p>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-56 max-w-full rounded-[10px] border border-line-subtle bg-bg-sunken pl-9 pr-3 text-body-sm outline-none focus:border-[#b46cf6]" />
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="h-9 appearance-none rounded-[10px] border border-line-subtle bg-bg-surface pl-3 pr-8 text-body-sm font-medium outline-none focus:border-[#b46cf6]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line-subtle p-0.5">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx("h-7 rounded-full px-3 text-caption font-semibold", value === o.value ? "bg-bg-sunken text-fg-primary" : "text-fg-tertiary")}>
          {value === o.value && <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Thanh tiến độ gradient (hạn mức, tỷ lệ khớp…) */
export function Meter({ value, label, tone = "brand" }: { value: number; label: string; tone?: "brand" | "danger" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: tone === "danger" ? "#b42318" : "var(--grad-brand)" }} />
    </div>
  );
}

/** Ghi chú truy vết quy tắc nghiệp vụ */
export function RuleTag({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-bg-sunken px-1.5 py-0.5 text-caption font-semibold text-fg-secondary">{children}</code>;
}

/* ---------- Biểu đồ đường (SVG, không thư viện) ---------- */

export type Series = { name: string; color: string; values: number[]; dashed?: boolean };

function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] ?? pts[i];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2] ?? pts[i + 1];
    const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  }
  return d;
}

export function LineChart({ labels, series, format, height = 240, min, max }: { labels: string[]; series: Series[]; format: (n: number) => string; height?: number; min?: number; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 52, r: 12, t: 12, b: 26 };
  const all = series.flatMap((s) => s.values);
  const lo = min ?? Math.min(...all) * 0.9;
  const hi = max ?? Math.max(...all) * 1.08;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, labels.length - 1);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const ticks = useMemo(() => Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4), [lo, hi]);
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label={series.map((s) => s.name).join(", ")} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-tertiary)">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l + i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--text-tertiary)">{l}</text>
        ))}
        {series.map((s) => (
          <path key={s.name} d={smooth(s.values.map((v, i) => [x(i), y(v)]))} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.75} strokeDasharray={s.dashed ? "5 5" : undefined} strokeLinecap="round" />
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - (w - pad.l - pad.r) / labels.length / 2} y={pad.t} width={(w - pad.l - pad.r) / labels.length} height={height - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--border-strong)" strokeDasharray="3 3" />
            {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill="#fff" stroke={s.color} strokeWidth={2.5} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-[10px] bg-[#1a1a1a] px-3 py-2 text-caption text-white shadow-overlay" style={{ left: Math.min(Math.max(x(hover), 90), w - 90) }}>
          <p className="mb-1 font-semibold">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-2 tabular"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.name}: <b>{format(s.values[hover])}</b></p>
          ))}
        </div>
      )}
      <ul className="mt-1 flex flex-wrap gap-4 text-caption text-fg-secondary">
        {series.map((s) => <li key={s.name} className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-full" style={{ background: s.color }} />{s.name}</li>)}
      </ul>
    </div>
  );
}

/** Thanh ngang so sánh (top nguyên nhân, nguồn dữ liệu…) */
export function HBars({ rows, format }: { rows: { label: string; value: number }[]; format: (n: number) => string }) {
  const top = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-body-sm"><span className="truncate">{r.label}</span><span className="shrink-0 font-semibold tabular">{format(r.value)}</span></div>
          <Meter value={(r.value / top) * 100} label={r.label} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- Khung trang ---------- */

export type NavItem<V extends string> = { id: V; label: string; icon: LucideIcon; count?: number };
type Module = "compliance" | "reconciliation" | "credit-limit";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function ModuleSwitch({ current }: { current: Module }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const mods: { id: Module; label: string; desc: string; icon: LucideIcon }[] = [
    { id: "compliance", label: "Compliance", desc: tr("Xét duyệt eKYC", "eKYC review"), icon: ShieldCheck },
    { id: "reconciliation", label: tr("Đối soát", "Reconciliation"), desc: tr("Khớp giao dịch & GL", "Matching & GL"), icon: ArrowLeftRight },
    { id: "credit-limit", label: tr("Hạn mức", "Credit limit"), desc: tr("Authorization & Boost", "Authorization & Boost"), icon: CreditCard },
  ];
  const cur = mods.find((m) => m.id === current)!;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="interactive flex w-full items-center gap-3 rounded-[14px] p-2 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] text-white" style={{ background: "var(--grad-action)" }}><cur.icon className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-5">Aegis {cur.label}</span>
          <span className="block truncate text-caption text-fg-tertiary">{cur.desc}</span>
        </span>
        <ChevronDown className="size-4 text-fg-tertiary" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-[14px] border border-line-subtle bg-bg-surface p-1.5 shadow-overlay">
          {mods.map((m) => (
            <a key={m.id} role="menuitem" href={`${BASE}/${m.id}/`} aria-current={m.id === current ? "page" : undefined}
              className={cx("interactive flex items-center gap-3 rounded-[10px] p-2", m.id === current && "bg-bg-sunken")}>
              <m.icon className="size-4 text-[#8a45e0]" aria-hidden />
              <span><span className="block text-body-sm font-semibold">{m.label}</span><span className="block text-caption text-fg-tertiary">{m.desc}</span></span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function OpsShell<V extends string>({ module, nav, view, onView, user, role, greeting, subtitle, period, onPeriod, onExport, children, alerts }: {
  module: Module; nav: NavItem<V>[]; view: V; onView: (v: V) => void; user: string; role: string;
  greeting: string; subtitle: string; period: string; onPeriod: (p: string) => void; onExport: () => void; children: ReactNode;
  alerts: { title: string; time: string; tone: PillTone }[];
}) {
  const { tr } = useLang();
  const [q, setQ] = useState("");
  const [bell, setBell] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("skin-aurora");
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") setBell(false);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.classList.remove("skin-aurora"); window.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const found = q.trim() ? nav.filter((n) => n.label.toLowerCase().includes(q.trim().toLowerCase())) : nav;

  if (signedOut)
    return (
      <div className="grid min-h-screen place-items-center bg-bg-sunken p-6">
        <div className="w-full max-w-sm rounded-[20px] border border-line-subtle bg-bg-surface p-6 text-center">
          <ShieldCheck className="mx-auto size-10 text-[#8a45e0]" />
          <h1 className="mt-3 text-title">{tr("Bạn đã đăng xuất", "You've signed out")}</h1>
          <button onClick={() => setSignedOut(false)} className="btn interactive mt-5 h-11 w-full rounded-full font-semibold text-white" style={{ background: "var(--grad-action)" }}>{tr("Đăng nhập lại", "Sign in again")}</button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-sunken lg:flex">
      {/* Sidebar */}
      <aside className="flex flex-col gap-4 p-3 lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:shrink-0 lg:p-4">
        <ModuleSwitch current={module} />
        <label className="relative hidden lg:block">
          <span className="sr-only">{tr("Tìm màn hình", "Find a screen")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Tìm kiếm…", "Search…")}
            className="h-10 w-full rounded-[12px] bg-[#ebedf2] pl-9 pr-12 text-body-sm outline-none focus:ring-2 focus:ring-[#b46cf6]/50" />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-fg-tertiary">⌘K</kbd>
        </label>
        <nav aria-label={tr("Điều hướng", "Navigation")} className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {found.map((n) => (
            <button key={n.id} onClick={() => { onView(n.id); setQ(""); }} aria-current={view === n.id ? "page" : undefined}
              className={cx("interactive flex h-10 shrink-0 items-center gap-3 rounded-[12px] px-3 text-body-sm font-medium",
                view === n.id ? "bg-bg-surface text-fg-primary shadow-[0_1px_2px_rgba(26,26,26,0.06),0_0_0_1px_#e9eaee]" : "text-fg-secondary")}>
              <n.icon className="size-[18px] shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{n.label}</span>
              {n.count !== undefined && <span className="ml-auto rounded-full bg-[#f3ecfe] px-2 text-caption font-semibold text-[#6a2fb5] tabular">{n.count}</span>}
            </button>
          ))}
          {found.length === 0 && <p className="px-3 text-caption text-fg-tertiary">{tr("Không tìm thấy", "No match")}</p>}
        </nav>
        <div className="mt-auto hidden items-center gap-3 rounded-[14px] bg-bg-surface p-3 shadow-[0_0_0_1px_#e9eaee] lg:flex">
          <span className="grid size-9 shrink-0 place-items-center rounded-full text-caption font-bold text-white" style={{ background: "var(--grad-brand)" }}>{user.split(" ").map((w) => w[0]).slice(-2).join("")}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-body-sm font-semibold">{user}</span><span className="block truncate text-caption text-fg-tertiary">{role}</span></span>
          <button onClick={() => setSignedOut(true)} className="interactive grid size-8 place-items-center rounded-full text-fg-tertiary" aria-label={tr("Đăng xuất", "Sign out")}><LogOut className="size-4" /></button>
        </div>
      </aside>

      {/* Vùng làm việc */}
      <main className="min-w-0 flex-1 p-3 pt-0 lg:py-4 lg:pl-0 lg:pr-4">
        <div className="min-h-[calc(100vh-32px)] rounded-[24px] border border-line-subtle bg-bg-surface p-4 sm:p-6">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em]">{greeting} <Sparkles className="size-5 text-[#f7b31b]" aria-hidden /></h1>
              <p className="mt-0.5 text-body-sm text-fg-tertiary">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LangSwitch />
              <Select value={period} onChange={onPeriod} label={tr("Kỳ báo cáo", "Period")} options={[
                { value: "today", label: tr("Hôm nay", "Today") }, { value: "7d", label: tr("7 ngày", "7 days") }, { value: "month", label: tr("Tháng này", "This month") },
              ]} />
              <button onClick={() => { onExport(); setToast(tr("Đã xuất báo cáo CSV (dữ liệu mẫu)", "CSV report exported (sample data)")); }} className="interactive inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-subtle px-3 text-body-sm font-medium">
                <Download className="size-4" aria-hidden />{tr("Xuất", "Export")}
              </button>
              <div className="relative">
                <button onClick={() => setBell(!bell)} aria-expanded={bell} className="interactive relative grid size-9 place-items-center rounded-[10px] border border-line-subtle" aria-label={tr("Cảnh báo", "Alerts")}>
                  <Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#f7b31b]" aria-hidden />
                </button>
                {bell && (
                  <div role="dialog" aria-label={tr("Cảnh báo", "Alerts")} className="absolute right-0 top-11 z-40 w-[320px] max-w-[calc(100vw-32px)] rounded-[14px] border border-line-subtle bg-bg-surface shadow-overlay">
                    <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3"><p className="text-body-sm font-semibold">{tr("Cảnh báo", "Alerts")}</p><button onClick={() => setBell(false)} aria-label={tr("Đóng", "Close")}><X className="size-4 text-fg-tertiary" /></button></div>
                    <ul>{alerts.map((a) => (
                      <li key={a.title} className="flex gap-3 border-b border-line-subtle px-4 py-3 last:border-0"><Pill tone={a.tone}>{a.time}</Pill><span className="text-body-sm">{a.title}</span></li>
                    ))}</ul>
                  </div>
                )}
              </div>
            </div>
          </header>
          {children}
        </div>
      </main>
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1a1a1a] px-4 py-2.5 text-body-sm text-white shadow-overlay">{toast}</div>}
    </div>
  );
}

/** Nút gradient chính */
export function GradientButton({ children, onClick, disabled, icon: Icon }: { children: ReactNode; onClick?: () => void; disabled?: boolean; icon?: LucideIcon }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="btn interactive inline-flex h-10 items-center gap-2 rounded-full px-5 text-body-sm font-semibold text-white disabled:cursor-not-allowed disabled:!bg-none disabled:bg-[#d9dbe1] disabled:text-fg-secondary"
      style={disabled ? undefined : { background: "var(--grad-action)" }}>
      {Icon && <Icon className="size-4" aria-hidden />}{children}
    </button>
  );
}

export function GhostButton({ children, onClick, icon: Icon, tone }: { children: ReactNode; onClick?: () => void; icon?: LucideIcon; tone?: "danger" }) {
  return (
    <button onClick={onClick} className={cx("interactive inline-flex h-10 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold", tone === "danger" ? "border-[#f3c6c0] text-[#b42318]" : "border-line-subtle")}>
      {Icon && <Icon className="size-4" aria-hidden />}{children}
    </button>
  );
}
