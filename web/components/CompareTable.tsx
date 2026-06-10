"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlatformBadge, platformLabel } from "@/components/ui/PlatformBadge";
import { Table, THead, TR, TD } from "@/components/ui/Table";
import { ImageZoom } from "@/components/ui/ImageZoom";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconExternal } from "@/components/ui/icons";

export type CompareRow = {
  product_id: number;
  platform: string;
  shop_name: string | null;
  title: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  price_before: number | null; // ราคาตั้ง (ก่อนลด) — null ถ้าไม่ลด
  sold: number | null; // legacy
  sold_monthly: number | null; // ขาย/เดือน
  sold_total: number | null; // ขายสะสมตลอด
  rating: number | null;
  rating_count: number | null;
  is_official: boolean | null;
};

function fmt(n: number | null) {
  return n == null ? "-" : Number(n).toLocaleString("th-TH");
}

// คอลัมน์ตัวเลขที่คลิก header เรียงได้
type SortKey = "relevance" | "price" | "soldMonthly" | "soldTotal" | "revenue" | "rating";
type SortDir = "asc" | "desc";

// preset เรียงด่วน (dropdown)
const SORT_PRESETS: { label: string; key: SortKey; dir: SortDir }[] = [
  { label: "ตามผลลัพธ์ Shopee", key: "relevance", dir: "asc" },
  { label: "ขายดี/เดือน", key: "soldMonthly", dir: "desc" },
  { label: "ขายสะสมสูงสุด", key: "soldTotal", dir: "desc" },
  { label: "ยอดขายรวมสูงสุด", key: "revenue", dir: "desc" },
  { label: "ราคาถูกสุด", key: "price", dir: "asc" },
  { label: "เรตติ้งสูงสุด", key: "rating", dir: "desc" },
];

