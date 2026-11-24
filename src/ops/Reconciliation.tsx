/* Aegis Đối soát – REC-01 → REC-06 (SCRUM-49), truy vết dữ liệu (SCRUM-50). Dữ liệu hư cấu. */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, Database, GitBranch, Inbox,
  LayoutDashboard, ListChecks, Plus, ScrollText, ShieldAlert, Sparkles, Timer, Wallet, Zap,
} from "lucide-react";
import { Modal, cx } from "../components/ui";
import { LangProvider, useLang } from "../i18n";
import {
  GhostButton, GradientButton, HBars, LineChart, Meter, OpsShell, Panel, Pill, type PillTone, RuleTag, SearchBox, Segmented, Select, StatCard, Table, pct, vnd,
} from "./kit";

const NAM = "Lê Hoàng Nam";
/* Người dùng UAT – đổi vai trò để kiểm Maker-Checker và RULE-REC-05 (R04 §2) */
const USERS = [
  { name: NAM, vi: "Chuyên viên đối soát", en: "Reconciliation officer" },
  { name: "Phạm Thu Trang", vi: "Kiểm soát viên (Checker)", en: "Controller (checker)" },
  { name: "Đỗ Minh Quân", vi: "Trưởng nhóm đối soát", en: "Reconciliation lead" },
];
const MeCtx = createContext(NAM);
const useMe = () => useContext(MeCtx);
const GL_THRESHOLD = 50_000_000; // RULE-REC-04 – giữ baseline vì CR-002 chưa duyệt

type View = "dashboard" | "rules" | "exceptions" | "gl";

/* ---------- Dữ liệu mẫu ---------- */

type SourceStatus = "ok" | "delayed" | "quarantine";
const SOURCES: { id: string; name: string; kind: string; records: number; matched: number; last: string; status: SourceStatus; note?: { vi: string; en: string } }[] = [
  { id: "cbs", name: "Core Banking (CBS)", kind: "SFTP · CSV", records: 1_284_330, matched: 99.1, last: "09:40", status: "ok" },
  { id: "napas", name: "NAPAS 247", kind: "API · ISO 20022", records: 418_902, matched: 97.8, last: "09:35", status: "ok" },
  { id: "visa", name: "Visa settlement", kind: "SFTP · TC33", records: 96_114, matched: 94.2, last: "06:10", status: "delayed", note: { vi: "Trễ 3h so với lịch 07:00", en: "3h behind the 07:00 schedule" } },
  { id: "mc", name: "Mastercard settlement", kind: "SFTP · IPM", records: 71_506, matched: 95.6, last: "06:05", status: "ok" },
  { id: "wallet", name: "Cổng ví điện tử", kind: "API · JSON", records: 0, matched: 0, last: "09:12", status: "quarantine", note: { vi: "File lỗi định dạng – đã cách ly (UAT-REC-02)", en: "Malformed file – quarantined (UAT-REC-02)" } },
];

type RuleType = "EXACT" | "FUZZY" | "N1";
type RuleStatus = "ACTIVE" | "PENDING" | "DRAFT";
type Rule = { id: string; name: string; type: RuleType; keys: string[]; tolerance: string; version: number; status: RuleStatus; maker: string; checker?: string; hit: number };
const RULES0: Rule[] = [
  { id: "MR-001", name: "CBS ↔ NAPAS · khớp tuyệt đối", type: "EXACT", keys: ["ref", "amount", "date"], tolerance: "0 ₫ · 0 ngày", version: 7, status: "ACTIVE", maker: "Phạm Thu Trang", checker: "Lê Hoàng Nam", hit: 71.2 },
  { id: "MR-002", name: "CBS ↔ Visa · lệch tỷ giá", type: "FUZZY", keys: ["amount", "date", "account"], tolerance: "±0,5% · ±1 ngày", version: 4, status: "ACTIVE", maker: "Đỗ Minh Quân", checker: "Phạm Thu Trang", hit: 14.6 },
  { id: "MR-003", name: "Gộp phí N:1 Mastercard", type: "N1", keys: ["batch", "amount"], tolerance: "≤ 20 giao dịch/lô", version: 2, status: "ACTIVE", maker: "Đỗ Minh Quân", checker: "Lê Hoàng Nam", hit: 6.3 },
  { id: "MR-004", name: "Ví điện tử · mã tham chiếu rút gọn", type: "FUZZY", keys: ["ref", "amount"], tolerance: "Levenshtein ≤ 2", version: 1, status: "PENDING", maker: "Lê Hoàng Nam", hit: 0 },
  { id: "MR-005", name: "Hoàn tiền NAPAS (refund)", type: "EXACT", keys: ["ref", "amount"], tolerance: "0 ₫", version: 1, status: "DRAFT", maker: "Phạm Thu Trang", hit: 0 },
];

// PENDING_POSTING: đã hạch toán điều chỉnh > ngưỡng, chờ Checker. Ngoại lệ chỉ đóng khi bút toán POSTED (DEF-REC-06)
type ExStatus = "OPEN" | "IN_PROGRESS" | "ESCALATED" | "PENDING_POSTING" | "RESOLVED";
type Resolution = "ADJUSTMENT" | "MANUAL_MATCH" | "REQUEST_DOCS";
type Ex = {
  id: string; pair: string; rule: string; kind: "UNMATCHED" | "PARTIAL" | "DUPLICATE"; amount: number; diff: number; ageH: number; dueH: number;
  owner?: string; status: ExStatus; causes: { vi: string; en: string; p: number }[];
  resolution?: { type: Resolution; cause: string; override: boolean; note?: string; ref?: string };
  waitingDocs?: string;
  internal: { ref: string; date: string; acct: string; amount: number }; external: { ref: string; date: string; acct: string; amount: number } | null;
};
const EX0: Ex[] = [
  { id: "EXC-1124", pair: "CBS ↔ Visa", rule: "MR-002", kind: "PARTIAL", amount: 48_250_000, diff: 241_250, ageH: 30, dueH: 24, owner: NAM, status: "IN_PROGRESS",
    causes: [{ vi: "Chênh lệch tỷ giá quy đổi USD/VND", en: "USD/VND conversion difference", p: 78 }, { vi: "Phí chuyển đổi ngoại tệ chưa hạch toán", en: "Unbooked FX fee", p: 15 }, { vi: "Làm tròn của tổ chức thẻ", en: "Card scheme rounding", p: 7 }],
    internal: { ref: "FT2611093321", date: "20/11 14:02", acct: "1903 6688 2025", amount: 48_250_000 }, external: { ref: "VS-883102", date: "21/11 06:10", acct: "4111 •••• 1234", amount: 48_008_750 } },
  { id: "EXC-1125", pair: "CBS ↔ NAPAS", rule: "MR-001", kind: "UNMATCHED", amount: 125_000_000, diff: 125_000_000, ageH: 52, dueH: 48, status: "ESCALATED",
    causes: [{ vi: "Giao dịch NAPAS chưa về (T+1)", en: "NAPAS record not yet received (T+1)", p: 64 }, { vi: "Sai mã tham chiếu do nhập tay", en: "Manually mistyped reference", p: 24 }, { vi: "Giao dịch bị huỷ phía ngân hàng nhận", en: "Reversed by the beneficiary bank", p: 12 }],
    internal: { ref: "FT2611080017", date: "19/11 09:41", acct: "0071 0003 4567", amount: 125_000_000 }, external: null },
  { id: "EXC-1127", pair: "Mastercard N:1", rule: "MR-003", kind: "PARTIAL", amount: 12_400_000, diff: 18_000, ageH: 6, dueH: 24, status: "OPEN",
    causes: [{ vi: "Thiếu 1 giao dịch phí trong lô", en: "One fee transaction missing from batch", p: 71 }, { vi: "Phí interchange thay đổi", en: "Interchange fee changed", p: 22 }, { vi: "Lô bị tách 2 file", en: "Batch split across two files", p: 7 }],
    internal: { ref: "BATCH-MC-1120", date: "20/11 23:59", acct: "GL 1131.02", amount: 12_400_000 }, external: { ref: "IPM-77812", date: "21/11 06:05", acct: "GL 1131.02", amount: 12_382_000 } },
  { id: "EXC-1128", pair: "CBS ↔ NAPAS", rule: "MR-001", kind: "DUPLICATE", amount: 3_500_000, diff: 3_500_000, ageH: 2, dueH: 24, status: "OPEN",
    causes: [{ vi: "Khách bấm chuyển 2 lần", en: "Customer submitted twice", p: 82 }, { vi: "NAPAS gửi lại bản ghi", en: "NAPAS resent the record", p: 18 }],
    internal: { ref: "FT2611095510", date: "21/11 08:12", acct: "1903 1122 3344", amount: 3_500_000 }, external: { ref: "NP-5510-DUP", date: "21/11 08:12", acct: "1903 1122 3344", amount: 3_500_000 } },
  { id: "EXC-1120", pair: "CBS ↔ Visa", rule: "MR-002", kind: "PARTIAL", amount: 9_870_000, diff: 49_350, ageH: 70, dueH: 72, owner: "Phạm Thu Trang", status: "RESOLVED",
    causes: [{ vi: "Chênh lệch tỷ giá quy đổi USD/VND", en: "USD/VND conversion difference", p: 91 }],
    internal: { ref: "FT2611051209", date: "18/11 10:20", acct: "1903 2211 8899", amount: 9_870_000 }, external: { ref: "VS-881044", date: "19/11 06:08", acct: "4111 •••• 9981", amount: 9_820_650 } },
];

