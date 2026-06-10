"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  IconDashboard,
  IconRefresh,
  IconSearch,
  IconSettings,
} from "@/components/ui/icons";

type NavItem = {
  href: string;
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  // active เมื่อ pathname ขึ้นต้นด้วย prefix นี้ (ไว้ไฮไลต์เมนูหน้า keyword)
  match?: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "ภาพรวม", icon: IconDashboard, match: (p) => p === "/" || p.startsWith("/k") },
  { href: "/search", label: "ค้นหาเทียบราคา", icon: IconSearch, match: (p) => p.startsWith("/search") },
  { href: "/settings", label: "ตั้งค่า", icon: IconSettings, match: (p) => p.startsWith("/settings") },
];

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/95 shadow-glow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="aooprice" width={26} height={26} />
      </span>
      <span className="text-lg font-bold tracking-tight">
        <span className="gradient-text">aoo</span>
        <span className="text-white/90">price</span>
      </span>
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      <div className="muted px-3 pb-2 pt-1 text-[11px] uppercase tracking-widest">
        เมนู
      </div>
      {NAV.map((item, i) => {
        const active = item.match
          ? item.match(pathname)
          : pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={i}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-gradient-card text-white shadow-glow"
                : "text-[var(--muted)] hover:bg-white/[0.04] hover:text-white"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-brand" />
            )}
            <Icon
              className={cn(
                "shrink-0 transition",
                active ? "text-brand-300" : "text-[var(--muted)] group-hover:text-white"
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// การ์ดสถานะการดึงข้อมูล (footer ของ sidebar)
export function ExtensionHint() {
  return (
    <div className="card mt-auto p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconRefresh width={16} height={16} className="text-brand-300" />
        ดึงผ่าน Extension
      </div>
      <p className="muted mt-1.5 text-xs leading-relaxed">
        เปิด Chrome Extension แล้วกด “ดึงเดี๋ยวนี้” เพื่ออัพเดทราคาล่าสุดจาก Shopee
      </p>
    </div>
  );
}
