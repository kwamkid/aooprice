import { cn } from "@/lib/cn";
import { Card } from "./Card";

// การ์ดตัวเลขสรุป (KPI) — ใช้บน dashboard
export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden p-5", className)}>
      <div className="absolute inset-0 bg-gradient-card" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="muted text-xs">{label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
          {hint && <div className="muted mt-1 text-[11px]">{hint}</div>}
        </div>
        {icon && (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-white shadow-glow">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
