"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { IconClose } from "@/components/ui/icons";

// รูป thumbnail ที่กดแล้วขยายเป็น lightbox เต็มจอ
// ใช้ URL จาก Shopee CDN ตรง ๆ (ไม่ได้เก็บไฟล์) — แชร์ได้ทุกที่ที่ต้องโชว์รูปสินค้า
export function ImageZoom({
  src,
  alt = "",
  title,
  className,
}: {
  src: string | null;
  alt?: string;
  title?: string; // ข้อความใต้รูปตอนขยาย (เช่น ชื่อสินค้า/ร้าน)
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // ปิดด้วย Esc + ล็อก scroll ตอนเปิด
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!src) {
    return (
      <div
        className={cn(
          "h-11 w-11 rounded-lg border border-[var(--border)] bg-brand-50",
          className
        )}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border border-[var(--border)] transition hover:border-brand-400/50 hover:shadow-glow",
          className
        )}
        aria-label="ขยายรูป"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-11 w-11 object-cover transition duration-200 group-hover:scale-105"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid h-screen w-screen place-items-center overflow-hidden bg-black/80 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"
            aria-label="ปิด"
          >
            <IconClose />
          </button>

          <figure
            className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="min-h-0 max-h-[80vh] w-auto max-w-full rounded-2xl border border-white/10 object-contain shadow-soft"
            />
            {title && (
              <figcaption className="max-w-full shrink-0 truncate text-center text-sm text-white/80">
                {title}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </>
  );
}
