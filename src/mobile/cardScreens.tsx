/* Hạn mức thẻ – LIM-M1 → LIM-M3 (SCRUM-51). Dữ liệu hư cấu, PAN luôn che. */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowRight, BadgeCheck, CalendarClock, Check, ChevronRight, Clock, Gauge, Headphones, Lock, MapPin, Rocket, ShieldAlert, Smartphone, Wallet,
} from "lucide-react";
import { Button, cx } from "../components/ui";
import { useLang } from "../i18n";
import { PageTitle, Screen } from "./MobileShell";
import type { ScreenProps } from "./screens";

/* ---------- Trạng thái dùng chung giữa 3 màn (trong bộ nhớ) ---------- */

type CardState = { boost: "offered" | "active" | "locked" | "declined"; fallback: boolean; cardLocked: boolean; confirmed: boolean };
let state: CardState = { boost: "offered", fallback: true, cardLocked: false, confirmed: false };
const subs = new Set<() => void>();
const store = {
  get: () => state,
  set: (p: Partial<CardState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); },
  sub: (f: () => void) => { subs.add(f); return () => subs.delete(f); },
};
const useCard = () => useSyncExternalStore(store.sub, store.get, store.get);

const LIMIT = 80_000_000;
const USED = 46_250_000;
const HOLD = 2_300_000;
const BOOST = 10_000_000;
const fmt = (n: number) => `${n.toLocaleString("vi-VN")} ₫`;

/* ---------- Thẻ tối ánh cam ---------- */

