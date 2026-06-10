import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-white shadow-glow hover:opacity-95 active:opacity-90",
  ghost:
    "border border-[var(--border)] bg-white text-ink-900 hover:bg-brand-50",
  danger:
    "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
