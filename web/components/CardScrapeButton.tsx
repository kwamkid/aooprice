"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ปุ่มดึงข้อมูล keyword นี้ (ในการ์ด dashboard) — สั่ง extension ดึง+ingest แล้ว refresh
// ใช้ /api/search (สร้าง job) → poll จน done → router.refresh() ให้การ์ดอัปเดต
export function CardScrapeButton({ keyword }: { keyword: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function run(e: React.MouseEvent) {
    // กันคลิกทะลุไป <Link> ของการ์ด
    e.preventDefault();
    e.stopPropagation();
    if (state === "working") return;
    setState("working");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const json = await res.json();
      if (json.cached) {
        // มีข้อมูลใน 6 ชม.อยู่แล้ว — refresh พอ
        router.refresh();
        setState("idle");
        return;
      }
      if (!json.jobId) throw new Error("no job");
      // poll จน extension ดึง+ingest เสร็จ (status=done) แล้ว refresh
      const started = Date.now();
      const poll = async () => {
        if (Date.now() - started > 90_000) {
          setState("error");
          return;
        }
        const r = await fetch(`/api/search-job?id=${json.jobId}`);
        const { job } = await r.json();
        if (job?.status === "done") {
          router.refresh();
          setState("idle");
        } else if (job?.status === "error") {
          setState("error");
        } else {
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 2000);
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "working"}
      className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
      title="ดึงข้อมูลล่าสุดของ keyword นี้ผ่าน Extension"
    >
      {state === "working" ? (
        <>⏳ กำลังดึง…</>
      ) : state === "error" ? (
        <>⚠ ลองใหม่</>
      ) : (
        <>⟳ ดึงข้อมูล</>
      )}
    </button>
  );
}
