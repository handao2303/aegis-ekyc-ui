import { ReactNode } from "react";
import { ArrowLeft, Headphones, Lock, Signal, Wifi, BatteryFull } from "lucide-react";
import { cx } from "../components/ui";
import { LangSwitch, useLang, L10n } from "../i18n";

export const STEPS: L10n[] = [
  { vi: "Điều khoản", en: "Consent" },
  { vi: "Giấy tờ", en: "ID document" },
  { vi: "Chip NFC", en: "NFC chip" },
  { vi: "Khuôn mặt", en: "Face check" },
  { vi: "Kết quả", en: "Result" },
];

/** Khung thiết bị — chỉ dùng trong trang UI Kit */
export function PhoneFrame({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className="skin-aurora relative mx-auto w-full max-w-[390px] rounded-[50px] p-[3px] shadow-overlay" style={{ background: "linear-gradient(135deg,#f7b31b,#b46cf6)" }}>
      <div className="rounded-[47px] p-2" style={{ background: "var(--device-bezel)" }}>
        <div
          className={cx("relative flex h-[780px] max-h-[80vh] min-h-[620px] flex-col overflow-hidden rounded-[40px]", dark ? "text-white" : "text-fg-primary")}
          style={{ background: dark ? "var(--camera-bg)" : "var(--bg-base)" }}
        >
          <div className={cx("flex h-11 shrink-0 items-center justify-between px-7 text-[13px] font-semibold tabular", dark ? "text-white" : "text-fg-primary")} aria-hidden>
            <span>9:41</span>
            <span className="absolute left-1/2 top-2.5 h-[26px] w-[96px] -translate-x-1/2 rounded-full" style={{ background: "var(--device-bezel)" }} />
            <span className="flex items-center gap-1"><Signal className="size-3.5" /><Wifi className="size-3.5" /><BatteryFull className="size-4" /></span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Đệm dưới = vùng an toàn của iPhone (thanh Home), tối thiểu 20px */
export const SAFE_BOTTOM = { paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" } as const;

/** Nút tròn trên thanh trên */
export function RoundIconButton({ label, onClick, children, onDark }: { label: string; onClick?: () => void; children: ReactNode; onDark?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} className={cx("interactive grid size-10 shrink-0 place-items-center rounded-full", onDark ? "bg-white/10 text-white" : "text-fg-primary")}>
      {children}
    </button>
  );
}

/** Thanh tiến trình 5 bước: đoạn đã qua tô gradient */
function Progress({ step, onDark }: { step: number; onDark?: boolean }) {
  const { tr, pick } = useLang();
  return (
    <div className="shrink-0 px-6 pb-2 pt-1">
      <div className={cx("flex items-baseline justify-between text-caption", onDark ? "text-white" : "")}>
        <span className="font-semibold">{pick(STEPS[step])}</span>
        <span className={cx("tabular", onDark ? "text-white/70" : "text-fg-tertiary")}>{tr(`Bước ${step + 1}/${STEPS.length}`, `Step ${step + 1} of ${STEPS.length}`)}</span>
      </div>
      <ol className="mt-2 flex gap-1.5" aria-label={tr("Tiến trình", "Progress")}>
        {STEPS.map((s, i) => (
          <li key={s.en} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <span className="sr-only">{pick(s)}</span>
            <span
              aria-hidden
              className={cx("block h-1 rounded-full", i > step && (onDark ? "bg-white/20" : "bg-bg-sunken"))}
              style={i <= step ? { background: "var(--grad-brand)" } : undefined}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Bố cục màn hình kiểu ảnh mẫu: nền trắng, nút quay lại trái, nội dung căn trái,
 * nút chính gradient dạng viên thuốc ở đáy. Màn camera dùng biến thể tối.
 */
export function Screen({
  title,
  step,
  onBack,
  children,
  footer,
  dark,
  secure = true,
}: {
  title?: string;
  step?: number;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  dark?: boolean;
  secure?: boolean;
}) {
  const { tr } = useLang();
  return (
    <div className={cx("flex min-h-0 flex-1 flex-col", dark ? "text-white" : "text-fg-primary")} style={{ background: dark ? "var(--camera-bg)" : "var(--bg-base)" }}>
      {/* Thanh trên */}
      <div className="flex h-14 shrink-0 items-center gap-1 px-3">
        {onBack ? (
          <RoundIconButton label={tr("Quay lại", "Back")} onClick={onBack} onDark={dark}>
            <ArrowLeft className="size-6" />
          </RoundIconButton>
        ) : (
          <span className="size-10 shrink-0" />
        )}
        <h1 className={cx("flex-1 truncate text-center text-[15px] font-medium", dark ? "text-white/80" : "text-fg-tertiary")}>{title}</h1>
        <LangSwitch onBrand={dark} />
        <RoundIconButton label={tr("Hỗ trợ", "Support")} onDark={dark}>
          <Headphones className="size-5" />
        </RoundIconButton>
      </div>

      {step !== undefined && <Progress step={step} onDark={dark} />}

      {/* Nội dung */}
      <div className={cx("min-h-0 flex-1 overflow-y-auto px-6 pt-4", dark ? "pb-4" : "pb-6")} style={footer ? undefined : SAFE_BOTTOM}>{children}</div>
      {footer && (
        <div className="shrink-0 px-6 pt-3" style={SAFE_BOTTOM}>
          <div className="flex flex-col gap-2">{footer}</div>
          {secure && !dark && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-caption text-fg-tertiary">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {tr("Dữ liệu của bạn được mã hoá và bảo vệ", "Your data is encrypted and protected")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Tiêu đề trang lớn, căn trái */
export function PageTitle({ title, desc }: { title: ReactNode; desc?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[30px] font-semibold leading-[36px] tracking-[-0.02em]">{title}</h2>
      {desc && <p className="mt-2.5 text-[15px] leading-[22px] text-fg-secondary">{desc}</p>}
    </div>
  );
}

/** Ảnh đại diện minh hoạ (khuôn mặt hoạt hình) — không phải người thật */
export function FaceAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id="fa-skin" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#ffd7c4" />
          <stop offset="1" stopColor="#f4a487" />
        </radialGradient>
        <linearGradient id="fa-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a52" />
          <stop offset="1" stopColor="#25252b" />
        </linearGradient>
      </defs>
      <ellipse cx="22" cy="56" rx="7" ry="9" fill="#f4a487" />
      <ellipse cx="78" cy="56" rx="7" ry="9" fill="#f4a487" />
      <ellipse cx="50" cy="58" rx="28" ry="30" fill="url(#fa-skin)" />
      <path d="M20 50 C18 22 40 12 56 15 C74 17 86 30 81 52 C76 40 66 36 58 38 C50 30 34 34 28 42 C25 45 22 48 20 50 Z" fill="url(#fa-hair)" />
      <ellipse cx="40" cy="60" rx="3.4" ry="4.2" fill="#2a2a30" />
      <ellipse cx="60" cy="60" rx="3.4" ry="4.2" fill="#2a2a30" />
      <path d="M48 68 Q50 72 52 68" stroke="#d9826a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="33" cy="70" rx="5" ry="3" fill="#ff9f8f" opacity="0.45" />
      <ellipse cx="67" cy="70" rx="5" ry="3" fill="#ff9f8f" opacity="0.45" />
    </svg>
  );
}

/** Minh hoạ "quét giấy tờ": thẻ trắng có khuôn mặt trong khung ngắm + vạch quét gradient */
export function ScanIllustration({ variant = "id", className }: { variant?: "id" | "face" | "chip"; className?: string }) {
  return (
    <div className={cx("grid place-items-center rounded-[24px] bg-bg-sunken px-6 py-9", className)} aria-hidden>
      <div className="flex w-full max-w-[250px] items-center gap-4 rounded-[20px] bg-bg-surface p-5 shadow-[0_10px_30px_rgba(72,43,100,0.10)]">
        <div className="relative size-[84px] shrink-0">
          {(["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[6px]", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[6px]", "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-[6px]", "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[6px]"] as const).map((c) => (
            <span key={c} className={cx("absolute size-4 border-[#1a1a1a]", c)} />
          ))}
          <FaceAvatar className="absolute inset-2" />
          <span className="anim-scan-line absolute inset-x-0 h-[3px] rounded-full" style={{ background: "var(--grad-brand)" }} />
        </div>
        {variant === "chip" ? (
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-6 w-9 rounded-md border-2 border-[#e2c26b] bg-[#f6e3a8]" />
            <div className="h-2.5 w-full rounded-full bg-bg-sunken" />
            <div className="h-2.5 w-3/4 rounded-full bg-bg-sunken" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="h-2.5 w-3/4 rounded-full bg-bg-sunken" />
            <div className="mt-1 h-2.5 w-full rounded-full bg-bg-sunken" />
            <div className="h-2.5 w-5/6 rounded-full bg-bg-sunken" />
            <div className="h-2.5 w-full rounded-full bg-bg-sunken" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Ô icon tô gradient nhạt, icon màu tím — dùng cho danh sách lựa chọn */
export function IconTile({ children, size = 48 }: { children: ReactNode; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[14px] text-[#8a45e0]" style={{ width: size, height: size, background: "var(--grad-soft)" }}>
      {children}
    </span>
  );
}

/** Minh hoạ thẻ CCCD gắn chip — dữ liệu hư cấu */
export function IdCardArt({ side = "front", className }: { side?: "front" | "back"; className?: string }) {
  return (
    <div
      className={cx("relative aspect-[1.586] w-full max-w-full overflow-hidden rounded-[10px] p-[6%] text-[#14243f]", className)}
      style={{ background: "linear-gradient(135deg,#e6edf7 0%,#d6e1f0 55%,#ecefe2 100%)" }}
      role="img"
      aria-label={side === "front" ? "CCCD – mặt trước / ID card – front" : "CCCD – mặt sau / ID card – back"}
    >
      {side === "front" ? (
        <div className="flex h-full gap-[5%]">
          <div className="flex w-[26%] flex-col gap-[8%]">
            <div className="aspect-[3/4] w-full rounded-[4px] bg-[#a9b9d1]" />
            <div className="h-[18%] w-[70%] rounded-[3px]" style={{ background: "linear-gradient(135deg,#c9a54e,#efd68a)" }} />
          </div>
          <div className="flex flex-1 flex-col gap-[6%] pt-[2%]">
            <div className="h-[9%] w-[80%] rounded-sm bg-[#14243f]/70" />
            <div className="h-[6%] w-[55%] rounded-sm bg-[#14243f]/35" />
            <div className="mt-[4%] h-[8%] w-[65%] rounded-sm bg-[#14243f]/55" />
            <div className="h-[6%] w-[45%] rounded-sm bg-[#14243f]/30" />
            <div className="h-[6%] w-[60%] rounded-sm bg-[#14243f]/30" />
            <div className="h-[6%] w-[50%] rounded-sm bg-[#14243f]/30" />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-between">
          <div className="flex justify-between">
            <div className="flex w-[55%] flex-col gap-2">
              <div className="h-2 w-full rounded-sm bg-[#14243f]/35" />
              <div className="h-2 w-[80%] rounded-sm bg-[#14243f]/35" />
            </div>
            <div className="aspect-square w-[22%] rounded-[4px] bg-[#14243f]/15" />
          </div>
          <div className="rounded-[3px] bg-[#14243f]/10 p-[3%] font-mono text-[8px] leading-tight tracking-wider opacity-80">
            IDVNM0890123456&lt;&lt;&lt;&lt;
            <br />
            9203154F3203159VNM&lt;&lt;&lt;
          </div>
        </div>
      )}
    </div>
  );
}
