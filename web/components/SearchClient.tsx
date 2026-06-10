"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CompareTable, type CompareRow } from "@/components/CompareTable";

// ค้นหา real-time — ยิงผ่าน extension เท่านั้น (ดู CLAUDE.md "ยิงสด = ผ่าน extension")
// flow: POST /api/search-job → poll ทุก 2 วิ → extension claim+ยิง+ส่งผลกลับ → done → แสดงตาราง

// item ที่ extension ส่งกลับ (camelCase จาก fetcher) → map เป็น CompareRow (snake_case)
type AdhocItem = {
  itemId?: string | number;
  shopId?: string | number;
  shopName?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  price?: number | null;
  sold?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  isOfficial?: boolean | null;
  platform?: string | null;
};

function toRows(items: AdhocItem[], platform: string): CompareRow[] {
  return items
    .map((it, i) => ({
      product_id: i, // ad-hoc ไม่มี id จริง ใช้ index เป็น key
      platform: it.platform || platform,
      shop_name: it.shopName ?? null,
      title: it.title ?? null,
      image_url: it.imageUrl ?? null,
      product_url: it.productUrl ?? null,
      price: it.price ?? null,
      sold: it.sold ?? null,
      rating: it.rating ?? null,
      rating_count: it.ratingCount ?? null,
      is_official: it.isOfficial ?? null,
    }))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
}

const POLL_MS = 2000;
const TIMEOUT_MS = 90_000; // เลิก poll หลัง 90 วิ (extension อาจไม่เปิด)

type State =
  | { kind: "idle" }
  | { kind: "waiting"; keyword: string } // รอ extension
  | { kind: "done"; keyword: string; rows: CompareRow[] }
  | { kind: "error"; message: string };

export function SearchClient({ shopFilter }: { shopFilter?: boolean }) {
  const [q, setQ] = useState("");
  const [shop, setShop] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  async function runSearch() {
    const keyword = q.trim();
    if (!keyword) return;
    stopPolling();
    setState({ kind: "waiting", keyword });

    let jobId: string;
    try {
      const res = await fetch("/api/search-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const json = await res.json();
      if (!res.ok || !json.jobId) throw new Error(json.error || `HTTP ${res.status}`);
      jobId = json.jobId;
    } catch (e) {
      setState({ kind: "error", message: `สร้างคำค้นไม่สำเร็จ: ${e instanceof Error ? e.message : ""}` });
      return;
    }

    const startedAt = Date.now();
    const poll = async () => {
      try {
        const res = await fetch(`/api/search-job?id=${jobId}`);
        const { job } = await res.json();
        if (job?.status === "done") {
          stopPolling();
          let rows = toRows((job.result as AdhocItem[]) || [], job.platform || "shopee");
          const s = shop.trim().toLowerCase();
          if (s) rows = rows.filter((r) => (r.shop_name || "").toLowerCase().includes(s));
          setState({ kind: "done", keyword, rows });
          return;
        }
        if (job?.status === "error") {
          stopPolling();
          setState({ kind: "error", message: job.error || "ดึงข้อมูลไม่สำเร็จ" });
          return;
        }
      } catch {
        // เงียบไว้ ลองรอบหน้า
      }
      if (Date.now() - startedAt > TIMEOUT_MS) {
        stopPolling();
        setState({
          kind: "error",
          message: "หมดเวลา — เปิด Chrome ที่ติดตั้ง extension ค้างไว้ แล้วลองใหม่",
        });
        return;
      }
      pollRef.current = setTimeout(poll, POLL_MS);
    };
    pollRef.current = setTimeout(poll, POLL_MS);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="mb-5 flex flex-col gap-2 sm:flex-row"
      >
        <input
          className="input-field flex-1"
          placeholder="พิมพ์ keyword สินค้า เช่น GB Pockit, stroller …"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {shopFilter && (
          <input
            className="input-field sm:w-56"
            placeholder="กรองชื่อร้าน (ถ้ามี)"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          />
        )}
        <Button type="submit" disabled={!q.trim() || state.kind === "waiting"} className="shrink-0">
          {state.kind === "waiting" ? "กำลังค้น…" : "ค้นหา"}
        </Button>
      </form>

      {state.kind === "waiting" && (
        <EmptyState icon="⏳" title={`กำลังค้น "${state.keyword}" ผ่าน Extension…`}>
          ผลจะมาภายใน ~ไม่กี่วินาที–1 นาที · ต้องเปิด Chrome ที่ติดตั้ง extension ค้างไว้
        </EmptyState>
      )}

      {state.kind === "error" && (
        <EmptyState tone="danger" title="ค้นหาไม่สำเร็จ">
          {state.message}
        </EmptyState>
      )}

      {state.kind === "done" &&
        (state.rows.length === 0 ? (
          <EmptyState icon="🔍" title={`ไม่พบสินค้าสำหรับ "${state.keyword}"`}>
            ลองคำค้นอื่น หรือเอาตัวกรองชื่อร้านออก
          </EmptyState>
        ) : (
          <CompareTable rows={state.rows} myShopByPlatform={{}} />
        ))}
    </div>
  );
}