type GLStatus = "POSTED" | "PENDING" | "RETURNED" | "REJECTED";
type GL = { id: string; date: string; debit: string; credit: string; amount: number; source: string; mode: "ZERO_TOUCH" | "MAKER_CHECKER"; maker: string; checker?: string; status: GLStatus; memo: { vi: string; en: string }; rejectReason?: string; returnNote?: string; submits?: number };
const GL0: GL[] = [
  { id: "GL-90311", date: "21/11 09:42", debit: "1131.02", credit: "4211.01", amount: 12_382_000, source: "MR-003 · BATCH-MC-1120", mode: "ZERO_TOUCH", maker: "system", status: "POSTED", memo: { vi: "Tất toán lô Mastercard", en: "Mastercard batch settlement" } },
  { id: "GL-90312", date: "21/11 09:44", debit: "6311.01", credit: "1131.03", amount: 241_250, source: "EXC-1124", mode: "ZERO_TOUCH", maker: NAM, status: "POSTED", memo: { vi: "Điều chỉnh chênh lệch tỷ giá", en: "FX difference adjustment" } },
  { id: "GL-90313", date: "21/11 09:51", debit: "1131.01", credit: "4211.05", amount: 125_000_000, source: "EXC-1125", mode: "MAKER_CHECKER", maker: "Phạm Thu Trang", status: "PENDING", memo: { vi: "Treo chờ NAPAS T+1", en: "Suspense pending NAPAS T+1" } },
  { id: "GL-90314", date: "21/11 10:03", debit: "1131.01", credit: "4211.01", amount: 86_400_000, source: "MR-002 · VS-883190", mode: "MAKER_CHECKER", maker: NAM, status: "PENDING", memo: { vi: "Điều chỉnh lô Visa > 50 triệu", en: "Visa batch adjustment > 50m" } },
  { id: "GL-90309", date: "20/11 17:20", debit: "6311.01", credit: "1131.03", amount: 49_350, source: "EXC-1120", mode: "ZERO_TOUCH", maker: "Phạm Thu Trang", status: "POSTED", memo: { vi: "Điều chỉnh chênh lệch tỷ giá", en: "FX difference adjustment" } },
];

const CHART: Record<string, { labels: string[]; auto: number[]; zero: number[] }> = {
  today: { labels: ["06h", "07h", "08h", "09h", "10h", "11h", "12h"], auto: [93.1, 94.6, 95.8, 96.4, 96.9, 96.2, 96.7], zero: [76.5, 78.2, 80.1, 81.7, 82.3, 81.0, 82.6] },
  "7d": { labels: ["15/11", "16/11", "17/11", "18/11", "19/11", "20/11", "21/11"], auto: [94.8, 95.2, 93.9, 95.6, 96.1, 95.9, 96.4], zero: [77.9, 79.0, 76.4, 79.8, 81.2, 80.6, 81.7] },
  month: { labels: ["T1", "T2", "T3", "T4"], auto: [92.4, 94.1, 95.3, 96.4], zero: [72.8, 76.5, 79.4, 81.7] },
};

/* ---------- Tiện ích hiển thị ---------- */

const ruleTone: Record<RuleStatus, PillTone> = { ACTIVE: "success", PENDING: "pending", DRAFT: "neutral" };
const exTone: Record<ExStatus, PillTone> = { OPEN: "pending", IN_PROGRESS: "brand", ESCALATED: "error", PENDING_POSTING: "warning", RESOLVED: "success" };
const glTone: Record<GLStatus, PillTone> = { POSTED: "success", PENDING: "warning", RETURNED: "pending", REJECTED: "error" };
const caseOf = (g: GL) => g.source.match(/EXC-\d+/)?.[0];
/* Danh mục nguyên nhân chuẩn (REQ-REC-01) – chờ Kế toán + Data chốt (R02 §7 câu 3) */
const CAUSES: { vi: string; en: string }[] = [
  { vi: "Chênh lệch tỷ giá", en: "FX difference" }, { vi: "Phí chưa hạch toán", en: "Unbooked fee" },
  { vi: "Dữ liệu đối tác về trễ", en: "Late partner data" }, { vi: "Sai mã tham chiếu", en: "Wrong reference" },
  { vi: "Giao dịch trùng", en: "Duplicate transaction" }, { vi: "Giao dịch bị huỷ / đảo", en: "Reversed transaction" }, { vi: "Khác", en: "Other" },
];
const aging = (h: number) => (h < 24 ? "0–1d" : h < 72 ? "1–3d" : h < 168 ? "3–7d" : ">7d");

/* ---------- App ---------- */