export function CompareTable({
  rows,
  myShopByPlatform,
}: {
  rows: CompareRow[];
  myShopByPlatform: Record<string, string | null>;
}) {
  const [active, setActive] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  // default = relevance (ตามลำดับผลลัพธ์ของ Shopee เดิม ไม่ sort)
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const platforms = useMemo(() => {
    const set = new Set(rows.map((r) => r.platform));
    return Array.from(set);
  }, [rows]);

  function isMine(r: CompareRow) {
    const mine = myShopByPlatform[r.platform];
    return !!(mine && r.shop_name && r.shop_name === mine);
  }

  // ยอดขายรวม (มูลค่าโดยประมาณ) = ราคา × ขายสะสมตลอด — Shopee ไม่มี field ตรง
  function revenue(r: CompareRow) {
    const total = r.sold_total ?? r.sold;
    return r.price != null && total != null ? r.price * total : null;
  }

  // คลิก header: key เดิม → สลับทิศ · key ใหม่ → default (ราคา asc, ที่เหลือ desc)
  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "price" ? "asc" : "desc");
    }
  }

  const view = useMemo(() => {
    let v = active === "all" ? rows : rows.filter((r) => r.platform === active);
    const q = query.trim().toLowerCase();
    if (q) {
      v = v.filter(
        (r) =>
          (r.title || "").toLowerCase().includes(q) ||
          (r.shop_name || "").toLowerCase().includes(q),
      );
    }
    // relevance = ลำดับเดิมจาก Shopee (ไม่ sort)
    if (sortKey === "relevance") return v;
    const valOf = (r: CompareRow): number | null => {
      if (sortKey === "revenue") return revenue(r);
      if (sortKey === "soldMonthly") return r.sold_monthly ?? null;
      if (sortKey === "soldTotal") return r.sold_total ?? r.sold ?? null;
      return r[sortKey] as number | null;
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...v].sort((a, b) => {
      const av = valOf(a);
      const bv = valOf(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // null ไปท้ายเสมอ
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [rows, active, query, sortKey, sortDir]);

  // ราคาต่ำสุดของชุดที่แสดง (มาร์ค "ถูกสุด")
  const minPrice = view.reduce<number | null>(
    (m, r) => (r.price != null && (m == null || r.price < m) ? r.price : m),
    null,
  );

  return (
    <div>
      {/* แถวควบคุม: filter platform + ช่องค้นในตาราง */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {platforms.length > 1 && (
            <>
              <FilterChip
                label={`ทั้งหมด (${rows.length})`}
                active={active === "all"}
                onClick={() => setActive("all")}
              />
              {platforms.map((p) => (
                <FilterChip
                  key={p}
                  label={`${platformLabel(p)} (${rows.filter((r) => r.platform === p).length})`}
                  active={active === p}
                  onClick={() => setActive(p)}
                />
              ))}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <select
            className="input-field sm:w-48"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
              setSortKey(k);
              setSortDir(d);
            }}
            aria-label="เรียงลำดับ"
          >
            {SORT_PRESETS.map((p) => (
              <option key={`${p.key}:${p.dir}`} value={`${p.key}:${p.dir}`}>
                เรียง: {p.label}
              </option>
            ))}
          </select>
          <input
            className="input-field sm:w-56"
            placeholder="ค้นในตาราง…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {view.length === 0 ? (
        <EmptyState icon="🛒" title={query ? "ไม่พบในตาราง" : "ยังไม่มีข้อมูล"}>
          {query ? "ลองคำค้นอื่น" : "เปิด Extension แล้วกด “ดึงเดี๋ยวนี้”"}
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <tr>
              <th className="w-10 px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">ร้าน / สินค้า</th>
              <SortTH label="ราคา" col="price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortTH label="ขาย/เดือน" col="soldMonthly" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortTH label="ขายสะสม" col="soldTotal" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortTH label="ยอดขายรวม" col="revenue" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortTH label="เรตติ้ง" col="rating" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <th className="w-14 px-4 py-3 text-center"> </th>
            </tr>
          </THead>
          <tbody>
            {view.map((r, i) => {
              const mine = isMine(r);
              const isCheapest = r.price != null && r.price === minPrice;
              return (
                <TR key={r.product_id} highlight={mine}>
                  <TD className="muted tabular-nums">{i + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <ImageZoom
                        src={r.image_url}
                        alt={r.title ?? ""}
                        title={[r.title, r.shop_name].filter(Boolean).join(" · ")}
                      />
                      <div className="min-w-0">
                        <div className="line-clamp-1">{r.title}</div>
                        <div className="muted mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <PlatformBadge platform={r.platform} />
                          {r.shop_name}
                          {r.is_official && <Badge tone="danger">Mall</Badge>}
                          {mine && <Badge tone="accent">ร้านเรา</Badge>}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {/* ราคาตั้ง (ขีดฆ่า แดง) ถ้ามีและมากกว่าราคาขายจริง */}
                    {r.price_before != null && r.price != null && r.price_before > r.price && (
                      <div className="text-[11px] text-rose-500 line-through">
                        ฿{fmt(r.price_before)}
                      </div>
                    )}
                    <span
                      className={
                        r.price_before != null && r.price != null && r.price_before > r.price
                          ? "font-bold text-emerald-700" // มีส่วนลด → เขียว
                          : isCheapest
                            ? "font-bold text-emerald-700"
                            : "font-semibold text-brand-700"
                      }
                    >
                      ฿{fmt(r.price)}
                    </span>
                    {isCheapest && <div className="text-[10px] text-emerald-700">ถูกสุด</div>}
                  </TD>
                  <TD className="muted text-right tabular-nums">{fmt(r.sold_monthly)}</TD>
                  <TD className="muted text-right tabular-nums">{fmt(r.sold_total ?? r.sold)}</TD>
                  <TD className="text-right tabular-nums">
                    {revenue(r) != null ? (
                      <span className="font-medium text-ink-900">฿{fmt(revenue(r))}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {/* เอา icon ดาวออกจาก data — เหลือเลขเรตติ้ง */}
                    {r.rating != null ? (
                      <span className="font-medium text-amber-700">{r.rating}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                    {r.rating_count ? (
                      <div className="muted text-[10px]">({r.rating_count})</div>
                    ) : null}
                  </TD>
                  <TD className="text-center">
                    {r.product_url && (
                      <a
                        href={r.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-lg p-2 text-brand-600 transition hover:bg-brand-50 hover:text-brand-700"
                        aria-label={`เปิดบน ${platformLabel(r.platform)}`}
                      >
                        <IconExternal />
                      </a>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// header ที่ sort ได้ — คลิกเรียง, แสดงลูกศร, ใส่ aria-sort เพื่อ a11y
function SortTH({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const activeCol = sortKey === col;
  return (
    <th
      className="px-4 py-3 text-right"
      aria-sort={activeCol ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onClick(col)}
        className={
          "inline-flex items-center gap-1 transition hover:text-ink-900 " +
          (activeCol ? "text-brand-700" : "text-[var(--muted)]")
        }
      >
        {label}
        <span className="text-[10px]">
          {activeCol ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition " +
        (active
          ? "border-brand-300 bg-brand-100 text-brand-700"
          : "border-[var(--border)] bg-white text-[var(--muted)] hover:text-ink-900")
      }
    >
      {label}
    </button>
  );
}
