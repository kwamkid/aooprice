import { cn } from "@/lib/cn";

// ป้ายระบุแพลตฟอร์ม — ใช้ไอคอน SVG จาก public/platform/
const PLATFORMS: Record<string, { label: string; icon: string | null }> = {
  shopee: { label: "Shopee", icon: "/platform/shopee.svg" },
  tiktok: { label: "TikTok Shop", icon: "/platform/tiktok_shop.svg" },
  lazada: { label: "Lazada", icon: "/platform/lazada.svg" },
  line: { label: "LINE Shopping", icon: "/platform/line_shopping.svg" },
};

export function platformLabel(platform: string) {
  return PLATFORMS[platform]?.label ?? platform;
}

// ไอคอนแพลตฟอร์ม (วงกลมพื้นขาว + โลโก้) — ใช้ในตาราง/ฟิลเตอร์
export function PlatformBadge({
  platform,
  className,
  showLabel = false,
}: {
  platform: string;
  className?: string;
  showLabel?: boolean;
}) {
  const p = PLATFORMS[platform];
  if (!p?.icon) {
    // ไม่รู้จัก platform → ป้ายข้อความ fallback
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-[var(--border)] bg-brand-50 px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--muted)]",
          className,
        )}
      >
        {platform}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="grid h-5 w-5 place-items-center rounded-md border border-[var(--border)] bg-white p-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.icon} alt={p.label} width={16} height={16} className="h-full w-full object-contain" />
      </span>
      {showLabel && <span className="text-[11px] font-medium text-ink-850">{p.label}</span>}
    </span>
  );
}