function RecApp() {
  const { tr, pick } = useLang();
  const [me, setMe] = useState(() => {
    if (typeof window === "undefined") return NAM;
    const as = new URLSearchParams(window.location.search).get("as");
    return USERS.find((u) => u.name.split(" ").at(-1)?.toLowerCase() === as?.toLowerCase())?.name ?? NAM;
  });
  const meUser = USERS.find((u) => u.name === me)!;
  const [view, setView] = useState<View>("dashboard");
  const [period, setPeriod] = useState("7d");
  const [rules, setRules] = useState(RULES0);
  const [exs, setExs] = useState(EX0);
  const [gls, setGls] = useState(GL0);
  const [openEx, setOpenEx] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState(false);

  const openCount = exs.filter((e) => e.status !== "RESOLVED").length;
  const pendingGL = gls.filter((g) => g.status === "PENDING").length;
  const nav = [
    { id: "dashboard" as View, label: tr("Tổng quan", "Overview"), icon: LayoutDashboard },
    { id: "rules" as View, label: tr("Quy tắc đối soát", "Matching rules"), icon: ListChecks, count: rules.filter((r) => r.status === "PENDING").length || undefined },
    { id: "exceptions" as View, label: tr("Ngoại lệ", "Exceptions"), icon: Inbox, count: openCount },
    { id: "gl" as View, label: tr("Bút toán GL", "GL entries"), icon: BookOpen, count: pendingGL || undefined },
  ];

  const go = (v: View) => { setView(v); setOpenEx(null); window.scrollTo(0, 0); };
  const ex = exs.find((e) => e.id === openEx);

  return (
    <MeCtx.Provider value={me}>
    <OpsShell
      module="reconciliation" nav={nav} view={view} onView={go} user={me} role={pick(meUser)}
      greeting={tr(`Chào buổi sáng, ${me.split(" ").at(-1)}`, `Good morning, ${me.split(" ").at(-1)}`)}
      subtitle={tr("Tình hình đối soát giao dịch và các việc cần xử lý hôm nay.", "Today's reconciliation status and what needs your attention.")}
      period={period} onPeriod={setPeriod} onExport={() => {}}
      alerts={[
        { title: tr("File ví điện tử bị cách ly do lỗi định dạng", "Wallet file quarantined: malformed"), time: "09:12", tone: "error" },
        { title: tr("EXC-1125 quá hạn 48h – đã leo thang", "EXC-1125 over 48h – escalated"), time: "08:00", tone: "warning" },
        { title: tr("2 bút toán > 50 triệu chờ Checker", "2 entries > 50m awaiting checker"), time: "10:03", tone: "pending" },
      ]}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-dashed border-line-subtle px-4 py-2 text-body-sm">
        <span className="font-semibold">{tr("Đăng nhập UAT với vai trò", "UAT sign-in as")}</span>
        <Select value={me} onChange={setMe} label={tr("Người dùng UAT", "UAT user")} options={USERS.map((u) => ({ value: u.name, label: `${u.name} · ${pick(u)}` }))} />
        <span className="text-caption text-fg-tertiary">{tr("Chỉ có trên môi trường UAT, để kiểm Maker-Checker.", "UAT only, for testing maker-checker.")} <RuleTag>RULE-REC-05</RuleTag></span>
      </div>
      {view === "dashboard" && <Dashboard period={period} exs={exs} gls={gls} onOpenEx={(id) => { setView("exceptions"); setOpenEx(id); }} go={go} />}
      {view === "rules" && <Rules rules={rules} setRules={setRules} onNew={() => setRuleForm(true)} />}
      {view === "exceptions" && !ex && <Exceptions exs={exs} onOpen={setOpenEx} />}
      {view === "exceptions" && ex && (
        <ExceptionDetail ex={ex} gls={gls} onBack={() => setOpenEx(null)}
          update={(p) => setExs((xs) => xs.map((x) => (x.id === ex.id ? { ...x, ...p } : x)))}
          addGL={(g) => setGls((xs) => [g, ...xs])} />
      )}
      {view === "gl" && <GLView gls={gls} setGls={setGls} rules={rules} exs={exs}
        onCase={(id, outcome) => setExs((xs) => xs.map((x) => (x.id !== id || x.status === "RESOLVED" ? x : outcome === "posted" ? { ...x, status: "RESOLVED" } : x.status === "PENDING_POSTING" ? { ...x, status: "IN_PROGRESS" } : x)))} />}
      <RuleForm open={ruleForm} onClose={() => setRuleForm(false)} onSave={(r) => { setRules((xs) => [r, ...xs]); setRuleForm(false); }} nextId={`MR-${String(rules.length + 1).padStart(3, "0")}`} />
    </OpsShell>
    </MeCtx.Provider>
  );
}

/* ---------- REC-01 Tổng quan ---------- */

