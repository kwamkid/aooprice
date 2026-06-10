"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CompareTable, type CompareRow } from "@/components/CompareTable";
import { DinoGame } from "@/components/DinoGame";

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
  priceBefore?: number | null;
  sold?: number | null;
  soldMonthly?: number | null;
  soldTotal?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  isOfficial?: boolean | null;
  platform?: string | null;
};

// คงลำดับเดิมจาก Shopee (relevance) — ไม่ sort ที่นี่ ให้ CompareTable จัดการ sort เอง
function toRows(items: AdhocItem[], platform: string): CompareRow[] {
  return items.map((it, i) => ({
    product_id: i, // ad-hoc ไม่มี id จริง ใช้ index เป็น key (= ลำดับ Shopee)
    platform: it.platform || platform,
    shop_name: it.shopName ?? null,
    title: it.title ?? null,
    image_url: it.imageUrl ?? null,
    product_url: it.productUrl ?? null,
    price: it.price ?? null,
    price_before: it.priceBefore ?? null,
    sold: it.sold ?? it.soldTotal ?? null,
    sold_monthly: it.soldMonthly ?? null,
    sold_total: it.soldTotal ?? it.sold ?? null,
    rating: it.rating ?? null,
    rating_count: it.ratingCount ?? null,
    is_official: it.isOfficial ?? null,
  }));
}

const POLL_MS = 2000;
const TIMEOUT_MS = 90_000; // เลิก poll หลัง 90 วิ (extension อาจไม่เปิด)

// rate-limit ค้นสด (fix ในระบบ) — กันค้นถี่จนโดน Shopee CAPTCHA [[shopee-captcha-not-a-bug]]
const COOLDOWN_MS = 60_000; // ต้องรอ 60 วิ ระหว่างแต่ละครั้ง
const WINDOW_MS = 10 * 60_000; // หน้าต่าง 10 นาที
const MAX_IN_WINDOW = 10; // ค้นได้สูงสุด 10 ครั้งใน 10 นาที
const LS_KEY = "aooprice.searchTimes"; // เก็บ timestamp การค้นใน localStorage
const RECENT_KEY = "aooprice.recentKeywords"; // เก็บ keyword ที่ค้นล่าสุด
const RECENT_MAX = 20; // จำ 20 อันล่าสุด

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function pushRecent(keyword: string): string[] {
  const next = [keyword, ...loadRecent().filter((k) => k.toLowerCase() !== keyword.toLowerCase())].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ข้ามได้ */
  }
  return next;
}

