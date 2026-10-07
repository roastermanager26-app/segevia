import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("icon text-xl", className)}>
      {name}
    </span>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
  secondary:
    "bg-surface-container-lowest text-on-surface border border-hairline hover:bg-surface-container-low",
  danger: "bg-surface-container-lowest text-error border border-error-container hover:bg-error-container/40",
  ghost: "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
};

export function Button({
  variant = "primary",
  icon,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-space-xs rounded-lg px-space-md py-2 text-label-md transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {loading ? <Icon name="progress_activity" className="animate-spin text-lg" /> : icon && <Icon name={icon} className="text-lg" />}
      {children}
    </button>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cx("rounded-xl border border-hairline bg-surface-container-lowest p-space-lg shadow-card", className)}
    />
  );
}

type Tone = "ai" | "verified" | "human" | "review" | "error" | "neutral";

const tones: Record<Tone, string> = {
  ai: "bg-[#eef2ff] border-[#c7d2fe] text-primary-container",
  verified: "bg-[#f0fdf4] border-[#bbf7d0] text-[#0d9488]",
  human: "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]",
  review: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-error-container border-error-container text-on-error-container",
  neutral: "bg-surface-container-low border-surface-container text-on-surface-variant",
};

/** Badges de atribución semántica (design system: IA, verificado, humano, revisión). */
export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-label-sm", tones[tone])}>
      {icon && <Icon name={icon} className="text-sm" />}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-label-md font-semibold text-on-surface">
        {label}
        {hint && <span className="text-body-sm font-normal text-outline">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-hairline bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-[#94a3b8] focus:border-primary-container focus:outline-none focus:ring-[3px] focus:ring-primary-container/15";
