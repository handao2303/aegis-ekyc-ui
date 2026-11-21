/* Aegis Hạn mức – LIM-W1 → LIM-W4 (SCRUM-52), danh sách thẻ (gap G-07). Dữ liệu hư cấu, PAN luôn che. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowLeft, BadgeCheck, Bell, CreditCard, Gauge, Lock, MessageSquare, Pause, Play, Rocket, ShieldAlert, Smartphone, Unlock, Zap,
} from "lucide-react";
import { Modal, cx } from "../components/ui";
import { LangProvider, useLang } from "../i18n";
import {
  GhostButton, GradientButton, LineChart, Meter, OpsShell, Panel, Pill, type PillTone, RuleTag, SearchBox, Segmented, StatCard, Table, pct, vnd,
} from "./kit";

const ME = "Trần Bảo Ngọc";
type View = "monitor" | "cards" | "boost" | "fraud";

/* ---------- Dữ liệu mẫu ---------- */

type Decision = "APPROVED" | "DECLINED" | "FALLBACK";
type Auth = { stan: string; time: string; mti: string; pan: string; merchant: string; amount: number; decision: Decision; ms: number; code: string };
const MERCHANTS = ["Highlands Coffee", "Grab", "Shopee", "Circle K", "Vietjet Air", "Bách Hoá Xanh", "CGV", "Lotte Mart", "Tiki", "Petrolimex"];
const PANS = ["4111 •••• •••• 1234", "5244 •••• •••• 9821", "4111 •••• •••• 7765", "5244 •••• •••• 0042", "4111 •••• •••• 3318"];
let seq = 820431;
/** Sinh 1 dòng log giả lập. seed: biến thiên dữ liệu; ageMs: lùi thời gian. STAN tăng dần theo thứ tự gọi. */
function makeAuth(seed: number, ageMs = 0): Auth {
  // Hash số học cho phân bố đều 0–1 (sin thuần bị lệch về 2 đầu)
  const r = (n: number) => { const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  const decision: Decision = r(1) < 0.04 ? "DECLINED" : r(2) < 0.06 ? "FALLBACK" : "APPROVED";
  const d = new Date(Date.now() - ageMs);
  seq += 1;
  return {
    stan: String(seq).padStart(6, "0"),
    time: d.toLocaleTimeString("vi-VN", { hour12: false }),
    mti: decision === "DECLINED" && r(3) > 0.5 ? "0400" : "0100",
    pan: PANS[Math.floor(r(4) * PANS.length)],
    merchant: MERCHANTS[Math.floor(r(5) * MERCHANTS.length)],
    amount: Math.round((r(6) * 4_800_000 + 25_000) / 1000) * 1000,
    decision,
    ms: Math.round(180 + r(7) * 900 + (decision === "FALLBACK" ? 420 : 0)),
    code: decision === "APPROVED" ? "00" : decision === "FALLBACK" ? "00·CASA" : r(8) > 0.5 ? "51" : "05",
  };
}

type Card = { id: string; pan: string; holder: string; product: string; limit: number; available: number; hold: number; casa: string; version: number; status: "ACTIVE" | "BLOCKED"; boost?: number };
const CARDS0: Card[] = [
  { id: "C-0001", pan: "4111 •••• •••• 1234", holder: "NGUYEN THI MINH THU", product: "Aegis Platinum", limit: 80_000_000, available: 31_450_000, hold: 2_300_000, casa: "1903 6688 2025", version: 17, status: "ACTIVE", boost: 10_000_000 },
  { id: "C-0002", pan: "5244 •••• •••• 9821", holder: "TRAN VAN HUNG", product: "Aegis Gold", limit: 50_000_000, available: 4_120_000, hold: 0, casa: "0071 0003 4567", version: 9, status: "ACTIVE" },
  { id: "C-0003", pan: "4111 •••• •••• 7765", holder: "LE THI HONG NHUNG", product: "Aegis Classic", limit: 20_000_000, available: 18_700_000, hold: 0, casa: "1903 1122 3344", version: 3, status: "ACTIVE" },
  { id: "C-0004", pan: "5244 •••• •••• 0042", holder: "PHAM QUOC BAO", product: "Aegis Gold", limit: 50_000_000, available: 0, hold: 1_150_000, casa: "1903 2211 8899", version: 22, status: "BLOCKED" },
  { id: "C-0005", pan: "4111 •••• •••• 3318", holder: "VO NGOC ANH", product: "Aegis Platinum", limit: 120_000_000, available: 96_800_000, hold: 4_500_000, casa: "1903 5566 7788", version: 6, status: "ACTIVE" },
];

type FallbackTx = { id: string; time: string; amount: number; status: "SETTLED" | "HOLD" | "RELEASED"; merchant: string };
const FALLBACK: FallbackTx[] = [
  { id: "FB-30211", time: "21/11 09:41", amount: 3_200_000, status: "HOLD", merchant: "Vietjet Air" },
  { id: "FB-30188", time: "20/11 19:05", amount: 1_850_000, status: "SETTLED", merchant: "Lotte Mart" },
  { id: "FB-30140", time: "19/11 12:20", amount: 640_000, status: "RELEASED", merchant: "CGV" },
];

type BoostStatus = "ACTIVE" | "EXPIRED" | "LOCKED";
type Boost = { id: string; card: string; holder: string; score: number; amount: number; until: string; status: BoostStatus; reason?: { vi: string; en: string } };
const BOOST0: Boost[] = [
  { id: "BST-7701", card: "4111 •••• 1234", holder: "NGUYEN THI MINH THU", score: 812, amount: 10_000_000, until: "24/11 23:59", status: "ACTIVE" },
  { id: "BST-7698", card: "4111 •••• 3318", holder: "VO NGOC ANH", score: 846, amount: 20_000_000, until: "23/11 23:59", status: "ACTIVE" },
  { id: "BST-7690", card: "5244 •••• 0042", holder: "PHAM QUOC BAO", score: 701, amount: 8_000_000, until: "22/11 23:59", status: "LOCKED", reason: { vi: "Velocity bất thường: 9 giao dịch/15 phút", en: "Unusual velocity: 9 txns in 15 min" } },
  { id: "BST-7655", card: "5244 •••• 9821", holder: "TRAN VAN HUNG", score: 765, amount: 5_000_000, until: "18/11 23:59", status: "EXPIRED" },
  { id: "BST-7649", card: "4111 •••• 7765", holder: "LE THI HONG NHUNG", score: 790, amount: 3_000_000, until: "17/11 23:59", status: "EXPIRED" },
];

type Delivery = "DELIVERED" | "PENDING" | "FAILED";
type Fraud = { id: string; time: string; card: string; signal: { vi: string; en: string }; score: number; action: "LOCK_BOOST" | "FLAG"; sms: Delivery; app: Delivery; status: "OPEN" | "CLOSED" };
const FRAUD0: Fraud[] = [
  { id: "FR-2201", time: "21/11 09:58", card: "5244 •••• 0042", signal: { vi: "9 giao dịch trong 15 phút, 3 quốc gia", en: "9 txns in 15 min across 3 countries" }, score: 92, action: "LOCK_BOOST", sms: "DELIVERED", app: "DELIVERED", status: "OPEN" },
  { id: "FR-2202", time: "21/11 10:04", card: "4111 •••• 7765", signal: { vi: "Thiết bị mới + giao dịch đêm", en: "New device + late-night spend" }, score: 61, action: "FLAG", sms: "PENDING", app: "DELIVERED", status: "OPEN" },
  { id: "FR-2196", time: "20/11 22:41", card: "4111 •••• 1234", signal: { vi: "Vị trí lệch 600 km trong 20 phút", en: "600 km location jump in 20 min" }, score: 78, action: "LOCK_BOOST", sms: "FAILED", app: "DELIVERED", status: "OPEN" },
  { id: "FR-2180", time: "19/11 14:12", card: "5244 •••• 9821", signal: { vi: "Nhiều lần sai CVV", en: "Repeated CVV failures" }, score: 55, action: "FLAG", sms: "DELIVERED", app: "DELIVERED", status: "CLOSED" },
];

const LAT: Record<string, { labels: string[]; p99: number[]; p95: number[] }> = {
  today: { labels: ["06h", "07h", "08h", "09h", "10h", "11h", "12h"], p99: [1.21, 1.34, 1.58, 1.42, 1.37, 1.29, 1.33], p95: [0.71, 0.78, 0.92, 0.84, 0.8, 0.76, 0.79] },
  "7d": { labels: ["15/11", "16/11", "17/11", "18/11", "19/11", "20/11", "21/11"], p99: [1.38, 1.29, 1.71, 1.44, 1.36, 1.52, 1.42], p95: [0.81, 0.77, 0.98, 0.85, 0.8, 0.88, 0.84] },
  month: { labels: ["T1", "T2", "T3", "T4"], p99: [1.66, 1.51, 1.47, 1.42], p95: [0.95, 0.9, 0.86, 0.84] },
};

const decisionTone: Record<Decision, PillTone> = { APPROVED: "success", DECLINED: "error", FALLBACK: "brand" };
const deliveryTone: Record<Delivery, PillTone> = { DELIVERED: "success", PENDING: "pending", FAILED: "error" };

/* ---------- App ---------- */

function LimApp() {
  const { tr } = useLang();
  const [view, setView] = useState<View>("monitor");
  const [period, setPeriod] = useState("today");
  const [cards, setCards] = useState(CARDS0);
  const [boosts, setBoosts] = useState(BOOST0);
  const [frauds, setFrauds] = useState(FRAUD0);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const go = (v: View) => { setView(v); setOpenCard(null); window.scrollTo(0, 0); };
  const nav = [
    { id: "monitor" as View, label: tr("Giám sát Authorization", "Authorization monitor"), icon: Activity },
    { id: "cards" as View, label: tr("Hồ sơ hạn mức thẻ", "Card limits"), icon: CreditCard },
    { id: "boost" as View, label: "Boost", icon: Rocket, count: boosts.filter((b) => b.status === "LOCKED").length || undefined },
    { id: "fraud" as View, label: tr("Giám sát gian lận", "Fraud monitor"), icon: ShieldAlert, count: frauds.filter((f) => f.status === "OPEN").length },
  ];
  const card = cards.find((c) => c.id === openCard);
  return (
    <OpsShell module="credit-limit" nav={nav} view={view} onView={go} user={ME} role={tr("Vận hành thẻ · Risk", "Card ops · Risk")}
      greeting={tr("Chào buổi sáng, Ngọc", "Good morning, Ngọc")}
      subtitle={tr("Hạn mức thời gian thực, Boost và tín hiệu gian lận của danh mục thẻ.", "Real-time limits, Boosts and fraud signals across the card portfolio.")}
      period={period} onPeriod={setPeriod} onExport={() => {}}
      alerts={[
        { title: tr("FR-2196: SMS khoá Boost gửi thất bại", "FR-2196: Boost-lock SMS failed"), time: "22:41", tone: "error" },
        { title: tr("p99 chạm 1,71s ngày 17/11 (SLA < 2s)", "p99 hit 1.71s on 17 Nov (SLA < 2s)"), time: "17/11", tone: "warning" },
        { title: tr("Circuit breaker CBS về CLOSED", "CBS circuit breaker back to CLOSED"), time: "08:15", tone: "success" },
      ]}>
      {view === "monitor" && <Monitor period={period} />}
      {view === "cards" && !card && <Cards cards={cards} onOpen={setOpenCard} />}
      {view === "cards" && card && <CardProfile card={card} onBack={() => setOpenCard(null)} save={(c) => setCards((xs) => xs.map((x) => (x.id === c.id ? c : x)))} />}
      {view === "boost" && <Boosts boosts={boosts} setBoosts={setBoosts} />}
      {view === "fraud" && <FraudView frauds={frauds} setFrauds={setFrauds} />}
    </OpsShell>
  );
}

/* ---------- LIM-W1 Giám sát Authorization ---------- */

function Monitor({ period }: { period: string }) {
  const { tr } = useLang();
  const [live, setLive] = useState(true);
  // Sinh từ cũ → mới để STAN tăng dần, rồi đảo để dòng mới nhất ở trên
  const [log, setLog] = useState<Auth[]>(() => Array.from({ length: 40 }, (_, i) => makeAuth(i + 1, (39 - i) * 2300)).reverse());
  const [cb, setCb] = useState<"CLOSED" | "HALF_OPEN" | "OPEN">("CLOSED");
  const n = useRef(100);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setLog((xs) => [makeAuth(n.current++), ...xs].slice(0, 40)), 2400);
    return () => clearInterval(t);
  }, [live]);
  const c = LAT[period];
  const approved = log.filter((l) => l.decision !== "DECLINED").length / log.length * 100;
  const cbLabel = { CLOSED: tr("Bình thường", "Healthy"), HALF_OPEN: tr("Đang thử lại", "Probing"), OPEN: tr("Ngắt – dùng fallback", "Open – fallback") };
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard featured icon={Gauge} value={`${c.p99.at(-1)!.toLocaleString("vi-VN")} s`} caption={tr("SLA < 2 s", "SLA < 2 s")} label={tr("Độ trễ p99", "p99 latency")} delta={{ text: tr("Đạt", "Met"), good: true }} />
        <StatCard icon={Zap} value="1.284" caption={tr("giao dịch / phút", "transactions / min")} label="Throughput" />
        <StatCard icon={BadgeCheck} value={pct(approved)} caption={tr("gồm fallback CASA", "incl. CASA fallback")} label={tr("Tỷ lệ chấp thuận", "Approval rate")} />
        <StatCard icon={Activity} value={cb} caption={cbLabel[cb]} label="Circuit breaker · CBS" onClick={() => setCb(cb === "CLOSED" ? "HALF_OPEN" : cb === "HALF_OPEN" ? "OPEN" : "CLOSED")} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={tr("Độ trễ xử lý Authorization", "Authorization latency")}>
          <LineChart labels={c.labels} format={(v) => `${v.toFixed(1)}s`} min={0} max={2.2} series={[
            { name: "p99", color: "#b46cf6", values: c.p99 },
            { name: "p95", color: "#f7b31b", values: c.p95 },
            { name: "SLA 2s", color: "#e3a39a", values: c.labels.map(() => 2), dashed: true },
          ]} />
        </Panel>
        <Panel title={tr("Kết quả quyết định", "Decision mix")}>
          {(["APPROVED", "FALLBACK", "DECLINED"] as Decision[]).map((d) => {
            const v = (log.filter((l) => l.decision === d).length / log.length) * 100;
            return (
              <div key={d} className="mb-4 last:mb-0">
                <div className="mb-1 flex justify-between text-body-sm"><Pill tone={decisionTone[d]}>{d === "APPROVED" ? tr("Chấp thuận", "Approved") : d === "FALLBACK" ? tr("Fallback CASA", "CASA fallback") : tr("Từ chối", "Declined")}</Pill><span className="font-semibold tabular">{pct(v)}</span></div>
                <Meter value={v} label={d} tone={d === "DECLINED" ? "danger" : "brand"} />
              </div>
            );
          })}
          <p className="mt-4 text-caption text-fg-tertiary">{tr("Bấm thẻ Circuit breaker để mô phỏng chuyển trạng thái (CLOSED → HALF_OPEN → OPEN).", "Click the circuit breaker card to simulate state changes.")}</p>
        </Panel>
      </div>

      <Panel title={tr("Nhật ký Authorization", "Authorization log")} action={<>
        <span className="flex items-center gap-1.5 text-caption text-fg-tertiary">{live && <span className="size-2 animate-pulse rounded-full bg-[#157347]" />}{live ? tr("Đang cập nhật trực tiếp", "Live") : tr("Đã tạm dừng", "Paused")}</span>
        <GhostButton icon={live ? Pause : Play} onClick={() => setLive(!live)}>{live ? tr("Tạm dừng", "Pause") : tr("Tiếp tục", "Resume")}</GhostButton>
      </>}>
        <Table minWidth={980} head={["STAN", tr("Thời gian", "Time"), "MTI", "PAN", tr("Điểm bán", "Merchant"), tr("Số tiền", "Amount"), tr("Quyết định", "Decision"), tr("Độ trễ", "Latency"), tr("Mã", "Code")]}>
          {log.slice(0, 12).map((l) => (
            <tr key={l.stan}>
              <td className="font-semibold tabular">{l.stan}</td>
              <td className="tabular">{l.time}</td>
              <td className="tabular text-fg-secondary">{l.mti}</td>
              <td className="whitespace-nowrap tabular">{l.pan}</td>
              <td>{l.merchant}</td>
              <td className="tabular">{vnd(l.amount, false)}</td>
              <td><Pill tone={decisionTone[l.decision]}>{l.decision}</Pill></td>
              <td className={cx("tabular", l.ms > 1500 && "font-semibold text-[#8a5300]")}>{l.ms} ms</td>
              <td className="tabular text-fg-secondary">{l.code}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-caption text-fg-tertiary">{tr("PAN luôn được che/token hoá, không hiển thị số thẻ đầy đủ.", "PANs are always masked/tokenised, never shown in full.")} <RuleTag>UAT-LIM-10</RuleTag> <RuleTag>NFR-SEC-04</RuleTag></p>
      </Panel>
    </div>
  );
}

/* ---------- LIM-W2 Danh sách & hồ sơ hạn mức ---------- */

function Cards({ cards, onOpen }: { cards: Card[]; onOpen: (id: string) => void }) {
  const { tr } = useLang();
  const [q, setQ] = useState("");
  const list = cards.filter((c) => (c.holder + c.pan + c.id).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-title">{tr("Hồ sơ hạn mức thẻ", "Card limit profiles")}</h2><p className="text-body-sm text-fg-tertiary">{tr("Tìm thẻ theo tên chủ thẻ hoặc 4 số cuối.", "Find a card by holder name or last 4 digits.")} <RuleTag>G-07</RuleTag></p></div>
        <SearchBox value={q} onChange={setQ} placeholder={tr("Tên hoặc 4 số cuối", "Name or last 4")} />
      </div>
      <Panel pad={false}>
        <div className="px-5 pb-5">
          <Table empty={list.length === 0} head={[tr("Thẻ", "Card"), tr("Chủ thẻ", "Holder"), tr("Hạn mức", "Limit"), tr("Khả dụng", "Available"), tr("Mức sử dụng", "Utilisation"), "Version", tr("Trạng thái", "Status")]}>
            {list.map((c) => {
              const used = ((c.limit - c.available) / c.limit) * 100;
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-bg-sunken/60" onClick={() => onOpen(c.id)}>
                  <td><button onClick={() => onOpen(c.id)} className="whitespace-nowrap font-semibold tabular text-[#6a2fb5] hover:underline">{c.pan}</button><span className="block text-caption text-fg-tertiary">{c.product}</span></td>
                  <td>{c.holder}</td>
                  <td className="tabular">{vnd(c.limit)}</td>
                  <td className="tabular">{vnd(c.available)}</td>
                  <td className="w-44"><div className="flex items-center gap-2"><Meter value={used} label={c.pan} tone={used > 90 ? "danger" : "brand"} /><span className="w-10 shrink-0 text-right tabular">{Math.round(used)}%</span></div></td>
                  <td className="tabular">v{c.version}</td>
                  <td>{c.status === "ACTIVE" ? <Pill tone="success">{tr("Hoạt động", "Active")}</Pill> : <Pill tone="error">{tr("Tạm khoá", "Blocked")}</Pill>}</td>
                </tr>
              );
            })}
          </Table>
        </div>
      </Panel>
    </div>
  );
}

