import { cn } from "@/lib/cn";

// สถานะว่าง / error — กล่อง dashed กลางจอ
export function EmptyState({
  icon,
  title,
  children,
  tone = "muted",
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  tone?: "muted" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed p-10 text-center",
        tone === "danger"
          ? "border-rose-500/30 bg-rose-500/5 text-rose-200"
          : "border-[var(--border)] bg-brand-50/60 text-[var(--muted)]",
        className
      )}
    >
      {icon && <div className="mb-3 flex justify-center text-3xl opacity-70">{icon}</div>}
      <div className="font-medium text-[var(--foreground)]">{title}</div>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}
