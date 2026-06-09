"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlatformBadge, platformLabel } from "@/components/ui/PlatformBadge";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
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
  sold: number | null;
  rating: number | null;
  rating_count: number | null;
  is_official: boolean | null;
};

function fmt(n: number | null) {
  return n == null ? "-" : Number(n).toLocaleString("th-TH");
}

export function CompareTable({
  rows,
  myShopByPlatform,
}: {
  rows: CompareRow[];
  myShopByPlatform: Record<string, string | null>;
}) {
  // platform ที่มีจริงในผลลัพธ์ (ไว้ทำปุ่ม filter)
  const platforms = useMemo(() => {
    const set = new Set(rows.map((r) => r.platform));
    return Array.from(set);
  }, [rows]);

  const [active, setActive] = useState<string | "all">("all");

  const filtered = active === "all" ? rows : rows.filter((r) => r.platform === active);
  // ราคาต่ำสุดคำนวณจากชุดที่กำลังแสดง (เทียบในมุมที่ผู้ใช้เลือก)
  const minPrice = filtered.reduce<number | null>(
    (m, r) => (r.price != null && (m == null || r.price < m) ? r.price : m),
    null,
  );

  function isMine(r: CompareRow) {
    const mine = myShopByPlatform[r.platform];
    return !!(mine && r.shop_name && r.shop_name === mine);
  }

  return (
    <div>
      {/* filter platform */}
      {platforms.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
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
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="🛒" title="ยังไม่มีข้อมูล">
          เปิด Extension แล้วกด “ดึงเดี๋ยวนี้”
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-10">#</TH>
              <TH>ร้าน / สินค้า</TH>
              <TH className="text-right">ราคา</TH>
              <TH className="text-right">ขายแล้ว</TH>
              <TH className="text-right">เรตติ้ง</TH>
              <TH className="w-14 text-center"> </TH>
            </tr>
          </THead>
          <tbody>
            {filtered.map((r, i) => {
              const mine = isMine(r);
              const isCheapest = r.price != null && r.price === minPrice;
              return (
                <TR key={r.product_id} highlight={mine}>
                  <TD className="muted">{i + 1}</TD>
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
                  <TD className="text-right">
                    <span
                      className={
                        isCheapest
                          ? "font-bold text-emerald-300"
                          : "font-semibold text-white"
                      }
                    >
                      ฿{fmt(r.price)}
                    </span>
                    {isCheapest && (
                      <div className="text-[10px] text-emerald-400">ถูกสุด</div>
                    )}
                  </TD>
                  <TD className="muted text-right">{fmt(r.sold)}</TD>
                  <TD className="text-right">
                    {r.rating != null ? (
                      <span className="text-amber-300">⭐ {r.rating}</span>
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
                        className="inline-flex items-center justify-center rounded-lg p-2 text-brand-300 transition hover:bg-white/5 hover:text-brand-200"
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
          ? "border-brand-400/40 bg-brand-500/20 text-brand-100"
          : "border-[var(--border)] bg-white/5 text-[var(--muted)] hover:text-white")
      }
    >
      {label}
    </button>
  );
}
