import { cn } from "@/lib/cn";

// ตารางของ design system — wrapper จัดการ overflow + border โทนเข้ม
export function Table({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className={cn("w-full min-w-[640px] text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[var(--border)] bg-brand-50/60 text-xs uppercase tracking-wide text-[var(--muted)]">
      {children}
    </thead>
  );
}

export function TH({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th className={cn("px-4 py-3 text-left font-medium", className)}>{children}</th>
  );
}

export function TR({
  className,
  highlight,
  children,
}: {
  className?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] transition last:border-0",
        highlight
          ? "bg-brand-500/10 hover:bg-brand-500/15"
          : "hover:bg-brand-50/60",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