function CardProfile({ card, onBack, save }: { card: Card; onBack: () => void; save: (c: Card) => void }) {
  const { tr } = useLang();
  const [edit, setEdit] = useState(false);
  const [newLimit, setNewLimit] = useState(String(card.limit / 1e6));
  const [stale, setStale] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const used = card.limit - card.available - card.hold;
  const submit = () => {
    if (stale) {
      setMsg({ ok: false, text: tr(`Xung đột phiên bản: hồ sơ đã được cập nhật lên v${card.version + 1} bởi một giao dịch khác. Tải lại rồi thử lại.`, `Version conflict: the profile moved to v${card.version + 1} from another transaction. Reload and try again.`) });
      save({ ...card, version: card.version + 1 });
      setStale(false);
      setEdit(false);
      return;
    }
    const limit = Math.round(Number(newLimit.replace(",", ".")) * 1e6);
    if (!limit || limit < used) { setMsg({ ok: false, text: tr("Hạn mức mới phải lớn hơn dư nợ hiện tại.", "The new limit must exceed the current balance.") }); return; }
    save({ ...card, limit, available: card.available + (limit - card.limit), version: card.version + 1 });
    setMsg({ ok: true, text: tr(`Đã cập nhật hạn mức, version v${card.version + 1}.`, `Limit updated, version v${card.version + 1}.`) });
    setEdit(false);
  };
  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-body-sm font-semibold text-fg-secondary"><ArrowLeft className="size-4" />{tr("Danh sách thẻ", "All cards")}</button>
      {msg && <div role="status" className={cx("rounded-[14px] px-4 py-3 text-body-sm", msg.ok ? "bg-[#e8f7ef] text-[#0f5132]" : "bg-[#fdf0ee] text-[#7a1a12]")}>{msg.text}</div>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel>
          {/* Thẻ tối có ánh cam */}
          <div className="relative aspect-[1.586] overflow-hidden rounded-[18px] p-5 text-white" style={{ background: "#14101c" }}>
            <div aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full opacity-90 blur-3xl" style={{ background: "radial-gradient(circle, #f7b31b 0%, #e25d2e 45%, transparent 70%)" }} />
            <div aria-hidden className="absolute -bottom-24 left-10 size-56 rounded-full opacity-50 blur-3xl" style={{ background: "#b46cf6" }} />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between text-body-sm"><span className="font-semibold">{card.product}</span><span className="text-caption opacity-80">{card.pan.startsWith("4") ? "VISA" : "MC"}</span></div>
              <p className="text-[20px] font-semibold tracking-[0.08em] tabular">{card.pan}</p>
              <div className="flex justify-between text-caption"><span><span className="block opacity-60">{tr("Chủ thẻ", "Card holder")}</span>{card.holder}</span><span className="text-right"><span className="block opacity-60">Version</span>v{card.version}</span></div>
            </div>
          </div>
          <p className="mt-5 text-caption text-fg-tertiary">{tr("Hạn mức khả dụng", "Available limit")}</p>
          <p className="text-body"><span className="text-[22px] font-semibold tabular">{vnd(card.available, false)}</span> <span className="text-fg-tertiary">/ {vnd(card.limit, false)}</span></p>
          <div className="mt-3"><Meter value={((card.limit - card.available) / card.limit) * 100} label={tr("Mức sử dụng", "Utilisation")} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-body-sm">
            <div className="rounded-[12px] bg-bg-sunken p-3"><dt className="text-caption text-fg-tertiary">{tr("Đang tạm giữ", "On hold")}</dt><dd className="font-semibold tabular">{vnd(card.hold)}</dd></div>
            <div className="rounded-[12px] bg-bg-sunken p-3"><dt className="text-caption text-fg-tertiary">Boost</dt><dd className="font-semibold tabular">{card.boost ? `+${vnd(card.boost)}` : "—"}</dd></div>
            <div className="col-span-2 rounded-[12px] bg-bg-sunken p-3"><dt className="text-caption text-fg-tertiary">{tr("CASA liên kết (Smart Fallback)", "Linked CASA (Smart Fallback)")}</dt><dd className="font-semibold tabular">{card.casa}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2"><GradientButton onClick={() => { setEdit(true); setMsg(null); }}>{tr("Điều chỉnh hạn mức", "Adjust limit")}</GradientButton></div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={tr("Giao dịch Smart Fallback", "Smart Fallback transactions")} action={<RuleTag>UAT-LIM-03/04</RuleTag>}>
            <Table head={[tr("Mã", "ID"), tr("Thời gian", "Time"), tr("Điểm bán", "Merchant"), tr("Số tiền", "Amount"), tr("Trạng thái", "Status")]}>
              {FALLBACK.map((f) => (
                <tr key={f.id}>
                  <td className="font-semibold tabular">{f.id}</td><td className="tabular">{f.time}</td><td>{f.merchant}</td><td className="tabular">{vnd(f.amount, false)}</td>
                  <td><Pill tone={f.status === "SETTLED" ? "success" : f.status === "HOLD" ? "warning" : "neutral"}>{f.status}</Pill></td>
                </tr>
              ))}
            </Table>
          </Panel>
          <Panel title={tr("Khoá lạc quan (optimistic locking)", "Optimistic locking")}>
            <p className="text-body-sm text-fg-secondary">{tr("Mỗi lần cập nhật hạn mức phải gửi kèm version hiện tại. Nếu một giao dịch khác vừa đổi hồ sơ, lệnh cập nhật bị từ chối để không vượt hạn mức khi có 2 giao dịch đồng thời.", "Each limit update carries the current version. If another transaction just changed the profile, the update is rejected so concurrent transactions can't exceed the limit.")} <RuleTag>BR-LIM-02</RuleTag> <RuleTag>UAT-LIM-01</RuleTag></p>
          </Panel>
        </div>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title={tr("Điều chỉnh hạn mức", "Adjust limit")}
        footer={<><GhostButton onClick={() => setEdit(false)}>{tr("Huỷ", "Cancel")}</GhostButton><GradientButton onClick={submit}>{tr("Lưu", "Save")}</GradientButton></>}>
        <label className="flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Hạn mức mới (triệu ₫)", "New limit (million ₫)")}</span>
          <input value={newLimit} onChange={(e) => setNewLimit(e.target.value)} inputMode="decimal" className="h-11 rounded-[12px] border border-line-subtle px-3 tabular outline-none focus:border-[#b46cf6]" /></label>
        <p className="mt-2 text-caption text-fg-tertiary">{tr(`Đang sửa trên version v${card.version}. Dư nợ hiện tại ${vnd(used)}.`, `Editing version v${card.version}. Current balance ${vnd(used)}.`)}</p>
        <label className="mt-4 flex items-start gap-2 rounded-[12px] bg-bg-sunken p-3 text-body-sm">
          <input type="checkbox" checked={stale} onChange={(e) => setStale(e.target.checked)} className="mt-1 accent-[#8a45e0]" />
          <span>{tr("Mô phỏng: có giao dịch khác cập nhật hồ sơ trước khi bấm Lưu", "Simulate: another transaction updates the profile before you save")}</span>
        </label>
      </Modal>
    </div>
  );
}

