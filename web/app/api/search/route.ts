import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { withCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

export const OPTIONS = preflight;

const sql = neon(process.env.DATABASE_URL!);

// ค้นหา real-time แบบ cache-aware:
//   POST { keyword } →
//     - cache HIT (มี snapshot ของ keyword นี้ใน 6 ชม.) → คืน { cached:true, items, capturedAt }
//     - cache MISS → สร้าง search_job (pending) → คืน { cached:false, jobId }
//       extension จะ claim → ดึง → ingest เข้า DB → set status=done
//       SearchClient เห็น done แล้วดึง /api/compare?keyword=... (DB = แหล่งความจริงเดียว)

const CACHE_MS = 6 * 60 * 60 * 1000; // 6 ชม.

export async function POST(req: Request) {
  let body: { keyword?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid json" }, { status: 400 }));
  }
  const keyword = body.keyword?.trim();
  if (!keyword) {
    return withCors(NextResponse.json({ error: "keyword required" }, { status: 400 }));
  }
  const platform = body.platform?.trim() || "shopee";

  // 1) เช็ค cache — snapshot ล่าสุดของ keyword นี้ (จาก product ใด ๆ)
  const freshRows = await sql`
    SELECT MAX(s.captured_at) AS last
    FROM keywords k
    JOIN products p ON p.keyword_id = k.id
    JOIN snapshots s ON s.product_id = p.id
    WHERE k.keyword = ${keyword}
  `;
  const last = freshRows[0]?.last as string | null;
  const ageMs = last ? Date.now() - new Date(last).getTime() : Infinity;

  if (last && ageMs < CACHE_MS) {
    // HIT — ดึง snapshot ล่าสุดต่อ product (เหมือน /api/compare) คืนเลย
    const rows = await sql`
      SELECT
        p.id AS product_id, p.platform, p.shop_name, p.title, p.image_url, p.product_url,
        s.price, s.price_before, s.sold, s.sold_monthly, s.sold_total,
        s.rating, s.rating_count, s.is_official
      FROM products p
      JOIN keywords k ON k.id = p.keyword_id
      JOIN LATERAL (
        SELECT * FROM snapshots s2 WHERE s2.product_id = p.id
        ORDER BY s2.captured_at DESC LIMIT 1
      ) s ON true
      WHERE k.keyword = ${keyword}
      ORDER BY p.id ASC
    `;
    const items = rows.map((r) => ({
      itemId: r.product_id,
      platform: r.platform,
      shopName: r.shop_name,
      title: r.title,
      imageUrl: r.image_url,
      productUrl: r.product_url,
      price: r.price != null ? Number(r.price) : null,
      priceBefore: r.price_before != null ? Number(r.price_before) : null,
      sold: r.sold,
      soldMonthly: r.sold_monthly,
      soldTotal: r.sold_total,
      rating: r.rating != null ? Number(r.rating) : null,
      ratingCount: r.rating_count,
      isOfficial: r.is_official,
    }));
    return withCors(
      NextResponse.json({ cached: true, items, capturedAt: last, ageMinutes: Math.round(ageMs / 60000) }),
    );
  }

  // 2) MISS — สร้าง job ให้ extension ดึงสด
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO search_jobs (id, keyword, platform, status)
    VALUES (${id}, ${keyword}, ${platform}, 'pending')
  `;
  return withCors(NextResponse.json({ cached: false, jobId: id }));
}