function loadTimes(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// คืนสถานะ rate-limit ณ เวลา now: ค้นได้ไหม + ต้องรอกี่วิ + เหตุผล
function rateStatus(times: number[], now: number) {
  const recent = times.filter((t) => now - t < WINDOW_MS);
  const last = recent.length ? Math.max(...recent) : 0;
  const cooldownLeft = last ? Math.max(0, COOLDOWN_MS - (now - last)) : 0;
  if (recent.length >= MAX_IN_WINDOW) {
    // ครบเพดาน — รอจนตัวที่เก่าสุดหลุดหน้าต่าง
    const oldest = Math.min(...recent);
    return {
      ok: false,
      secondsLeft: Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
      reason: `ครบเพดาน ${MAX_IN_WINDOW} ครั้งใน 10 นาที`,
    };
  }
  if (cooldownLeft > 0) {
    return {
      ok: false,
      secondsLeft: Math.ceil(cooldownLeft / 1000),
      reason: "เพิ่งค้นไป กันค้นถี่เกิน (ลด CAPTCHA)",
    };
  }
  return { ok: true, secondsLeft: 0, reason: "" };
}

type State =
  | { kind: "idle" }
  | { kind: "waiting"; keyword: string } // รอ extension
  | { kind: "done"; keyword: string; rows: CompareRow[] }
  | { kind: "error"; message: string };

export function SearchClient({ shopFilter }: { shopFilter?: boolean }) {
  const [q, setQ] = useState("");
  const [shop, setShop] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  // rate-limit: now เดินทุกวินาทีเพื่อ re-คำนวณ countdown (เริ่ม 0 = SSR-safe)
  const [now, setNow] = useState(0);
  const [recent, setRecent] = useState<string[]>([]); // keyword ล่าสุด (โหลด client)
  const [favs, setFavs] = useState<Set<string>>(new Set()); // keyword ที่ติดตามแล้ว (lowercase)
  const [favoriting, setFavoriting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNow(Date.now());
    setRecent(loadRecent());
    // โหลด keyword ที่ติดตามอยู่แล้ว (ไว้เช็คว่า favorite ไปแล้วไหม)
    fetch("/api/keywords")
      .then((r) => r.json())
      .then((j) => setFavs(new Set((j.keywords ?? []).map((k: { keyword: string }) => k.keyword.toLowerCase()))))
      .catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ติดตาม keyword นี้ (favorite) — เพิ่มเข้าระบบติดตามถาวร เหมือนหน้าแรก
  async function favorite(keyword: string) {
    if (favoriting || favs.has(keyword.toLowerCase())) return;
    setFavoriting(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, label: keyword }),
      });
      if (res.ok) setFavs((s) => new Set(s).add(keyword.toLowerCase()));
    } catch {
      /* เงียบ */
    } finally {
      setFavoriting(false);
    }
  }

  const rate = now ? rateStatus(loadTimes(), now) : { ok: true, secondsLeft: 0, reason: "" };
  const searching = state.kind === "waiting";
  const blocked = !rate.ok || searching;

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  async function runSearch(kw?: string) {
    const keyword = (kw ?? q).trim();
    if (!keyword) return;
    // block ที่การกระทำ: ถ้าติด rate-limit ห้ามยิง
    if (!rateStatus(loadTimes(), Date.now()).ok) return;
    if (kw) setQ(kw); // คลิก chip → เติมในช่องด้วย
    // บันทึกเวลาค้น (กันเกินเพดาน/cooldown) + จำ keyword
    try {
      const times = loadTimes().filter((t) => Date.now() - t < WINDOW_MS);
      times.push(Date.now());
      localStorage.setItem(LS_KEY, JSON.stringify(times));
    } catch {
      /* localStorage ไม่ว่าง — ข้ามได้ */
    }
    setRecent(pushRecent(keyword));
    setNow(Date.now());
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
        <Button
          type="submit"
          disabled={!q.trim() || blocked}
          className="shrink-0"
        >
          {searching
            ? "กำลังค้น…"
            : !rate.ok
              ? `รออีก ${rate.secondsLeft} วิ`
              : "ค้นหา"}
        </Button>
      </form>

      {/* keyword ที่ค้นล่าสุด (จำ 20 อัน) — คลิกเพื่อค้นซ้ำ */}
      {recent.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="muted text-xs">ล่าสุด:</span>
          {recent.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => runSearch(kw)}
              disabled={blocked}
              className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-ink-850 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              {kw}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(RECENT_KEY);
              } catch {
                /* ข้าม */
              }
              setRecent([]);
            }}
            className="muted ml-1 text-xs underline-offset-2 hover:underline"
          >
            ล้าง
          </button>
        </div>
      )}

      {/* เหตุผลที่ค้นไม่ได้ตอนนี้ (cooldown / เพดาน) */}
      {!searching && !rate.ok && (
        <div className="muted mb-4 text-xs">
          ⏳ {rate.reason} · ค้นได้อีกใน {rate.secondsLeft} วินาที
        </div>
      )}

      {searching && (
        <div className="mb-4">
          <div className="mb-3 rounded-xl border border-[var(--border)] bg-gradient-card p-4">
            <div className="font-semibold">
              ⏳ กำลังค้น &quot;{state.keyword}&quot; ผ่าน Extension…
            </div>
            <div className="muted mt-1 text-xs">
              ผลจะมาภายใน ~ไม่กี่วินาที–1 นาที · ต้องเปิด Chrome ที่ติดตั้ง extension ค้างไว้ ·
              เล่นเกมรอได้เลย 👇
            </div>
          </div>
          <DinoGame />
        </div>
      )}

      {state.kind === "error" && (
        <EmptyState tone="danger" title="ค้นหาไม่สำเร็จ">
          {state.message}
        </EmptyState>
      )}

      {state.kind === "done" && (
        <>
          {/* แถวหัวผลค้น: จำนวน + favorite (ติดตาม) + ลิงก์ Shopee */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="muted">
              ผลค้น &quot;{state.keyword}&quot; · {state.rows.length} รายการ
            </span>
            {favs.has(state.keyword.toLowerCase()) ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                ★ ติดตามแล้ว
              </span>
            ) : (
              <button
                type="button"
                onClick={() => favorite(state.keyword)}
                disabled={favoriting}
                className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
              >
                ☆ ติดตาม keyword นี้
              </button>
            )}
            <a
              href={`https://shopee.co.th/search?keyword=${encodeURIComponent(state.keyword)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              เปิดบน Shopee ↗
            </a>
          </div>
          {state.rows.length === 0 ? (
            <EmptyState icon="🔍" title={`ไม่พบสินค้าสำหรับ "${state.keyword}"`}>
              ลองคำค้นอื่น หรือเอาตัวกรองชื่อร้านออก
            </EmptyState>
          ) : (
            <CompareTable rows={state.rows} myShopByPlatform={{}} />
          )}
        </>
      )}
    </div>
  );
}
