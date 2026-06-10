import { cn } from "@/lib/cn";

type Tone = "brand" | "accent" | "success" | "warning" | "danger" | "muted";

// light theme: พื้นจาง + ข้อความเข้ม (contrast ผ่าน AA)
const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  accent: "bg-amber-50 text-amber-700 border-amber-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  muted: "bg-ink-600 text-ink-800 border-[var(--border)]",
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