/* ---------- LIM-W3 Boost ---------- */

function Boosts({ boosts, setBoosts }: { boosts: Boost[]; setBoosts: (f: (b: Boost[]) => Boost[]) => void }) {
  const { tr, pick } = useLang();
  const [tab, setTab] = useState<BoostStatus>("ACTIVE");
  const [unlock, setUnlock] = useState<Boost | null>(null);
  const [reason, setReason] = useState("");
  const list = boosts.filter((b) => b.status === tab);
  const label: Record<BoostStatus, string> = { ACTIVE: tr("Đang hiệu lực", "Active"), EXPIRED: tr("Hết hạn", "Expired"), LOCKED: tr("Khoá nghi gian lận", "Locked – suspected fraud") };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-title">{tr("Temporary Limit Boost", "Temporary Limit Boost")}</h2><p className="text-body-sm text-fg-tertiary">{tr("Nâng hạn mức tạm thời theo behavioral score, tự hết hạn đúng thời điểm.", "Temporary limit raises from the behavioural score, expiring automatically.")} <RuleTag>UAT-LIM-06</RuleTag></p></div>
        <Segmented value={tab} onChange={setTab} label={tr("Trạng thái", "Status")} options={(["ACTIVE", "LOCKED", "EXPIRED"] as BoostStatus[]).map((s) => ({ value: s, label: `${label[s]} · ${boosts.filter((b) => b.status === s).length}` }))} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard featured icon={Rocket} value={vnd(boosts.filter((b) => b.status === "ACTIVE").reduce((s, b) => s + b.amount, 0))} caption={tr("tổng Boost đang hiệu lực", "active Boost total")} label={tr("Boost đang chạy", "Active Boost")} />
        <StatCard icon={Gauge} value="789" caption={tr("điểm trung bình được Boost", "avg. score of boosted cards")} label="Behavioral score" />
        <StatCard icon={Lock} value={String(boosts.filter((b) => b.status === "LOCKED").length)} caption={tr("chờ Risk xem xét", "awaiting Risk review")} label={tr("Đang khoá", "Locked")} />
      </div>
      <Panel pad={false}>
        <div className="px-5 pb-5">
          <Table minWidth={900} empty={list.length === 0} head={[tr("Mã", "ID"), tr("Thẻ", "Card"), tr("Chủ thẻ", "Holder"), "Score", "Boost", tr("Hiệu lực đến", "Valid until"), tr("Trạng thái", "Status"), ""]}>
            {list.map((b) => (
              <tr key={b.id}>
                <td className="font-semibold tabular">{b.id}</td>
                <td className="whitespace-nowrap tabular">{b.card}</td>
                <td>{b.holder}{b.reason && <span className="block text-caption text-[#b42318]">{pick(b.reason)}</span>}</td>
                <td className="tabular">{b.score}</td>
                <td className="tabular font-semibold">+{vnd(b.amount)}</td>
                <td className="tabular">{b.until}</td>
                <td><Pill tone={b.status === "ACTIVE" ? "success" : b.status === "LOCKED" ? "error" : "neutral"}>{label[b.status]}</Pill></td>
                <td className="text-right">
                  {b.status === "ACTIVE" && <button onClick={() => setBoosts((xs) => xs.map((x) => (x.id === b.id ? { ...x, status: "LOCKED", reason: { vi: `Khoá thủ công bởi ${ME}`, en: `Locked manually by ${ME}` } } : x)))} className="interactive inline-flex items-center gap-1 rounded-full border border-line-subtle px-3 py-1.5 text-caption font-semibold"><Lock className="size-3.5" />{tr("Khoá", "Lock")}</button>}
                  {b.status === "LOCKED" && <button onClick={() => { setUnlock(b); setReason(""); }} className="interactive inline-flex items-center gap-1 rounded-full border border-line-subtle px-3 py-1.5 text-caption font-semibold"><Unlock className="size-3.5" />{tr("Mở khoá", "Unlock")}</button>}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Panel>
      <Modal open={!!unlock} onClose={() => setUnlock(null)} title={tr("Mở khoá Boost", "Unlock Boost")}
        footer={<><GhostButton onClick={() => setUnlock(null)}>{tr("Huỷ", "Cancel")}</GhostButton><GradientButton disabled={reason.trim().length < 10} onClick={() => { setBoosts((xs) => xs.map((x) => (x.id === unlock!.id ? { ...x, status: "ACTIVE", reason: undefined } : x))); setUnlock(null); }}>{tr("Mở khoá", "Unlock")}</GradientButton></>}>
        <p className="text-body-sm text-fg-secondary">{unlock && pick(unlock.reason ?? { vi: "", en: "" })}</p>
        <label className="mt-3 flex flex-col gap-1.5"><span className="text-body-sm font-semibold">{tr("Lý do mở khoá (bắt buộc, ghi audit)", "Reason (required, audited)")}</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-[12px] border border-line-subtle p-3 text-body-sm outline-none focus:border-[#b46cf6]" placeholder={tr("vd. Khách xác nhận qua tổng đài lúc 10:20", "e.g. Customer confirmed by phone at 10:20")} /></label>
        <p className="mt-1 text-caption text-fg-tertiary">{tr("Tối thiểu 10 ký tự.", "At least 10 characters.")}</p>
      </Modal>
    </div>
  );
}

/* ---------- LIM-W4 Giám sát gian lận ---------- */

function FraudView({ frauds, setFrauds }: { frauds: Fraud[]; setFrauds: (f: (x: Fraud[]) => Fraud[]) => void }) {
  const { tr, pick } = useLang();
  const [preview, setPreview] = useState(false);
  const open = frauds.filter((f) => f.status === "OPEN");
  const retry = (id: string) => {
    setFrauds((xs) => xs.map((x) => (x.id === id ? { ...x, sms: "PENDING" } : x)));
    setTimeout(() => setFrauds((xs) => xs.map((x) => (x.id === id ? { ...x, sms: "DELIVERED" } : x))), 1600);
  };
  const sorted = useMemo(() => [...frauds].sort((a, b) => (a.status === b.status ? b.score - a.score : a.status === "OPEN" ? -1 : 1)), [frauds]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-title">{tr("Giám sát gian lận", "Fraud monitor")}</h2><p className="text-body-sm text-fg-tertiary">{tr("Nghi vấn cao → tạm khoá Boost và báo khách qua SMS/App. Nghi vấn thấp → chỉ gắn cờ theo dõi.", "High risk → lock Boost and notify the customer by SMS/App. Low risk → flag only.")} <RuleTag>BR-LIM-07</RuleTag></p></div>
        <GhostButton icon={MessageSquare} onClick={() => setPreview(true)}>{tr("Xem mẫu thông báo", "Preview notification")}</GhostButton>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard featured icon={ShieldAlert} value={String(open.length)} caption={tr("case đang mở", "open cases")} label={tr("Cần xử lý", "To review")} />
        <StatCard icon={Lock} value={String(open.filter((f) => f.action === "LOCK_BOOST").length)} caption={tr("đã tạm khoá Boost", "Boost locked")} label={tr("Khoá tự động", "Auto-locked")} />
        <StatCard icon={Bell} value={String(frauds.filter((f) => f.sms === "FAILED").length)} caption={tr("SMS gửi thất bại", "SMS failed")} label={tr("Thông báo lỗi", "Delivery issues")} />
      </div>
      <Panel pad={false}>
        <div className="px-5 pb-5">
          <Table minWidth={1080} head={[tr("Case", "Case"), tr("Thời gian", "Time"), tr("Thẻ", "Card"), tr("Tín hiệu", "Signal"), tr("Điểm", "Score"), tr("Hành động", "Action"), "SMS", "App", tr("Trạng thái", "Status"), ""]}>
            {sorted.map((f) => (
              <tr key={f.id} className={f.status === "CLOSED" ? "opacity-60" : undefined}>
                <td className="whitespace-nowrap font-semibold tabular">{f.id}</td>
                <td className="whitespace-nowrap tabular">{f.time}</td>
                <td className="whitespace-nowrap tabular">{f.card}</td>
                <td className="min-w-[220px]">{pick(f.signal)}</td>
                <td><span className={cx("tabular font-semibold", f.score >= 75 ? "text-[#b42318]" : "text-[#8a5300]")}>{f.score}</span></td>
                <td>{f.action === "LOCK_BOOST" ? <Pill tone="error">{tr("Khoá Boost", "Lock Boost")}</Pill> : <Pill tone="warning">{tr("Gắn cờ", "Flag")}</Pill>}</td>
                <td><span className="inline-flex items-center gap-1.5"><Pill tone={deliveryTone[f.sms]}>{f.sms}</Pill>{f.sms === "FAILED" && <button onClick={() => retry(f.id)} className="text-caption font-semibold text-[#6a2fb5] hover:underline">{tr("Gửi lại", "Retry")}</button>}</span></td>
                <td><Pill tone={deliveryTone[f.app]}><Smartphone className="size-3" />{f.app}</Pill></td>
                <td><Pill tone={f.status === "OPEN" ? "pending" : "neutral"}>{f.status === "OPEN" ? tr("Đang mở", "Open") : tr("Đã đóng", "Closed")}</Pill></td>
                <td className="text-right">{f.status === "OPEN" && <button onClick={() => setFrauds((xs) => xs.map((x) => (x.id === f.id ? { ...x, status: "CLOSED" } : x)))} className="interactive whitespace-nowrap rounded-full border border-line-subtle px-3 py-1.5 text-caption font-semibold">{tr("Đóng case", "Close")}</button>}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Panel>
      <Modal open={preview} onClose={() => setPreview(false)} title={tr("Mẫu thông báo khoá Boost", "Boost lock notification")}>
        <div className="rounded-[18px] bg-bg-sunken p-4">
          <p className="mb-2 text-caption font-semibold text-fg-tertiary">SMS · Aegis Bank</p>
          <p className="text-body-sm">{tr("Aegis Bank: Han muc tam thoi cua the ****0042 da duoc tam khoa de bao ve tai khoan. Neu ban khong thuc hien giao dich gan day, goi 1900 6868.", "Aegis Bank: The temporary limit on card ****0042 has been paused to protect your account. If you didn't make recent transactions, call 1900 6868.")}</p>
        </div>
        <p className="mt-3 rounded-[12px] border border-[#f7d48a] bg-[#fef4dd] p-3 text-caption text-[#6b4100]">{tr("Nội dung giữ chỗ – chờ Risk/Legal/CSKH duyệt mẫu. Notification Service thật chưa sẵn sàng (DEP-07).", "Placeholder copy – awaiting Risk/Legal/CS approval. The real Notification Service isn't ready yet (DEP-07).")}</p>
      </Modal>
    </div>
  );
}

export default function CreditLimitPage() {
  return (
    <LangProvider>
      <LimApp />
    </LangProvider>
  );
}
