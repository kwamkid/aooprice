import { cn } from "@/lib/cn";

type Tone = "brand" | "accent" | "success" | "warning" | "danger" | "muted";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-500/15 text-brand-200 border-brand-400/30",
  accent: "bg-accent-500/15 text-accent-400 border-accent-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  muted: "bg-white/5 text-[var(--muted)] border-[var(--border)]",
};

export function Badge({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
