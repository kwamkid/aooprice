import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTag, IconStore, IconChart } from "@/components/ui/icons";
import { KeywordSearch } from "@/components/KeywordSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

type KwCard = {
  id: number;
  keyword: string;
  label: string | null;
  my_shop: string | null;
  product_count: number;
  shopee_count: number;
  tiktok_count: number;
  lazada_count: number;
  min_price: number | null;
  max_price: number | null;
  last_captured: string | null;
  my_rank: number | null;
};

async function getKeywords(): Promise<KwCard[]> {
  // การ์ดสรุปต่อ keyword: จำนวนร้าน (+ แยกตาม platform), ราคาต่ำ/สูง, อันดับร้านเรา, ความสด
  const rows = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (p.id)
        p.id, p.keyword_id, p.platform, p.shop_name, s.price, s.captured_at
      FROM products p
      JOIN snapshots s ON s.product_id = p.id
      ORDER BY p.id, s.captured_at DESC
    ),
    ranked AS (
      SELECT *, rank() OVER (PARTITION BY keyword_id ORDER BY price ASC NULLS LAST) AS rnk
      FROM latest
    )
    SELECT
      k.id, k.keyword, k.label, k.my_shop,
      k.my_shop_shopee, k.my_shop_tiktok, k.my_shop_lazada,
      COUNT(r.id)::int          AS product_count,
      COUNT(r.id) FILTER (WHERE r.platform = 'shopee')::int AS shopee_count,
      COUNT(r.id) FILTER (WHERE r.platform = 'tiktok')::int AS tiktok_count,
      COUNT(r.id) FILTER (WHERE r.platform = 'lazada')::int AS lazada_count,
      MIN(r.price)              AS min_price,
      MAX(r.price)              AS max_price,
      MAX(r.captured_at)        AS last_captured,
      MIN(CASE WHEN r.shop_name IS NOT NULL AND r.shop_name = (
            CASE r.platform
              WHEN 'shopee' THEN COALESCE(k.my_shop_shopee, k.my_shop)
              WHEN 'tiktok' THEN k.my_shop_tiktok
              WHEN 'lazada' THEN k.my_shop_lazada
            END
          ) THEN r.rnk END)::int AS my_rank
    FROM keywords k
    LEFT JOIN ranked r ON r.keyword_id = k.id
    GROUP BY k.id, k.keyword, k.label, k.my_shop,
             k.my_shop_shopee, k.my_shop_tiktok, k.my_shop_lazada
    ORDER BY k.id
  `;
  return rows as KwCard[];
}

function fmtPrice(n: number | null) {
  return n == null ? "-" : "฿" + Number(n).toLocaleString("th-TH");
}

function staleBadge(last: string | null) {
  if (!last) return <Badge tone="danger">ยังไม่มีข้อมูล</Badge>;
  const ageH = (Date.now() - new Date(last).getTime()) / 3.6e6;
  if (ageH > 26) return <Badge tone="warning">ข้อมูลเก่า · เปิด Extension</Badge>;
  return <Badge tone="success">อัพเดท {Math.round(ageH)} ชม.ก่อน</Badge>;
}

export default async function HomePage() {
  let keywords: KwCard[] = [];
  let dbError = false;
  try {
    keywords = await getKeywords();
  } catch {
    dbError = true;
  }

  const totalShops = keywords.reduce((s, k) => s + (k.product_count || 0), 0);
  const tracked = keywords.filter((k) => k.last_captured).length;

  return (
    <div>
      <PageHeader
        title={<>ภาพรวม<span className="gradient-text">การติดตามราคา</span></>}
        subtitle="สรุปสินค้า/คู่แข่งที่ติดตามบน Shopee"
        action={<Badge tone="brand">{keywords.length} keyword</Badge>}
      />

      {dbError && (
        <EmptyState tone="danger" title="เชื่อมต่อฐานข้อมูลไม่ได้">
          ตรวจ <code className="rounded bg-white/10 px-1">DATABASE_URL</code> ใน .env แล้วรัน{" "}
          <code className="rounded bg-white/10 px-1">npm run db:push</code>
        </EmptyState>
      )}

      {!dbError && (
        <>
          {/* ค้นหา + favorite keyword ใหม่เข้าระบบติดตาม */}
          <KeywordSearch existing={keywords.map((k) => k.keyword)} />

          {/* KPI */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Keyword ที่ติดตาม"
              value={keywords.length}
              hint={`${tracked} รายการมีข้อมูลแล้ว`}
              icon={<IconTag width={20} height={20} />}
            />
            <StatCard
              label="ร้าน/สินค้ารวม"
              value={totalShops}
              hint="จากทุก keyword"
              icon={<IconStore width={20} height={20} />}
            />
            <StatCard
              label="สถานะข้อมูล"
              value={tracked === keywords.length && keywords.length > 0 ? "สด" : "บางส่วน"}
              hint="อัพเดทผ่าน Extension"
              icon={<IconChart width={20} height={20} />}
            />
          </div>

          {keywords.length === 0 ? (
            <EmptyState icon="🏷️" title="ยังไม่มี keyword">
              เพิ่มผ่าน Extension หรือรัน{" "}
              <code className="rounded bg-white/10 px-1">npm run db:seed</code>{" "}
              เพื่อใส่ข้อมูลตัวอย่าง
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {keywords.map((k) => (
                <Link key={k.id} href={`/k/${k.id}`} className="block">
                  <Card hover className="h-full p-5">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="line-clamp-1 font-semibold">
                          {k.label || k.keyword}
                        </div>
                        <div className="muted line-clamp-1 text-xs">{k.keyword}</div>
                      </div>
                      {k.my_rank != null && (
                        <Badge tone="accent">ร้านเรา #{k.my_rank}</Badge>
                      )}
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <div className="muted text-xs">ช่วงราคา</div>
                        <div className="text-lg font-bold gradient-text">
                          {fmtPrice(k.min_price)} – {fmtPrice(k.max_price)}
                        </div>
                      </div>
                      <div className="muted text-right text-xs">
                        {k.product_count} ร้าน
                      </div>
                    </div>

                    {(k.shopee_count > 0 ||
                      k.tiktok_count > 0 ||
                      k.lazada_count > 0) && (
                      <div className="muted mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                        {k.shopee_count > 0 && (
                          <span className="text-orange-300">
                            Shopee {k.shopee_count}
                          </span>
                        )}
                        {k.tiktok_count > 0 && (
                          <span className="text-pink-200">
                            TikTok {k.tiktok_count}
                          </span>
                        )}
                        {k.lazada_count > 0 && (
                          <span className="text-indigo-300">
                            Lazada {k.lazada_count}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-4 border-t border-[var(--border)] pt-3">
                      {staleBadge(k.last_captured)}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
