import { ReactNode } from "react";
import { ChevronLeft, Headphones, Lock, Signal, Wifi, BatteryFull } from "lucide-react";
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
    <div className="relative mx-auto w-full max-w-[390px] rounded-[44px] p-2.5 shadow-overlay" style={{ background: "var(--device-bezel)" }}>
      <div
        className={cx("relative flex h-[760px] max-h-[78vh] min-h-[620px] flex-col overflow-hidden rounded-[36px]", dark ? "text-white" : "bg-bg-base text-fg-primary")}
        style={{ background: dark ? "var(--camera-bg)" : "var(--brand-bg)" }}
      >
        <div className="flex h-11 shrink-0 items-center justify-between px-7 text-[13px] font-semibold tabular text-white" aria-hidden>
          <span>9:41</span>
          <span className="absolute left-1/2 top-2.5 h-[26px] w-[96px] -translate-x-1/2 rounded-full" style={{ background: "var(--device-bezel)" }} />
          <span className="flex items-center gap-1"><Signal className="size-3.5" /><Wifi className="size-3.5" /><BatteryFull className="size-4" /></span>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Bố cục màn hình kiểu ngân hàng:
 * dải thương hiệu navy (thanh trên + tiến trình) → tấm nội dung trắng bo góc trên → vùng hành động cố định + cam kết bảo mật
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
  const { tr, pick } = useLang();
  return (
    <div className={cx("flex min-h-0 flex-1 flex-col", dark ? "text-white" : "")} style={{ background: dark ? "var(--camera-bg)" : "var(--brand-bg)" }}>
      {/* Thanh trên */}
      <div className="flex h-14 shrink-0 items-center gap-1 px-2 text-white">
        {onBack ? (
          <button onClick={onBack} aria-label={tr("Quay lại", "Back")} className="interactive grid size-10 place-items-center rounded-full">
            <ChevronLeft className="size-6" />
          </button>
        ) : (
          <span className="size-10" />
        )}
        <h1 className="flex-1 truncate text-center text-[17px] font-semibold">{title}</h1>
        <LangSwitch onBrand />
        <button aria-label={tr("Hỗ trợ", "Support")} className="interactive ml-1 grid size-10 place-items-center rounded-full">
          <Headphones className="size-5" />
        </button>
      </div>

      {/* Tiến trình */}
      {step !== undefined && (
        <div className="shrink-0 px-5 pb-5 pt-1 text-white">
          <div className="flex items-baseline justify-between text-caption">
            <span className="font-semibold">{pick(STEPS[step])}</span>
            <span className="tabular text-brand-muted">{tr(`Bước ${step + 1}/${STEPS.length}`, `Step ${step + 1} of ${STEPS.length}`)}</span>
          </div>
          <ol className="mt-2 flex gap-1" aria-label={tr("Tiến trình", "Progress")}>
            {STEPS.map((s, i) => (
              <li key={s.en} className="flex-1" aria-current={i === step ? "step" : undefined}>
                <span className="sr-only">{pick(s)}</span>
                <span aria-hidden className={cx("block h-1 rounded-full", i <= step ? "bg-white" : "bg-white/25")} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Nội dung */}
      {dark ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[20px] bg-bg-base text-fg-primary">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-6">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-line-subtle bg-bg-surface px-5 pb-6 pt-3">
              <div className="flex flex-col gap-2">{footer}</div>
              {secure && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-caption text-fg-tertiary">
                  <Lock className="size-3.5" aria-hidden />
                  {tr("Kết nối được mã hoá · Aegis Bank", "Encrypted connection · Aegis Bank")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {dark && footer && <div className="shrink-0 px-5 pb-8 pt-3">{footer}</div>}
    </div>
  );
}

/** Tiêu đề trang căn trái */
export function PageTitle({ title, desc }: { title: string; desc?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em]">{title}</h2>
      {desc && <p className="mt-1.5 text-body-sm text-fg-secondary">{desc}</p>}
    </div>
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