function Dashboard({ period, exs, gls, onOpenEx, go }: { period: string; exs: Ex[]; gls: GL[]; onOpenEx: (id: string) => void; go: (v: View) => void }) {
  const { tr, pick } = useLang();
  const c = CHART[period];
  const outstanding = exs.filter((e) => e.status !== "RESOLVED").reduce((s, e) => s + e.diff, 0);
  const [metric, setMetric] = useState<"rate" | "volume">("rate");
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard featured icon={CheckCircle2} value={pct(c.auto.at(-1)!)} caption={tr("Mục tiêu ≥ 95%", "Target ≥ 95%")} label={tr("Tỷ lệ khớp tự động", "Auto-match rate")} delta={{ text: "+0,5", good: true }} />
        <StatCard icon={Timer} value="3,2 h" caption={tr("Trung bình xử lý ngoại lệ", "Mean time to resolve")} label="MTTR" delta={{ text: "−0,4h", good: true }} onClick={() => go("exceptions")} />
        <StatCard icon={Wallet} value={vnd(outstanding)} caption={tr(`${exs.filter((e) => e.status !== "RESOLVED").length} ngoại lệ đang mở`, `${exs.filter((e) => e.status !== "RESOLVED").length} open exceptions`)} label={tr("Giá trị chưa khớp", "Outstanding value")} onClick={() => go("exceptions")} />
        <StatCard icon={Zap} value={pct(c.zero.at(-1)!)} caption={tr(`${gls.filter((g) => g.mode === "ZERO_TOUCH").length} bút toán tự động`, `${gls.filter((g) => g.mode === "ZERO_TOUCH").length} automatic entries`)} label="Zero-touch" delta={{ text: "+1,1", good: true }} onClick={() => go("gl")} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={tr("Hiệu quả đối soát", "Matching performance")} action={<Segmented value={metric} onChange={setMetric} label={tr("Chỉ số", "Metric")} options={[{ value: "rate", label: tr("Tỷ lệ", "Rate") }, { value: "volume", label: tr("Ngoại lệ", "Exceptions") }]} />}>
          <p className="mb-2 flex items-baseline gap-2"><span className="text-[30px] font-semibold tabular">{metric === "rate" ? pct(c.auto.at(-1)!) : String(exs.length * 37)}</span><Pill tone="success">↑ 0,5</Pill></p>
          {metric === "rate" ? (
            <LineChart labels={c.labels} format={(n) => `${n.toFixed(0)}%`} min={70} max={100} series={[
              { name: tr("Khớp tự động", "Auto-match"), color: "#b46cf6", values: c.auto },
              { name: "Zero-touch", color: "#f7b31b", values: c.zero },
              { name: tr("Mục tiêu 95%", "Target 95%"), color: "#cfd2da", values: c.labels.map(() => 95), dashed: true },
            ]} />
          ) : (
            <LineChart labels={c.labels} format={(n) => n.toFixed(0)} min={0} series={[
              { name: tr("Ngoại lệ mới", "New exceptions"), color: "#d98ca0", values: c.auto.map((v) => Math.round((100 - v) * 38)) },
              { name: tr("Đã xử lý", "Resolved"), color: "#b46cf6", values: c.auto.map((v) => Math.round((100 - v) * 34)) },
            ]} />
          )}
        </Panel>

        <Panel title={tr("Nguyên nhân hàng đầu (AI gợi ý)", "Top root causes (AI)")}>
          <HBars format={(n) => `${n}`} rows={[
            { label: tr("Chênh lệch tỷ giá", "FX difference"), value: 42 },
            { label: tr("Dữ liệu đối tác về trễ", "Late partner data"), value: 27 },
            { label: tr("Sai mã tham chiếu", "Wrong reference"), value: 16 },
            { label: tr("Giao dịch trùng", "Duplicates"), value: 9 },
          ]} />
          <p className="mt-4 text-caption text-fg-tertiary">{tr("Số ngoại lệ trong kỳ theo nguyên nhân được AI xếp hạng cao nhất.", "Exceptions this period by the AI's top-ranked cause.")}</p>
        </Panel>
      </div>

      <Panel title={tr("Trạng thái nạp dữ liệu nguồn", "Source ingestion status")} action={<span className="text-caption text-fg-tertiary">{tr("Cập nhật lúc 10:05 · 21/11/2026", "Updated 10:05 · 21 Nov 2026")} <RuleTag>UAT-REC-09</RuleTag></span>}>
        <Table head={[tr("Nguồn", "Source"), tr("Kênh", "Channel"), tr("Bản ghi", "Records"), tr("Tỷ lệ khớp", "Match rate"), tr("Nạp lúc", "Last load"), tr("Trạng thái", "Status")]}>
          {SOURCES.map((s) => (
            <tr key={s.id}>
              <td><span className="flex items-center gap-2 font-medium"><Database className="size-4 text-fg-tertiary" aria-hidden />{s.name}</span>{s.note && <span className="mt-0.5 block text-caption text-fg-tertiary">{pick(s.note)}</span>}</td>
              <td className="text-fg-secondary">{s.kind}</td>
              <td className="tabular">{s.records ? s.records.toLocaleString("vi-VN") : "—"}</td>
              <td className="w-44">{s.records ? <div className="flex items-center gap-2"><Meter value={s.matched} label={s.name} /><span className="w-12 shrink-0 text-right tabular">{pct(s.matched)}</span></div> : "—"}</td>
              <td className="tabular">{s.last}</td>
              <td>{s.status === "ok" ? <Pill tone="success">{tr("Đúng lịch", "On time")}</Pill> : s.status === "delayed" ? <Pill tone="warning">{tr("Trễ", "Delayed")}</Pill> : <Pill tone="error">{tr("Cách ly", "Quarantined")}</Pill>}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title={tr("Ngoại lệ cần chú ý", "Exceptions needing attention")} action={<button onClick={() => go("exceptions")} className="inline-flex items-center gap-1 text-body-sm font-semibold text-[#6a2fb5]">{tr("Xem tất cả", "View all")}<ArrowRight className="size-4" /></button>}>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {exs.filter((e) => e.status !== "RESOLVED").sort((a, b) => b.ageH / b.dueH - a.ageH / a.dueH).slice(0, 3).map((e) => (
            <li key={e.id}>
              <button onClick={() => onOpenEx(e.id)} className="interactive flex w-full flex-wrap items-center gap-3 rounded-[10px] px-2 py-3 text-left">
                <span className="w-24 font-semibold tabular">{e.id}</span>
                <span className="min-w-0 flex-1 truncate text-fg-secondary">{e.pair} · {pick(e.causes[0])}</span>
                <span className="tabular">{vnd(e.diff)}</span>
                {e.ageH > e.dueH ? <Pill tone="error">{tr("Quá hạn", "Overdue")}</Pill> : <Pill tone={exTone[e.status]}>{e.status}</Pill>}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ---------- REC-02 Quy tắc ---------- */

function Rules({ rules, setRules, onNew }: { rules: Rule[]; setRules: (f: (r: Rule[]) => Rule[]) => void; onNew: () => void }) {
  const { tr } = useLang();
  const ME = useMe();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const list = rules.filter((r) => (r.name + r.id).toLowerCase().includes(q.toLowerCase()));
  const typeLabel = (t: RuleType) => (t === "EXACT" ? "Exact" : t === "FUZZY" ? "Fuzzy" : "N:1");
  const approve = (r: Rule) => {
    if (r.maker === ME) { setMsg(tr(`Không thể duyệt ${r.id}: bạn là người tạo quy tắc (RULE-REC-05 – phân tách nhiệm vụ).`, `Can't approve ${r.id}: you created this rule (RULE-REC-05 – segregation of duties).`)); return; }
    setRules((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: "ACTIVE", checker: ME } : x)));
    setMsg(tr(`Đã duyệt ${r.id}, áp dụng từ lần chạy tiếp theo.`, `${r.id} approved; applies from the next run.`));
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-title">{tr("Quy tắc đối soát", "Matching rules")}</h2><p className="text-body-sm text-fg-tertiary">{tr("Cấu hình không cần code. Mọi thay đổi cần người thứ hai duyệt.", "No-code configuration. Every change needs a second approver.")}</p></div>
        <div className="flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder={tr("Tìm quy tắc", "Search rules")} /><GradientButton icon={Plus} onClick={onNew}>{tr("Tạo quy tắc", "New rule")}</GradientButton></div>
      </div>
      {msg && <div role="status" className="flex items-start gap-2 rounded-[14px] bg-[#f3ecfe] px-4 py-3 text-body-sm text-[#4b2386]"><ShieldAlert className="mt-0.5 size-4 shrink-0" />{msg}<button className="ml-auto font-semibold" onClick={() => setMsg(null)}>{tr("Đóng", "Dismiss")}</button></div>}
      <Panel pad={false}>
        <div className="px-5 pb-5">
          <Table minWidth={1000} empty={list.length === 0} head={[tr("Mã", "ID"), tr("Tên quy tắc", "Rule"), tr("Loại", "Type"), tr("Khoá khớp", "Match keys"), tr("Ngưỡng", "Tolerance"), "Version", tr("Tỷ lệ khớp", "Hit rate"), tr("Trạng thái", "Status"), ""]}>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold tabular">{r.id}</td>
                <td><span className="font-medium">{r.name}</span><span className="block text-caption text-fg-tertiary">Maker: {r.maker}{r.checker ? ` · Checker: ${r.checker}` : ""}</span></td>
                <td><Pill tone="brand">{typeLabel(r.type)}</Pill></td>
                <td className="text-fg-secondary">{r.keys.join(" + ")}</td>
                <td className="whitespace-nowrap text-fg-secondary">{r.tolerance}</td>
                <td className="tabular">v{r.version}</td>
                <td className="tabular">{r.hit ? pct(r.hit) : "—"}</td>
                <td><Pill tone={ruleTone[r.status]}>{r.status === "ACTIVE" ? tr("Đang chạy", "Active") : r.status === "PENDING" ? tr("Chờ duyệt", "Pending") : tr("Nháp", "Draft")}</Pill></td>
                <td className="text-right">{r.status === "PENDING" && <button onClick={() => approve(r)} className="interactive rounded-full border border-line-subtle px-3 py-1.5 text-caption font-semibold">{tr("Duyệt", "Approve")}</button>}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------- REC-03 Tạo quy tắc (SoD) ---------- */

function RuleForm({ open, onClose, onSave, nextId }: { open: boolean; onClose: () => void; onSave: (r: Rule) => void; nextId: string }) {
  const { tr } = useLang();
  const ME = useMe();
  const [name, setName] = useState("");
  const [type, setType] = useState<RuleType>("FUZZY");
  const [keys, setKeys] = useState<string[]>(["ref", "amount"]);
  const [amountTol, setAmountTol] = useState("0,5");
  const [dayTol, setDayTol] = useState("1");
  const [checker, setChecker] = useState("Phạm Thu Trang");
  useEffect(() => { if (open) setChecker(USERS.find((u) => u.name !== ME)!.name); }, [open, ME]);
  const sod = checker === ME;
  const valid = name.trim().length >= 4 && keys.length >= 1 && !sod;
  const allKeys = [{ id: "ref", l: tr("Mã tham chiếu", "Reference") }, { id: "amount", l: tr("Số tiền", "Amount") }, { id: "date", l: tr("Ngày giao dịch", "Date") }, { id: "account", l: tr("Tài khoản", "Account") }, { id: "batch", l: tr("Mã lô", "Batch") }];
  return (
    <Modal open={open} onClose={onClose} title={tr("Tạo quy tắc đối soát", "New matching rule")} width={620}
      footer={<><GhostButton onClick={onClose}>{tr("Huỷ", "Cancel")}</GhostButton><GradientButton disabled={!valid} onClick={() => onSave({ id: nextId, name: name.trim(), type, keys, tolerance: type === "N1" ? tr("≤ 20 giao dịch/lô", "≤ 20 txns/batch") : `±${amountTol}% · ±${dayTol} ${tr("ngày", "day")}`, version: 1, status: "PENDING", maker: ME, hit: 0 })}>{tr("Gửi duyệt", "Submit for approval")}</GradientButton></>}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Tên quy tắc", "Rule name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("vd. CBS ↔ NAPAS · hoàn tiền", "e.g. CBS ↔ NAPAS · refunds")} className="h-11 rounded-[12px] border border-line-subtle px-3 outline-none focus:border-[#b46cf6]" /></label>
        <div className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Loại khớp", "Match type")}</span>
          <Segmented value={type} onChange={setType} label={tr("Loại khớp", "Match type")} options={[{ value: "EXACT", label: "Exact" }, { value: "FUZZY", label: "Fuzzy" }, { value: "N1", label: "N:1" }]} /></div>
        <fieldset className="flex flex-col gap-1.5"><legend className="mb-1.5 text-body-sm font-semibold">{tr("Khoá khớp", "Match keys")}</legend>
          <div className="flex flex-wrap gap-2">{allKeys.map((k) => {
            const on = keys.includes(k.id);
            return <button key={k.id} type="button" aria-pressed={on} onClick={() => setKeys(on ? keys.filter((x) => x !== k.id) : [...keys, k.id])} className={cx("interactive h-8 rounded-full border px-3 text-caption font-semibold", on ? "border-[#b46cf6] bg-[#faf6ff] text-[#6a2fb5]" : "border-line-subtle text-fg-secondary")}>{k.l}</button>;
          })}</div></fieldset>
        {type !== "N1" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Lệch số tiền (%)", "Amount tolerance (%)")}</span><input value={amountTol} onChange={(e) => setAmountTol(e.target.value)} disabled={type === "EXACT"} className="h-11 rounded-[12px] border border-line-subtle px-3 tabular disabled:bg-bg-sunken" /></label>
            <label className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Lệch ngày", "Date tolerance (days)")}</span><input value={dayTol} onChange={(e) => setDayTol(e.target.value)} disabled={type === "EXACT"} className="h-11 rounded-[12px] border border-line-subtle px-3 tabular disabled:bg-bg-sunken" /></label>
          </div>
        )}
        <div className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Người duyệt (Checker)", "Approver (checker)")}</span>
          <Select value={checker} onChange={setChecker} label={tr("Người duyệt", "Approver")} options={USERS.map((u) => ({ value: u.name, label: u.name === ME ? `${u.name} (${tr("bạn", "you")})` : u.name }))} /></div>
        {sod && (
          <div role="alert" className="flex gap-3 rounded-[14px] border border-[#f3c6c0] bg-[#fdf0ee] p-4 text-body-sm text-[#7a1a12]">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div><p className="font-semibold">{tr("Vi phạm phân tách nhiệm vụ", "Segregation of duties violation")}</p><p>{tr("Người tạo quy tắc không được tự duyệt. Chọn người duyệt khác để gửi.", "The rule creator can't approve it. Pick another approver to submit.")} <RuleTag>RULE-REC-05</RuleTag></p></div>
          </div>
        )}
        <p className="text-caption text-fg-tertiary">{tr("Quy tắc mới vào trạng thái Chờ duyệt, version 1. Lịch sử thay đổi được lưu vào audit log.", "New rules start as Pending, version 1. Every change is written to the audit log.")}</p>
      </div>
    </Modal>
  );
}

/* ---------- REC-04 Danh sách ngoại lệ ---------- */

function Exceptions({ exs, onOpen }: { exs: Ex[]; onOpen: (id: string) => void }) {
  const { tr, pick } = useLang();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"open" | "all" | ExStatus>("open");
  const list = useMemo(() => exs.filter((e) => (st === "open" ? e.status !== "RESOLVED" : st === "all" ? true : e.status === st) && (e.id + e.pair).toLowerCase().includes(q.toLowerCase())), [exs, st, q]);
  const label: Record<ExStatus, string> = { OPEN: tr("Mới", "Open"), IN_PROGRESS: tr("Đang xử lý", "In progress"), ESCALATED: tr("Đã leo thang", "Escalated"), PENDING_POSTING: tr("Chờ hạch toán", "Awaiting posting"), RESOLVED: tr("Đã xử lý", "Resolved") };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-title">{tr("Ngoại lệ đối soát", "Exceptions")}</h2><p className="text-body-sm text-fg-tertiary">{tr("Giao dịch không khớp hoặc khớp một phần, kèm gợi ý nguyên nhân từ AI.", "Unmatched or partially matched transactions, with AI root-cause suggestions.")}</p></div>
        <div className="flex flex-wrap gap-2">
          <SearchBox value={q} onChange={setQ} placeholder={tr("Tìm mã ngoại lệ", "Search exceptions")} />
          <Select value={st} onChange={setSt} label={tr("Trạng thái", "Status")} options={[{ value: "open", label: tr("Đang mở", "Open") }, { value: "all", label: tr("Tất cả", "All") }, { value: "ESCALATED", label: label.ESCALATED }, { value: "PENDING_POSTING", label: label.PENDING_POSTING }, { value: "RESOLVED", label: label.RESOLVED }]} />
        </div>
      </div>
      <Panel pad={false}>
        <div className="px-5 pb-5">
          <Table minWidth={1000} empty={list.length === 0} head={[tr("Mã", "ID"), tr("Cặp đối soát", "Pair"), tr("Loại", "Type"), tr("Chênh lệch", "Difference"), "Aging", tr("Gợi ý AI", "AI suggestion"), tr("Người xử lý", "Owner"), tr("Trạng thái", "Status")]}>
            {list.map((e) => (
              <tr key={e.id} className="cursor-pointer hover:bg-bg-sunken/60" onClick={() => onOpen(e.id)}>
                <td><button className="font-semibold tabular text-[#6a2fb5] underline-offset-2 hover:underline" onClick={() => onOpen(e.id)}>{e.id}</button></td>
                <td>{e.pair}</td>
                <td><Pill tone="neutral">{e.kind}</Pill></td>
                <td className="tabular">{vnd(e.diff)}</td>
                <td><span className={cx("tabular", e.ageH > e.dueH && e.status !== "RESOLVED" && "font-semibold text-[#b42318]")}>{aging(e.ageH)}</span></td>
                <td className="max-w-[260px]"><span className="flex items-center gap-1.5"><Sparkles className="size-3.5 shrink-0 text-[#d98ca0]" aria-hidden /><span className="truncate">{pick(e.causes[0])}</span><span className="shrink-0 text-caption text-fg-tertiary tabular">{e.causes[0].p}%</span></span></td>
                <td className="text-fg-secondary">{e.owner ?? "—"}</td>
                <td><Pill tone={exTone[e.status]}>{label[e.status]}</Pill></td>
              </tr>
            ))}
          </Table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------- REC-05 Chi tiết ngoại lệ + truy vết ---------- */

const MIN_NOTE = 10;
const textCls = "w-full rounded-[12px] border border-line-subtle px-3 py-2 text-body-sm outline-none focus:border-[#b46cf6] disabled:bg-bg-sunken";

function ExceptionDetail({ ex, gls, onBack, update, addGL }: { ex: Ex; gls: GL[]; onBack: () => void; update: (p: Partial<Ex>) => void; addGL: (g: GL) => void }) {
  const { tr, pick } = useLang();
  const ME = useMe();
  const [cause, setCause] = useState<number | "other">(0);
  const [otherCat, setOtherCat] = useState(0);
  const [otherNote, setOtherNote] = useState("");
  const [how, setHow] = useState<Resolution>(ex.kind === "DUPLICATE" || !ex.external ? "MANUAL_MATCH" : "ADJUSTMENT");
  const [matchRef, setMatchRef] = useState("");
  const [docsNote, setDocsNote] = useState("");
  const done = ex.status === "RESOLVED";
  const overdue = ex.ageH > ex.dueH && !done;
  const linked = gls.filter((g) => g.source.includes(ex.id));
  const gl = linked[0];
  // REQ-REC-08: mỗi ngoại lệ tối đa 1 bút toán điều chỉnh đang chờ (DEF-REC-01)
  const openGL = linked.find((g) => g.status === "PENDING" || g.status === "RETURNED");
  const needsChecker = ex.diff > GL_THRESHOLD;

  const causeOk = cause !== "other" || otherNote.trim().length >= MIN_NOTE;
  const causeText = cause === "other" ? `${pick(CAUSES[otherCat])}: ${otherNote.trim()}` : pick(ex.causes[cause]);
  const causeVi = cause === "other" ? `${CAUSES[otherCat].vi}: ${otherNote.trim()}` : ex.causes[cause].vi;
  const causeEn = cause === "other" ? `${CAUSES[otherCat].en}: ${otherNote.trim()}` : ex.causes[cause].en;
  const howOk = how === "ADJUSTMENT" ? !openGL : how === "MANUAL_MATCH" ? matchRef.trim().length >= 4 : docsNote.trim().length >= MIN_NOTE;
  const canSubmit = !done && causeOk && howOk;

  const submit = () => {
    if (!canSubmit) return;
    const owner = ex.owner ?? ME;
    const resolution = { type: how, cause: causeText, override: cause === "other", note: cause === "other" ? otherNote.trim() : undefined };
    if (how === "ADJUSTMENT") {
      addGL({ id: `GL-${90320 + Math.floor(ex.diff % 97)}`, date: "21/11 10:30", debit: "6311.01", credit: "1131.03", amount: ex.diff, source: ex.id, mode: needsChecker ? "MAKER_CHECKER" : "ZERO_TOUCH", maker: ME, status: needsChecker ? "PENDING" : "POSTED", submits: 1, memo: { vi: `Điều chỉnh: ${causeVi}`, en: `Adjustment: ${causeEn}` } });
      update({ owner, resolution, waitingDocs: undefined, status: needsChecker ? "PENDING_POSTING" : "RESOLVED" });
    } else if (how === "MANUAL_MATCH") {
      update({ owner, resolution: { ...resolution, ref: matchRef.trim() }, waitingDocs: undefined, status: "RESOLVED" });
    } else {
      update({ owner, resolution, waitingDocs: docsNote.trim(), status: "IN_PROGRESS" });
      setDocsNote("");
    }
  };

  const steps = [
    { t: "SourceTransaction", d: ex.internal.ref, ok: true },
    { t: "MatchResult", d: ex.external ? `${ex.kind} · ${ex.pair}` : ex.resolution?.ref ? `${tr("Khớp thủ công", "Manual match")} · ${ex.resolution.ref}` : tr("Không tìm thấy đối ứng", "No counterpart found"), ok: !!ex.external || !!ex.resolution?.ref },
    { t: "ExceptionCase", d: ex.id, ok: true },
    { t: "GLEntry", d: gl ? `${gl.id} · ${gl.status}` : ex.resolution?.type === "MANUAL_MATCH" ? tr("Không cần hạch toán", "No posting needed") : tr("Chưa hạch toán", "Not posted yet"), ok: !!gl },
  ];
  const submitLabel = how === "ADJUSTMENT" ? tr("Tạo bút toán điều chỉnh", "Create adjustment entry") : how === "MANUAL_MATCH" ? tr("Khớp thủ công & đóng", "Match & close") : tr("Gửi yêu cầu chứng từ", "Request documents");

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-body-sm font-semibold text-fg-secondary"><ArrowLeft className="size-4" />{tr("Danh sách ngoại lệ", "All exceptions")}</button>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[24px] font-semibold tabular">{ex.id}</h2>
        <Pill tone={exTone[ex.status]}>{ex.status}</Pill>
        <span className="text-body-sm text-fg-tertiary">{ex.pair} · {ex.kind} · aging {aging(ex.ageH)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {!done && !ex.owner && <GhostButton onClick={() => update({ owner: ME, status: ex.status === "OPEN" ? "IN_PROGRESS" : ex.status })}>{tr("Nhận xử lý", "Claim")}</GhostButton>}
          {!done && ex.status !== "ESCALATED" && ex.status !== "PENDING_POSTING" && <GhostButton tone="danger" icon={AlertTriangle} onClick={() => update({ status: "ESCALATED" })}>{tr("Leo thang", "Escalate")}</GhostButton>}
        </div>
      </div>

      {overdue && (
        <div role="alert" className="flex gap-3 rounded-[16px] border border-[#f3c6c0] bg-[#fdf0ee] p-4 text-body-sm text-[#7a1a12]">
          <Clock className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">{tr(`Quá hạn xử lý ${ex.ageH - ex.dueH} giờ`, `Overdue by ${ex.ageH - ex.dueH} hours`)}</p><p>{tr("Ngoại lệ đã vượt SLA và được leo thang tự động lên trưởng nhóm đối soát.", "This exception passed its SLA and was escalated to the team lead automatically.")} <RuleTag>RULE-REC-06</RuleTag></p></div>
        </div>
      )}
      {ex.waitingDocs && !done && (
        <div role="status" className="flex gap-3 rounded-[16px] bg-[#f3ecfe] p-4 text-body-sm text-[#4b2386]">
          <Inbox className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">{tr("Đang chờ chứng từ bổ sung", "Waiting for supporting documents")}</p><p>{ex.waitingDocs}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={tr("So sánh giao dịch", "Transaction comparison")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[{ h: tr("Nội bộ (CBS)", "Internal (CBS)"), v: ex.internal }, { h: tr("Đối tác", "Counterparty"), v: ex.external }].map((c) => (
              <div key={c.h} className="rounded-[16px] bg-bg-sunken p-4">
                <p className="mb-2 text-caption font-semibold text-fg-tertiary">{c.h}</p>
                {c.v ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
                    <dt className="text-fg-tertiary">{tr("Tham chiếu", "Reference")}</dt><dd className="text-right font-medium tabular">{c.v.ref}</dd>
                    <dt className="text-fg-tertiary">{tr("Thời gian", "Time")}</dt><dd className="text-right tabular">{c.v.date}</dd>
                    <dt className="text-fg-tertiary">{tr("Tài khoản", "Account")}</dt><dd className="text-right tabular">{c.v.acct}</dd>
                    <dt className="text-fg-tertiary">{tr("Số tiền", "Amount")}</dt><dd className="text-right font-semibold tabular">{vnd(c.v.amount, false)}</dd>
                  </dl>
                ) : <p className="py-6 text-center text-body-sm text-fg-tertiary">{tr("Chưa có bản ghi đối ứng", "No matching record yet")}</p>}
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center justify-between rounded-[12px] border border-line-subtle px-4 py-3 text-body-sm"><span className="text-fg-secondary">{tr("Chênh lệch", "Difference")}</span><span className="text-[18px] font-semibold tabular">{vnd(ex.diff, false)}</span></p>
        </Panel>

        <Panel title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-[#d98ca0]" />{tr("Nguyên nhân", "Root cause")}</span>}>
          <ul role="radiogroup" aria-label={tr("Nguyên nhân", "Cause")} className="flex flex-col gap-2">
            {ex.causes.slice(0, 3).map((c, i) => (
              <li key={c.en}>
                <button role="radio" aria-checked={cause === i} onClick={() => setCause(i)} disabled={done}
                  className={cx("interactive w-full rounded-[14px] border p-3 text-left", cause === i ? "border-[#b46cf6] bg-[#faf6ff]" : "border-line-subtle")}>
                  <span className="mb-2 flex justify-between gap-2 text-body-sm"><span className="font-medium">{pick(c)}</span><span className="font-semibold tabular">{c.p}%</span></span>
                  <Meter value={c.p} label={pick(c)} />
                </button>
              </li>
            ))}
            <li>
              <button role="radio" aria-checked={cause === "other"} onClick={() => setCause("other")} disabled={done}
                className={cx("interactive w-full rounded-[14px] border p-3 text-left text-body-sm font-medium", cause === "other" ? "border-[#b46cf6] bg-[#faf6ff]" : "border-line-subtle")}>
                {tr("Nguyên nhân khác (không theo gợi ý AI)", "Other cause (override AI)")}
              </button>
            </li>
          </ul>
          {cause === "other" && !done && (
            <div className="mt-3 flex flex-col gap-2">
              <Select value={String(otherCat)} onChange={(v) => setOtherCat(Number(v))} label={tr("Danh mục nguyên nhân", "Cause category")} options={CAUSES.map((c, i) => ({ value: String(i), label: pick(c) }))} />
              <textarea aria-label={tr("Ghi chú nguyên nhân", "Cause note")} value={otherNote} onChange={(e) => setOtherNote(e.target.value)} rows={2} className={textCls}
                placeholder={tr(`Mô tả nguyên nhân (tối thiểu ${MIN_NOTE} ký tự)`, `Describe the cause (at least ${MIN_NOTE} characters)`)} />
              <p className="text-caption text-fg-tertiary">{tr("Lựa chọn này được ghi là override để huấn luyện lại mô hình.", "Recorded as an override for model retraining.")} <RuleTag>REQ-REC-01</RuleTag></p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={tr("Xử lý ngoại lệ", "Resolve exception")} action={<RuleTag>UC-REC-04 · REQ-REC-02</RuleTag>}>
        {done ? (
          <p className="text-body-sm text-fg-secondary">
            {tr("Đã đóng", "Closed")} · {ex.resolution ? `${ex.resolution.type === "MANUAL_MATCH" ? tr("Khớp thủ công", "Manual match") + (ex.resolution.ref ? ` (${ex.resolution.ref})` : "") : tr("Hạch toán điều chỉnh", "Adjustment")} · ${ex.resolution.cause}` : tr("Xử lý trước khi có hệ thống mới", "Resolved earlier")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Segmented value={how} onChange={setHow} label={tr("Cách xử lý", "Resolution")} options={[
              { value: "ADJUSTMENT", label: tr("Hạch toán điều chỉnh", "Adjustment") },
              { value: "MANUAL_MATCH", label: tr("Khớp thủ công", "Manual match") },
              { value: "REQUEST_DOCS", label: tr("Yêu cầu chứng từ", "Request documents") },
            ]} />
            {how === "ADJUSTMENT" && (openGL ? (
              <div role="alert" className="flex gap-3 rounded-[14px] border border-[#f7d9a8] bg-[#fff7e8] p-4 text-body-sm text-[#7a4a00]">
                <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                <div><p className="font-semibold">{tr(`Đã có bút toán ${openGL.id} (${vnd(openGL.amount)}) đang chờ Checker`, `${openGL.id} (${vnd(openGL.amount)}) is already awaiting a checker`)}</p><p>{tr("Không tạo thêm bút toán điều chỉnh cho ngoại lệ này. Chờ Checker duyệt, từ chối hoặc trả về.", "No further adjustment can be created for this exception until the checker decides.")} <RuleTag>REQ-REC-08</RuleTag></p></div>
              </div>
            ) : (
              <p className="text-body-sm text-fg-secondary">{tr(`Tạo bút toán Nợ 6311.01 / Có 1131.03 số tiền ${vnd(ex.diff)}. `, `Creates Dr 6311.01 / Cr 1131.03 for ${vnd(ex.diff)}. `)}
                {needsChecker ? tr("Trên 50 triệu: chờ Checker duyệt, ngoại lệ ở trạng thái Chờ hạch toán.", "Above 50m: waits for a checker; exception stays Awaiting posting.") : tr("Tới 50 triệu: hạch toán zero-touch, ngoại lệ đóng ngay.", "Up to 50m: posts zero-touch and closes the exception.")} <RuleTag>RULE-REC-04</RuleTag></p>
            ))}
            {how === "MANUAL_MATCH" && (
              <label className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Mã tham chiếu giao dịch đối ứng", "Counterpart reference")}</span>
                <input value={matchRef} onChange={(e) => setMatchRef(e.target.value)} placeholder={ex.external?.ref ?? "NP-…"} className={cx(textCls, "h-11 tabular")} />
                <span className="text-caption text-fg-tertiary">{tr("Khớp tay với bản ghi đối ứng, không sinh bút toán. Dùng cho giao dịch trùng hoặc dữ liệu đối tác đã về.", "Pairs with the counterpart record without a posting. For duplicates or late partner data.")}</span></label>
            )}
            {how === "REQUEST_DOCS" && (
              <label className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Chứng từ cần bổ sung", "Documents needed")}</span>
                <textarea value={docsNote} onChange={(e) => setDocsNote(e.target.value)} rows={2} className={textCls} placeholder={tr(`vd. Sao kê NAPAS ngày 19/11 (tối thiểu ${MIN_NOTE} ký tự)`, `e.g. NAPAS statement for 19 Nov (at least ${MIN_NOTE} characters)`)} /></label>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <GradientButton icon={CheckCircle2} disabled={!canSubmit} onClick={submit}>{submitLabel}</GradientButton>
              {!causeOk && <span className="text-caption text-[#b42318]">{tr(`Ghi chú nguyên nhân cần ít nhất ${MIN_NOTE} ký tự.`, `Cause note needs at least ${MIN_NOTE} characters.`)}</span>}
            </div>
          </div>
        )}
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><GitBranch className="size-4" />{tr("Truy vết dữ liệu", "Data lineage")}</span>} action={<RuleTag>FR-REC-11 · UAT-REC-10</RuleTag>}>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="relative rounded-[16px] border border-line-subtle p-4">
              <span className={cx("mb-2 grid size-7 place-items-center rounded-full text-caption font-bold", s.ok ? "text-white" : "bg-bg-sunken text-fg-tertiary")} style={s.ok ? { background: "var(--grad-action)" } : undefined}>{i + 1}</span>
              <p className="text-body-sm font-semibold">{s.t}</p>
              <p className="mt-0.5 break-words text-caption text-fg-tertiary tabular">{s.d}</p>
              {i < steps.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-fg-tertiary md:block" aria-hidden />}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

/* ---------- REC-06 Bút toán GL ---------- */

function GLView({ gls, setGls, onCase, rules, exs }: { gls: GL[]; setGls: (f: (g: GL[]) => GL[]) => void; onCase: (caseId: string, outcome: "posted" | "reopened") => void; rules: Rule[]; exs: Ex[] }) {
  const { tr, pick } = useLang();
  const ME = useMe();
  // Quy tắc đã sinh ra giao dịch của bút toán: lấy trực tiếp từ nguồn, hoặc qua ngoại lệ liên quan
  const ruleOf = (g: GL) => rules.find((r) => r.id === (g.source.match(/MR-\d+/)?.[0] ?? exs.find((e) => e.id === caseOf(g))?.rule));
  const [tab, setTab] = useState<"all" | "pending" | "zero">("all");
  const [msg, setMsg] = useState<{ tone: "ok" | "block"; text: string } | null>(null);
  const [dialog, setDialog] = useState<{ g: GL; kind: "reject" | "return" } | null>(null);
  const [note, setNote] = useState("");
  const list = gls.filter((g) => (tab === "pending" ? g.status === "PENDING" || g.status === "RETURNED" : tab === "zero" ? g.mode === "ZERO_TOUCH" : true));
  const patch = (id: string, p: Partial<GL>) => setGls((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const blockMaker = (g: GL) => {
    if (g.maker !== ME) return false;
    setMsg({ tone: "block", text: tr(`Không thể duyệt ${g.id}: bạn là Maker của bút toán này.`, `Can't approve ${g.id}: you are its maker.`) });
    return true;
  };
  const approve = (g: GL) => {
    if (blockMaker(g)) return;
    // RULE-REC-05 (BR-REC-08, REQ-REC-07): người tạo quy tắc không duyệt điều chỉnh lớn sinh từ quy tắc đó
    const r = ruleOf(g);
    if (g.amount > GL_THRESHOLD && r && r.maker === ME) {
      setMsg({ tone: "block", text: tr(`Không thể duyệt ${g.id}: bạn là người tạo quy tắc ${r.id} sinh ra giao dịch này (RULE-REC-05 – phân tách nhiệm vụ).`, `Can't approve ${g.id}: you created rule ${r.id}, which produced this transaction (RULE-REC-05 – segregation of duties).`) });
      return;
    }
    patch(g.id, { status: "POSTED", checker: ME });
    const c = caseOf(g); if (c) onCase(c, "posted");
    setMsg({ tone: "ok", text: tr(`Đã duyệt và hạch toán ${g.id}.`, `${g.id} approved and posted.`) });
  };
  const open = (g: GL, kind: "reject" | "return") => { if (blockMaker(g)) return; setNote(""); setDialog({ g, kind }); };
  const confirm = () => {
    if (!dialog || note.trim().length < MIN_NOTE) return;
    const { g, kind } = dialog;
    patch(g.id, kind === "reject" ? { status: "REJECTED", checker: ME, rejectReason: note.trim() } : { status: "RETURNED", checker: ME, returnNote: note.trim() });
    const c = caseOf(g); if (c) onCase(c, "reopened");
    setMsg({ tone: "ok", text: kind === "reject" ? tr(`Đã từ chối ${g.id}. Ngoại lệ liên quan mở lại để xử lý.`, `${g.id} rejected. The related exception is reopened.`) : tr(`Đã trả ${g.id} về Maker.`, `${g.id} returned to the maker.`) });
    setDialog(null);
  };
  const resubmit = (g: GL) => {
    patch(g.id, { status: "PENDING", submits: (g.submits ?? 1) + 1 });
    setMsg({ tone: "ok", text: tr(`Đã trình lại ${g.id} (lần ${(g.submits ?? 1) + 1}).`, `${g.id} resubmitted (round ${(g.submits ?? 1) + 1}).`) });
  };
  const statusLabel = (s: GLStatus) => (s === "POSTED" ? tr("Đã hạch toán", "Posted") : s === "PENDING" ? tr("Chờ Checker", "Awaiting checker") : s === "RETURNED" ? tr("Trả về Maker", "Returned to maker") : tr("Từ chối", "Rejected"));
  const small = "interactive rounded-full border border-line-subtle px-3 py-1.5 text-caption font-semibold";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-title">{tr("Bút toán GL", "GL entries")}</h2><p className="text-body-sm text-fg-tertiary">{tr(`Tự động hạch toán khi ≤ ${vnd(GL_THRESHOLD)}; lớn hơn cần Checker duyệt.`, `Posts automatically up to ${vnd(GL_THRESHOLD)}; above that needs a checker.`)} <RuleTag>RULE-REC-04</RuleTag></p></div>
        <Segmented value={tab} onChange={setTab} label={tr("Lọc", "Filter")} options={[{ value: "all", label: tr("Tất cả", "All") }, { value: "pending", label: tr("Chờ duyệt", "Pending") }, { value: "zero", label: "Zero-touch" }]} />
      </div>
      {msg && <div role="status" className={cx("flex items-start gap-2 rounded-[14px] px-4 py-3 text-body-sm", msg.tone === "ok" ? "bg-[#e8f7ef] text-[#0f5132]" : "bg-[#fdf0ee] text-[#7a1a12]")}>{msg.tone === "ok" ? <CheckCircle2 className="mt-0.5 size-4" /> : <ShieldAlert className="mt-0.5 size-4" />}{msg.text}<button className="ml-auto font-semibold" onClick={() => setMsg(null)}>{tr("Đóng", "Dismiss")}</button></div>}
      <Panel pad={false}>
        <div className="px-5 pb-5">
          <Table minWidth={860} empty={list.length === 0} head={[tr("Bút toán", "Entry"), tr("Nợ / Có", "Debit / Credit"), tr("Số tiền", "Amount"), tr("Nguồn", "Source"), tr("Cơ chế · Maker", "Mode · Maker"), tr("Trạng thái", "Status")]}>
            {list.map((g) => (
              <tr key={g.id}>
                <td className="max-w-[220px]">
                  <span className="block font-semibold tabular">{g.id}</span>
                  <span className="block text-caption text-fg-tertiary"><span className="tabular">{g.date}</span> · {pick(g.memo)}</span>
                  {g.status === "RETURNED" && g.returnNote && <span className="block text-caption text-[#6a2fb5]">{tr("Checker ghi chú", "Checker note")}: {g.returnNote}</span>}
                  {g.status === "REJECTED" && g.rejectReason && <span className="block text-caption text-[#b42318]">{tr("Lý do từ chối", "Rejection reason")}: {g.rejectReason}</span>}
                </td>
                <td className="whitespace-nowrap tabular text-fg-secondary">{g.debit} / {g.credit}</td>
                <td className={cx("whitespace-nowrap tabular font-semibold", g.amount > GL_THRESHOLD && "text-[#8a5300]")}>{vnd(g.amount, false)}</td>
                <td className="max-w-[150px] break-words text-fg-secondary">{g.source}</td>
                <td>
                  {g.mode === "ZERO_TOUCH" ? <Pill tone="brand">Zero-touch</Pill> : <Pill tone="neutral">Maker-Checker</Pill>}
                  <span className="mt-1 block text-caption text-fg-secondary">{g.maker === "system" ? tr("Hệ thống", "System") : g.maker}</span>
                  {ruleOf(g) && <span className="block text-caption text-fg-tertiary">{tr("Quy tắc", "Rule")} {ruleOf(g)!.id} · {ruleOf(g)!.maker}</span>}
                </td>
                <td>
                  <Pill tone={glTone[g.status]}>{statusLabel(g.status)}</Pill>
                  {g.status === "PENDING" && <span className="mt-2 flex flex-wrap gap-1.5">
                    <button onClick={() => approve(g)} className="btn interactive rounded-full px-3 py-1.5 text-caption font-semibold text-white" style={{ background: "var(--grad-action)" }}>{tr("Duyệt", "Approve")}</button>
                    <button onClick={() => open(g, "return")} className={small} title={tr("Trả về Maker kèm ghi chú", "Return to maker with a note")}>{tr("Trả về", "Return")}</button>
                    <button onClick={() => open(g, "reject")} className={small}>{tr("Từ chối", "Reject")}</button>
                  </span>}
                  {g.status === "RETURNED" && g.maker === ME && <span className="mt-2 flex"><button onClick={() => resubmit(g)} className={small}>{tr("Trình lại", "Resubmit")}</button></span>}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Panel>
      <p className="flex items-center gap-2 text-caption text-fg-tertiary"><ScrollText className="size-3.5" />{tr("Ngưỡng 50 triệu giữ theo baseline vì CR-002 (nâng ngưỡng) chưa được duyệt.", "The 50m threshold stays at baseline because CR-002 (raising it) is not approved.")}</p>

      <Modal open={!!dialog} onClose={() => setDialog(null)} width={520}
        title={dialog?.kind === "reject" ? tr(`Từ chối ${dialog?.g.id}`, `Reject ${dialog?.g.id}`) : tr(`Trả ${dialog?.g.id ?? ""} về Maker`, `Return ${dialog?.g.id ?? ""} to maker`)}
        footer={<><GhostButton onClick={() => setDialog(null)}>{tr("Huỷ", "Cancel")}</GhostButton><GradientButton disabled={note.trim().length < MIN_NOTE} onClick={confirm}>{dialog?.kind === "reject" ? tr("Xác nhận từ chối", "Confirm rejection") : tr("Xác nhận trả về", "Confirm return")}</GradientButton></>}>
        <label className="flex flex-col gap-1.5">
          <span className="text-body-sm font-semibold">{dialog?.kind === "reject" ? tr("Lý do từ chối", "Rejection reason") : tr("Ghi chú cho Maker", "Note to maker")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={textCls} placeholder={tr(`Tối thiểu ${MIN_NOTE} ký tự`, `At least ${MIN_NOTE} characters`)} />
          <span className="text-caption text-fg-tertiary">{dialog?.kind === "reject" ? tr("Ngoại lệ liên quan được mở lại. Lý do lưu vào audit log.", "The related exception is reopened. The reason is written to the audit log.") : tr("Maker sửa và trình lại; bút toán giữ nguyên mã.", "The maker edits and resubmits; the entry keeps its ID.")} <RuleTag>{dialog?.kind === "reject" ? "REQ-REC-05" : "REQ-REC-06"}</RuleTag></span>
        </label>
      </Modal>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <LangProvider>
      <RecApp />
    </LangProvider>
  );
}