function CardArt({ locked }: { locked?: boolean }) {
  const { tr } = useLang();
  return (
    <div className="relative aspect-[1.586] overflow-hidden rounded-[22px] p-5 text-white shadow-[0_18px_40px_rgba(72,43,100,0.28)]" style={{ background: "#14101c" }} role="img" aria-label={tr("Thẻ tín dụng Aegis Platinum, số cuối 1234", "Aegis Platinum credit card ending 1234")}>
      <div aria-hidden className="absolute -right-14 -top-16 size-56 rounded-full opacity-90 blur-3xl" style={{ background: "radial-gradient(circle, #f7b31b 0%, #e25d2e 45%, transparent 70%)" }} />
      <div aria-hidden className="absolute -bottom-20 left-8 size-44 rounded-full opacity-50 blur-3xl" style={{ background: "#b46cf6" }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">Aegis Platinum</span><span className="text-caption font-bold tracking-wider opacity-90">VISA</span></div>
        <div className="flex items-center gap-2">
          <span className="h-7 w-10 rounded-md border border-white/30 bg-white/10" aria-hidden />
          {locked && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-caption font-semibold"><Lock className="size-3" />{tr("Đang khoá", "Locked")}</span>}
        </div>
        <p className="text-[19px] font-semibold tracking-[0.1em] tabular">4111 •••• •••• 1234</p>
        <div className="flex justify-between text-caption"><span><span className="block opacity-60">{tr("Chủ thẻ", "Card holder")}</span>NGUYEN THI MINH THU</span><span className="text-right"><span className="block opacity-60">{tr("Hết hạn", "Expires")}</span>11/31</span></div>
      </div>
    </div>
  );
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label} className="h-2.5 w-full overflow-hidden rounded-full bg-bg-sunken">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: "var(--grad-brand)" }} />
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "" : "bg-[#d9dbe1]")} style={on ? { background: "var(--grad-action)" } : undefined}>
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/** Đếm ngược tới hạn Boost (time-boxed) */
function useCountdown(hours: number) {
  const [end] = useState(() => Date.now() + hours * 3600_000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((end - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/* ---------- LIM-M1 · Hạn mức thẻ ---------- */

export function CardHome({ go }: ScreenProps) {
  const { tr } = useLang();
  const c = useCard();
  const cd = useCountdown(62);
  const limit = LIMIT + (c.boost === "active" ? BOOST : 0);
  const available = limit - USED - HOLD;
  const used = ((USED + HOLD) / limit) * 100;
  const txs = [
    { m: "Vietjet Air", t: tr("Hôm nay 09:41", "Today 09:41"), a: 3_200_000, fb: true },
    { m: "Highlands Coffee", t: tr("Hôm nay 08:12", "Today 08:12"), a: 59_000 },
    { m: "Lotte Mart", t: tr("Hôm qua 19:05", "Yesterday 19:05"), a: 1_850_000 },
  ];
  return (
    <Screen title={tr("Thẻ của tôi", "My card")} onBack={() => go("intro")} secure={false}>
      <CardArt locked={c.cardLocked} />

      <div className="mt-6">
        <p className="text-body-sm text-fg-tertiary">{tr("Hạn mức khả dụng", "Available limit")}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><span className="text-[28px] font-semibold tabular tracking-[-0.01em]">{fmt(available)}</span><span className="text-body-sm text-fg-tertiary tabular">/ {fmt(limit)}</span></p>
        <div className="mt-3"><Meter value={used} label={tr("Mức đã dùng", "Used")} /></div>
        <div className="mt-2 flex justify-between text-caption text-fg-tertiary tabular"><span>{tr("Đã dùng", "Used")} {Math.round(used)}%</span><span>{tr("Tạm giữ", "On hold")} {fmt(HOLD)}</span></div>
      </div>

      {/* Boost */}
      {c.boost === "offered" && (
        <button onClick={() => go("boostOffer")} className="interactive mt-5 flex w-full items-center gap-4 rounded-[20px] p-4 text-left" style={{ background: "var(--grad-soft)" }}>
          <span className="grid size-12 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: "var(--grad-action)" }}><Rocket className="size-6" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{tr("Nâng hạn mức tạm thời +10 triệu", "Temporary limit +10 million")}</span><span className="block text-caption text-fg-secondary">{tr("Dành riêng cho bạn · miễn phí · tự hết hạn sau 72 giờ", "Just for you · free · ends after 72 hours")}</span></span>
          <ChevronRight className="size-5 shrink-0 text-fg-tertiary" />
        </button>
      )}
      {c.boost === "active" && (
        <div className="mt-5 rounded-[20px] border border-[#b46cf6]/40 bg-[#faf6ff] p-4">
          <div className="flex items-center gap-3"><BadgeCheck className="size-5 text-[#8a45e0]" /><p className="text-[15px] font-semibold">{tr("Boost đang hiệu lực", "Boost is active")} · +{fmt(BOOST)}</p></div>
          <p className="mt-2 flex items-center gap-2 text-body-sm text-fg-secondary tabular" aria-live="off"><Clock className="size-4" />{tr("Còn", "Ends in")} {cd.d}{tr(" ngày ", "d ")}{String(cd.h).padStart(2, "0")}:{String(cd.m).padStart(2, "0")}:{String(cd.s).padStart(2, "0")}</p>
        </div>
      )}
      {c.boost === "locked" && (
        <button onClick={() => go("boostLocked")} className="interactive mt-5 flex w-full items-center gap-3 rounded-[20px] border border-[#f3c6c0] bg-[#fdf0ee] p-4 text-left">
          <ShieldAlert className="size-5 shrink-0 text-[#b42318]" />
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-[#7a1a12]">{tr("Hạn mức tạm thời đang tạm khoá", "Temporary limit is paused")}</span><span className="block text-caption text-[#7a1a12]/80">{tr("Chạm để xác nhận giao dịch gần đây", "Tap to confirm recent transactions")}</span></span>
          <ChevronRight className="size-5 text-[#b42318]" />
        </button>
      )}

      {/* Smart Fallback */}
      <section className="mt-5 rounded-[20px] border border-line-subtle p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] text-[#8a45e0]" style={{ background: "var(--grad-soft)" }}><Wallet className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{tr("Dùng tài khoản thanh toán khi hết hạn mức", "Use my account when the limit runs out")}</p>
            <p className="mt-0.5 text-caption text-fg-tertiary">{tr("Giao dịch vượt hạn mức sẽ trừ vào tài khoản 1903 6688 2025 (số dư 12.480.000 ₫).", "Spend over the limit is taken from account 1903 6688 2025 (balance 12,480,000 ₫).")}</p>
          </div>
          <Switch on={c.fallback} onChange={(v) => store.set({ fallback: v })} label={tr("Smart Fallback", "Smart Fallback")} />
        </div>
      </section>

      {/* Giao dịch */}
      <div className="mt-6 flex items-center justify-between"><h3 className="text-body font-semibold">{tr("Giao dịch gần đây", "Recent transactions")}</h3><span className="text-body-sm font-semibold text-[#6a2fb5]">{tr("Xem tất cả", "See all")}</span></div>
      <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
        {txs.map((t) => (
          <li key={t.m} className="flex items-center gap-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg-sunken text-body-sm font-bold text-fg-secondary">{t.m[0]}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-body-sm font-semibold">{t.m}</span><span className="block text-caption text-fg-tertiary">{t.t}{t.fb && <> · <span className="font-semibold text-[#6a2fb5]">{tr("Trừ tài khoản thanh toán", "Paid from account")}</span></>}</span></span>
            <span className="text-body-sm font-semibold tabular">−{fmt(t.a)}</span>
          </li>
        ))}
      </ul>

      <button onClick={() => { store.set({ boost: "locked" }); go("boostLocked"); }} className="mt-4 w-full rounded-[14px] border border-dashed border-line-strong p-3 text-caption text-fg-tertiary">
        {tr("Demo: mô phỏng thông báo khoá Boost do nghi vấn gian lận", "Demo: simulate a Boost lock notification")}
      </button>
    </Screen>
  );
}

/* ---------- LIM-M2 · Ưu đãi Boost ---------- */

export function BoostOffer({ go }: ScreenProps) {
  const { tr } = useLang();
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <Screen title="Boost" footer={<Button size="lg" block onClick={() => go("cardHome")}>{tr("Về thẻ của tôi", "Back to my card")}</Button>}>
        <div className="mx-auto mt-6 grid size-20 place-items-center rounded-full text-white" style={{ background: "var(--grad-action)" }}><Check className="size-10" /></div>
        <h2 className="mt-5 text-center text-[24px] font-semibold">{tr("Đã nâng hạn mức", "Limit raised")}</h2>
        <p className="mt-1 text-center text-body-sm text-fg-secondary">{tr(`Hạn mức mới ${fmt(LIMIT + BOOST)}, dùng được ngay đến 23:59 ngày 24/11.`, `Your new limit is ${fmt(LIMIT + BOOST)}, usable now until 23:59 on 24 Nov.`)}</p>
      </Screen>
    );
  const rows: [typeof Gauge, string, string][] = [
    [Gauge, tr("Hạn mức mới", "New limit"), fmt(LIMIT + BOOST)],
    [CalendarClock, tr("Hiệu lực", "Valid"), tr("Ngay bây giờ → 23:59, 24/11/2026", "Now → 23:59, 24 Nov 2026")],
    [Clock, tr("Sau thời hạn", "Afterwards"), tr(`Tự trở về ${fmt(LIMIT)}`, `Returns to ${fmt(LIMIT)} automatically`)],
    [Wallet, tr("Phí", "Fee"), tr("Miễn phí", "Free")],
  ];
  return (
    <Screen title="Boost" onBack={() => go("cardHome")}
      footer={<>
        <Button size="lg" block disabled={!agree} onClick={() => { store.set({ boost: "active" }); setDone(true); }} iconRight={<ArrowRight className="size-5" />}>{tr("Nhận ưu đãi", "Accept offer")}</Button>
        <Button variant="ghost" block onClick={() => { store.set({ boost: "declined" }); go("cardHome"); }}>{tr("Để sau", "Not now")}</Button>
      </>}>
      <div className="grid place-items-center rounded-[24px] py-8" style={{ background: "var(--grad-soft)" }} aria-hidden>
        <span className="grid size-20 place-items-center rounded-[22px] text-white shadow-[0_14px_30px_rgba(134,64,224,0.35)]" style={{ background: "var(--grad-action)" }}><Rocket className="size-10" /></span>
        <p className="mt-4 text-[30px] font-semibold tabular text-gradient">+{fmt(BOOST)}</p>
      </div>
      <div className="mt-6"><PageTitle title={tr("Nâng hạn mức tạm thời", "Temporary limit raise")} desc={tr("Nhờ lịch sử chi tiêu và thanh toán đúng hạn, bạn được tăng hạn mức trong 72 giờ.", "Thanks to your on-time payments, you can spend more for the next 72 hours.")} /></div>
      <dl className="divide-y divide-[var(--border-subtle)] rounded-[20px] border border-line-subtle px-4">
        {rows.map(([Icon, l, v]) => (
          <div key={l} className="flex items-center gap-3 py-3.5">
            <Icon className="size-5 shrink-0 text-[#8a45e0]" aria-hidden />
            <dt className="flex-1 text-body-sm text-fg-secondary">{l}</dt>
            <dd className="text-right text-body-sm font-semibold tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <label className="mt-5 flex items-start gap-3 text-body-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#8a45e0]" />
        <span className="text-fg-secondary">{tr("Tôi hiểu hạn mức tạm thời có thể bị tạm khoá nếu hệ thống phát hiện giao dịch bất thường.", "I understand the temporary limit may be paused if unusual activity is detected.")}</span>
      </label>
    </Screen>
  );
}

/* ---------- LIM-M3 · Thông báo khoá Boost ---------- */

export function BoostLocked({ go }: ScreenProps) {
  const { tr } = useLang();
  const c = useCard();
  const [step, setStep] = useState<"ask" | "mine" | "notMine">(c.cardLocked ? "notMine" : c.confirmed ? "mine" : "ask");
  const txs = [
    { m: "Online store", place: tr("Singapore", "Singapore"), t: "09:52", a: 4_890_000 },
    { m: "Digital goods", place: tr("Hồng Kông", "Hong Kong"), t: "09:55", a: 2_350_000 },
    { m: "Online store", place: tr("Singapore", "Singapore"), t: "09:58", a: 4_990_000 },
  ];
  if (step !== "ask")
    return (
      <Screen title={tr("Bảo vệ tài khoản", "Account protection")} footer={<>
        <Button size="lg" block onClick={() => go("cardHome")}>{tr("Về thẻ của tôi", "Back to my card")}</Button>
        <Button variant="ghost" block icon={<Headphones className="size-5" />}>{tr("Gọi 1900 6868", "Call 1900 6868")}</Button>
      </>}>
        <div className={cx("mx-auto mt-6 grid size-20 place-items-center rounded-full", step === "mine" ? "text-white" : "bg-[#fdf0ee] text-[#b42318]")} style={step === "mine" ? { background: "var(--grad-action)" } : undefined}>
          {step === "mine" ? <Check className="size-10" /> : <Lock className="size-9" />}
        </div>
        <h2 className="mt-5 text-center text-[24px] font-semibold">{step === "mine" ? tr("Cảm ơn bạn đã xác nhận", "Thanks for confirming") : tr("Thẻ đã được khoá", "Your card is locked")}</h2>
        <p className="mt-1 text-center text-body-sm text-fg-secondary">
          {step === "mine"
            ? tr("Chúng tôi đang xem lại và sẽ mở lại hạn mức tạm thời trong vòng 30 phút. Hạn mức gốc vẫn dùng bình thường.", "We're reviewing it and will restore the temporary limit within 30 minutes. Your regular limit still works.")
            : tr("Không ai dùng được thẻ này nữa. Các giao dịch không phải của bạn sẽ được tra soát, chúng tôi sẽ liên hệ trong 24 giờ.", "Nobody can use this card now. We'll dispute the transactions you didn't make and contact you within 24 hours.")}
        </p>
      </Screen>
    );
  return (
    <Screen title={tr("Bảo vệ tài khoản", "Account protection")} onBack={() => go("cardHome")}
      footer={<>
        <Button size="lg" block onClick={() => { store.set({ confirmed: true }); setStep("mine"); }}>{tr("Đúng, tôi đã thực hiện", "Yes, these were me")}</Button>
        <Button variant="danger" size="lg" block onClick={() => { store.set({ cardLocked: true }); setStep("notMine"); }}>{tr("Không phải tôi – khoá thẻ", "Not me – lock my card")}</Button>
      </>}>
      {/* Thông báo đẩy như trên màn khoá iPhone */}
      <div className="flex items-start gap-3 rounded-[18px] bg-bg-sunken p-3.5" aria-label={tr("Thông báo vừa nhận", "Notification received")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: "var(--grad-action)" }}><Smartphone className="size-4" /></span>
        <div className="min-w-0 text-body-sm"><p className="flex justify-between gap-2"><span className="font-semibold">Aegis Bank</span><span className="text-caption text-fg-tertiary">{tr("vừa xong", "now")}</span></p>
          <p className="text-fg-secondary">{tr("Hạn mức tạm thời của thẻ ••••1234 đã được tạm khoá để bảo vệ tài khoản.", "The temporary limit on card ••••1234 has been paused to protect your account.")}</p></div>
      </div>

      <div className="mt-6"><PageTitle title={tr("Bạn có thực hiện các giao dịch này?", "Did you make these transactions?")} desc={tr("Chúng tôi thấy vài giao dịch khác thường nên đã tạm khoá phần hạn mức tạm thời. Hạn mức gốc vẫn dùng bình thường.", "We noticed some unusual spending, so we paused the temporary part of your limit. Your regular limit still works.")} /></div>
      <ul className="divide-y divide-[var(--border-subtle)] rounded-[20px] border border-line-subtle px-4">
        {txs.map((t, i) => (
          <li key={i} className="flex items-center gap-3 py-3.5">
            <MapPin className="size-5 shrink-0 text-[#b42318]" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block text-body-sm font-semibold">{t.m}</span><span className="block text-caption text-fg-tertiary">{t.place} · {tr("hôm nay", "today")} {t.t}</span></span>
            <span className="text-body-sm font-semibold tabular">{fmt(t.a)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-fg-tertiary">{tr("Aegis không bao giờ hỏi mã OTP hay mật khẩu qua điện thoại hoặc tin nhắn.", "Aegis never asks for OTPs or passwords by phone or message.")}</p>
    </Screen>
  );
}
