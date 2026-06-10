"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Brand, SidebarNav, ExtensionHint } from "@/components/Sidebar";
import { IconMenu, IconClose } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Badge";

// โครงหลักของ admin theme: sidebar (desktop คงที่ / mobile เป็น drawer) + topbar + เนื้อหา
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* ===== Sidebar (desktop) ===== */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-[var(--border)] bg-white/70 p-5 backdrop-blur-xl lg:flex">
        <Brand />
        <SidebarNav />
        <ExtensionHint />
      </aside>

      {/* ===== Sidebar (mobile drawer) ===== */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        {/* backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        {/* panel */}
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-[78%] max-w-[300px] flex-col gap-6 border-r border-[var(--border)] bg-white p-5 shadow-soft transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between">
            <Brand />
            <button
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-brand-50 hover:text-ink-900"
              aria-label="ปิดเมนู"
            >
              <IconClose />
            </button>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
          <ExtensionHint />
        </aside>
      </div>

      {/* ===== Content column ===== */}
      <div className="flex min-h-screen min-w-0 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-white/80 px-4 py-3 backdrop-blur-xl lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-brand-50 hover:text-ink-900 lg:hidden"
            aria-label="เปิดเมนู"
          >
            <IconMenu />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge tone="brand">Shopee Price Monitor</Badge>
          </div>
        </header>

        {/* Main */}
        <main className="mx-auto w-full max-w-6xl flex-1 animate-fade-in px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>

        <footer className="muted border-t border-[var(--border)] px-4 py-4 text-center text-xs lg:px-8">
          aooprice · เทียบราคา Shopee · อัพเดทผ่าน Extension
        </footer>
      </div>
    </div>
  );
}
