/* Thư viện component Aegis — mỗi component nhận "thuộc tính" (variant/size/state) giống component properties trong Figma */
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* ---------- Button ---------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-action text-action-fg",
    secondary: "bg-bg-surface text-action-subtle-fg border border-[color:var(--action-primary-bg)]",
    ghost: "bg-transparent text-fg-primary",
    subtle: "bg-action-subtle text-action-subtle-fg",
    danger: "bg-danger-solid text-danger-solid-fg",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-body-sm gap-1.5 rounded-md",
    md: "h-10 px-4 text-body-sm gap-2 rounded-md",
    lg: "h-12 px-6 text-body gap-2 rounded-md",
  };
  return (
    <button
      className={cx(
        "interactive inline-flex items-center justify-center font-semibold whitespace-nowrap select-none",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

/* ---------- Badge ---------- */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const toneCls: Record<Tone, string> = {
  neutral: "bg-bg-surface text-fg-secondary",
  brand: "bg-action-subtle text-action-subtle-fg",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
};
const badgeIcon: Partial<Record<Tone, ReactNode>> = {
  success: <CheckCircle2 className="size-3.5" aria-hidden />,
  warning: <AlertTriangle className="size-3.5" aria-hidden />,
  danger: <XCircle className="size-3.5" aria-hidden />,
  info: <Info className="size-3.5" aria-hidden />,
};
/** dot = hiện icon trạng thái (giữ tên prop cũ để không đổi API) */
export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-caption font-semibold whitespace-nowrap", toneCls[tone], className)}
      style={{ borderColor: "color-mix(in srgb, currentColor 32%, transparent)" }}
    >
      {dot && badgeIcon[tone]}
      {children}
    </span>
  );
}

/* ---------- Card ---------- */
export function Card({ children, className, raised }: { children: ReactNode; className?: string; raised?: boolean }) {
  return (
    <div className={cx("rounded-lg border border-line-subtle shadow-raised", raised ? "bg-bg-raised" : "bg-bg-surface", className)}>{children}</div>
  );
}

/* ---------- Alert ---------- */
const alertIcon: Record<Exclude<Tone, "neutral" | "brand">, ReactNode> = {
  info: <Info className="size-5 shrink-0" aria-hidden />,
  success: <CheckCircle2 className="size-5 shrink-0" aria-hidden />,
  warning: <AlertTriangle className="size-5 shrink-0" aria-hidden />,
  danger: <XCircle className="size-5 shrink-0" aria-hidden />,
};
export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-md border border-l-4 p-3.5", toneCls[tone], className)} style={{ borderColor: "color-mix(in srgb, currentColor 22%, transparent)", borderLeftColor: "currentColor" }}>
      {alertIcon[tone]}
      <div className="min-w-0 text-body-sm">
        {title && <p className="font-bold text-fg-primary">{title}</p>}
        {children && <div className="text-fg-secondary mt-0.5">{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Text field ---------- */
export function TextField({
  label,
  helper,
  error,
  id,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; helper?: string; error?: string; id: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-fg-primary">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={helper || error ? `${id}-hint` : undefined}
        className={cx(
          "h-11 rounded-md bg-bg-surface px-3 text-body text-fg-primary placeholder:text-fg-tertiary",
          "border outline-none transition-shadow focus:ring-4 focus:ring-focus",
          error ? "border-danger" : "border-line-strong focus:border-action",
          "disabled:bg-bg-sunken disabled:text-fg-tertiary",
        )}
        {...rest}
      />
      {(helper || error) && (
        <p id={`${id}-hint`} className={cx("text-caption", error ? "text-danger" : "text-fg-tertiary")}>
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

/* ---------- Checkbox ---------- */
export function Checkbox({ id, checked, onChange, label, description, required }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="interactive flex gap-3 rounded-md p-3 -mx-3 cursor-pointer">
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cx(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[4px] border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-focus",
          checked ? "bg-action border-transparent text-action-fg" : "border-line-strong bg-bg-surface",
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M2.5 6.2 5 8.5l4.5-5" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-body-sm font-medium text-fg-primary">
          {label} {required && <span className="text-danger">*</span>}
        </span>
        {description && <span className="block text-caption text-fg-tertiary mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

/* ---------- Progress ---------- */
export function ProgressBar({ value, tone = "brand", label }: { value: number; tone?: "brand" | "success" | "warning" | "danger"; label?: string }) {
  const color = { brand: "bg-action", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 w-full rounded-full bg-bg-sunken overflow-hidden">
      <div className={cx("h-full rounded-full transition-[width] duration-300", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ---------- Stepper (thanh bước) ---------- */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Tiến trình">
      {steps.map((s, i) => (
        <li key={s} className="flex-1" aria-current={i === current ? "step" : undefined}>
          <span className="sr-only">{`Bước ${i + 1}: ${s}${i < current ? " (đã xong)" : ""}`}</span>
          <span aria-hidden className={cx("block h-1 rounded-full", i < current ? "bg-action" : i === current ? "bg-action opacity-60" : "bg-bg-sunken")} />
        </li>
      ))}
    </ol>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ items, value, onChange, ariaLabel }: { items: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 border-b border-line-subtle overflow-x-auto">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cx(
              "interactive relative h-10 px-3 rounded-t-sm text-body-sm font-medium whitespace-nowrap",
              active ? "text-fg-primary" : "text-fg-tertiary",
            )}
          >
            <span className="inline-flex items-center gap-2">
              {it.label}
              {it.count !== undefined && (
                <span className={cx("min-w-5 h-5 px-1.5 rounded-full text-caption tabular grid place-items-center", active ? "bg-action text-action-fg" : "bg-bg-sunken text-fg-secondary")}>{it.count}</span>
              )}
            </span>
            {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-action" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div className="relative w-full rounded-xl bg-bg-raised shadow-overlay border border-line-subtle flex flex-col max-h-[90vh]" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <h2 className="text-title text-fg-primary">{title}</h2>
          <button onClick={onClose} className="interactive -m-2 p-2 rounded-md text-fg-tertiary" aria-label="Đóng">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle p-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Key–value ---------- */
export function KV({ label, value, mono, highlight }: { label: string; value: ReactNode; mono?: boolean; highlight?: Tone }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-caption text-fg-tertiary">{label}</dt>
      <dd className={cx("text-body-sm text-fg-primary break-words", mono && "font-mono tabular", highlight && toneCls[highlight], highlight && "rounded-sm px-1.5 -mx-1.5 w-fit")}>{value}</dd>
    </div>
  );
}
