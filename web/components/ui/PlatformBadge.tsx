import { cn } from "@/lib/cn";

// ป้ายระบุแพลตฟอร์ม — สีประจำแต่ละ marketplace
const PLATFORMS: Record<
  string,
  { label: string; className: string }
> = {
  shopee: {
    label: "Shopee",
    className: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  tiktok: {
    label: "TikTok",
    className: "bg-pink-500/15 text-pink-200 border-pink-400/30",
  },
  lazada: {
    label: "Lazada",
    className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
};

export function platformLabel(platform: string) {
  return PLATFORMS[platform]?.label ?? platform;
}

export function PlatformBadge({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  const p = PLATFORMS[platform] ?? {
    label: platform,
    className: "bg-white/5 text-[var(--muted)] border-[var(--border)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        p.className,
        className
      )}
    >
      {p.label}
    </span>
  );
}
