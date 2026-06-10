import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";
import PriceChart from "@/components/PriceChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { CompareTable, type CompareRow } from "@/components/CompareTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

async function getData(id: number) {
  const kwRows = await sql`SELECT id, keyword, label, my_shop, my_shop_shopee, my_shop_tiktok, my_shop_lazada FROM keywords WHERE id = ${id}`;
  if (kwRows.length === 0) return null;
  const kw = kwRows[0];

  const rows = (await sql`
    SELECT
      p.id AS product_id, p.platform, p.shop_name, p.title, p.image_url, p.product_url,
      s.price, s.price_before, s.sold, s.rating, s.rating_count, s.is_official, s.captured_at
    FROM products p
    JOIN LATERAL (
      SELECT * FROM snapshots s2 WHERE s2.product_id = p.id
      ORDER BY s2.captured_at DESC LIMIT 1
    ) s ON true
    WHERE p.keyword_id = ${id}
    ORDER BY s.price ASC NULLS LAST
  `) as CompareRow[];

  return { kw, rows };
}

function fmt(n: number | null) {
  return n == null ? "-" : Number(n).toLocaleString("th-TH");
}

export default async function KeywordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(Number(id));
  if (!data) notFound();
  const { kw, rows } = data;

  // ชื่อร้านเราต่อ platform (fallback ไป my_shop เดิมสำหรับ shopee)
  const myShopByPlatform: Record<string, string | null> = {
    shopee: kw.my_shop_shopee ?? kw.my_shop ?? null,
    tiktok: kw.my_shop_tiktok ?? null,
    lazada: kw.my_shop_lazada ?? null,
  };
  const myShopNames = Object.values(myShopByPlatform).filter(Boolean) as string[];

  const labels: Record<number, string> = {};
  rows.forEach((r) => (labels[r.product_id] = r.shop_name || `#${r.product_id}`));

  const priced = rows.filter((r) => r.price != null);
  const minPrice = priced[0]?.price ?? null;
  const maxPrice = priced.length ? priced[priced.length - 1].price : null;
  // อันดับร้านเรา: หาแถวแรกที่ชื่อร้านตรงกับ my_shop ของ platform นั้น
  const myRow = rows.find(
    (r) => r.shop_name && r.shop_name === myShopByPlatform[r.platform],
  );
  const myRank = myRow ? rows.indexOf(myRow) + 1 : null;

  return (
    <div>
      <Link
        href="/"
        className="muted mb-2 inline-flex items-center gap-1 text-sm transition hover:text-ink-900"
      >
        ← กลับหน้าภาพรวม
      </Link>

      <PageHeader
        title={kw.label || kw.keyword}
        subtitle={
          <>
            keyword: {kw.keyword} · {rows.length} ร้าน
            {myShopNames.length > 0 && (
              <>
                {" "}· ร้านเรา:{" "}
                <span className="text-accent-400">{myShopNames.join(" / ")}</span>
              </>
            )}
          </>
        }
      />

      {/* KPI */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="ราคาต่ำสุด"
          value={minPrice != null ? "฿" + fmt(minPrice) : "-"}
          hint={priced[0]?.shop_name ?? undefined}
        />
        <StatCard
          label="ราคาสูงสุด"
          value={maxPrice != null ? "฿" + fmt(maxPrice) : "-"}
        />
        <StatCard
          label="อันดับร้านเรา"
          value={myRank != null ? `#${myRank}` : "—"}
          hint={
            myShopNames.length > 0
              ? `จาก ${rows.length} ร้าน`
              : "ยังไม่ได้ตั้งชื่อร้าน"
          }
        />
      </div>

      {/* กราฟราคาย้อนหลัง */}
      <Card className="mb-6">
        <CardHeader title="ราคาย้อนหลัง 90 วัน" subtitle="เส้นละ 1 ร้าน" />
        <div className="px-3 pb-4 pt-2">
          <PriceChart keywordId={kw.id} labels={labels} />
        </div>
      </Card>

      {/* ตารางเทียบราคา (มี filter platform + badge platform ในตัว) */}
      <CompareTable rows={rows} myShopByPlatform={myShopByPlatform} />
    </div>
  );
}
