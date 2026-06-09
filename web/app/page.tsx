import Link from "next/link";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

type KwCard = {
  id: number;
  keyword: string;
  label: string | null;
  my_shop: string | null;
  product_count: number;
  min_price: number | null;
  max_price: number | null;
  last_captured: string | null;
  my_rank: number | null;
};

async function getKeywords(): Promise<KwCard[]> {
  // การ์ดสรุปต่อ keyword: จำนวนร้าน, ราคาต่ำ/สูง, อันดับร้านเรา, ความสด
  const rows = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (p.id)
        p.id, p.keyword_id, p.shop_name, s.price, s.captured_at
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
      COUNT(r.id)::int          AS product_count,
      MIN(r.price)              AS min_price,
      MAX(r.price)              AS max_price,
      MAX(r.captured_at)        AS last_captured,
      MIN(CASE WHEN k.my_shop IS NOT NULL AND r.shop_name = k.my_shop THEN r.rnk END)::int AS my_rank
    FROM keywords k
    LEFT JOIN ranked r ON r.keyword_id = k.id
    GROUP BY k.id, k.keyword, k.label, k.my_shop
    ORDER BY k.id
  `;
  return rows as KwCard[];
}

function fmtPrice(n: number | null) {
  return n == null ? "-" : "฿" + Number(n).toLocaleString("th-TH");
}

function staleBadge(last: string | null) {
  if (!last) return <span className="text-xs text-red-500">ยังไม่มีข้อมูล</span>;
  const ageH = (Date.now() - new Date(last).getTime()) / 3.6e6;
  if (ageH > 26)
    return <span className="text-xs text-amber-600">ข้อมูลเก่า · เปิด Extension</span>;
  return <span className="text-xs text-green-600">อัพเดทล่าสุด {Math.round(ageH)} ชม.</span>;
}

export default async function HomePage() {
  let keywords: KwCard[] = [];
  let dbError = false;
  try {
    keywords = await getKeywords();
  } catch {
    dbError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">สินค้า / Keyword ที่ติดตาม</h1>
        <span className="text-sm text-gray-400">{keywords.length} รายการ</span>
      </div>

      {dbError && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          เชื่อมต่อฐานข้อมูลไม่ได้ — ตรวจ <code>DATABASE_URL</code> ใน .env แล้วรัน{" "}
          <code>npm run db:push</code>
        </div>
      )}

      {!dbError && keywords.length === 0 && (
        <div className="rounded border border-dashed bg-white p-8 text-center text-gray-500">
          ยังไม่มี keyword — เพิ่มผ่าน Extension หรือรัน <code>npm run db:seed</code>{" "}
          เพื่อใส่ข้อมูลตัวอย่าง
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keywords.map((k) => (
          <Link
            key={k.id}
            href={`/k/${k.id}`}
            className="block rounded-lg border bg-white p-4 hover:shadow-md transition"
          >
            <div className="font-semibold mb-1 line-clamp-1">
              {k.label || k.keyword}
            </div>
            <div className="text-xs text-gray-400 mb-3 line-clamp-1">
              {k.keyword}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-400">ช่วงราคา</div>
                <div className="font-bold text-orange-600">
                  {fmtPrice(k.min_price)} – {fmtPrice(k.max_price)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">{k.product_count} ร้าน</div>
                {k.my_rank != null && (
                  <div className="text-xs font-medium text-blue-600">
                    ร้านเรา #{k.my_rank}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t">{staleBadge(k.last_captured)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
