"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

// ช่องค้นหา/เพิ่ม keyword ที่หน้าแรก: พิมพ์ keyword แล้วกด "ติดตาม" (favorite)
// = เพิ่มเข้าตาราง keywords (POST /api/keywords, upsert) → extension จะดึงรอบถัดไป
// existing = keyword ที่ติดตามอยู่แล้ว (normalize ตัวพิมพ์) ไว้กันเพิ่มซ้ำ + บอกสถานะ
export function KeywordSearch({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const kw = q.trim();
  const already = kw !== "" && existing.some((e) => e.toLowerCase() === kw.toLowerCase());

  async function favorite() {
    if (!kw || already || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, label: kw }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg({ tone: "ok", text: `ติดตาม "${kw}" แล้ว — เปิด Extension เพื่อดึงข้อมูล` });
      setQ("");
      router.refresh(); // ดึงการ์ดใหม่จาก server component
    } catch (e) {
      setMsg({ tone: "err", text: `เพิ่มไม่สำเร็จ: ${e instanceof Error ? e.message : "ไม่ทราบสาเหตุ"}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          favorite();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx={11} cy={11} r={8} />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="input-field pl-9"
            placeholder="พิมพ์ keyword สินค้า เช่น GB Pockit, STOKKE YOYO3 …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant={already ? "ghost" : "primary"}
          disabled={!kw || already || saving}
          className="shrink-0"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill={already ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 17.3 6.16 20.5l1.12-6.5L2.5 9.3l6.56-.96L12 2.4l2.94 5.94 6.56.96-4.78 4.7 1.12 6.5z" />
          </svg>
          {saving ? "กำลังบันทึก…" : already ? "ติดตามแล้ว" : "ติดตาม keyword นี้"}
        </Button>
      </form>
      {msg && (
        <div
          className={
            "mt-2 text-xs " + (msg.tone === "ok" ? "text-emerald-700" : "text-rose-600")
          }
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
