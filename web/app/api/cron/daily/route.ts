import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { checkCronAuth } from "@/lib/auth";

export const runtime = "nodejs";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/cron/daily — Vercel Cron เรียกทุกวัน
// 1) เช็คว่า keyword ไหนข้อมูลเก่า (ไม่มี snapshot ใน 26 ชม.) -> ต้องเตือนให้เปิด extension
// 2) คำนวณ price delta เทียบ ~24 ชม.ก่อน -> รายงานคู่แข่งที่ลด/ขึ้นราคา
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 0) cleanup search jobs (ad-hoc): ลบ job เก่า > 1 วัน + ปลด job ค้าง running > 5 นาที
  //    (extension claim แล้ว crash/ปิด — กันค้างถาวร)
  let searchJobsCleaned = 0;
  try {
    const del = await sql`DELETE FROM search_jobs WHERE created_at < now() - interval '1 day' RETURNING id`;
    await sql`UPDATE search_jobs SET status = 'error', error = 'expired'
              WHERE status = 'running' AND claimed_at < now() - interval '5 minutes'`;
    searchJobsCleaned = del.length;
  } catch {
    // ตาราง search_jobs อาจยังไม่มีในบาง env — ไม่ให้ cron ล้ม
  }

  // 1) ความสดของข้อมูลต่อ keyword
  const freshness = await sql`
    SELECT
      k.id, k.keyword, k.label,
      MAX(s.captured_at) AS last_captured,
      (MAX(s.captured_at) < now() - interval '26 hours') AS is_stale
    FROM keywords k
    LEFT JOIN products p ON p.keyword_id = k.id
    LEFT JOIN snapshots s ON s.product_id = p.id
    GROUP BY k.id, k.keyword, k.label
    ORDER BY k.id
  `;

  // 2) price delta: ราคาล่าสุด vs ราคาล่าสุดก่อนหน้านั้น ~24ชม. (ต่อ product)
  const changes = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (p.id)
        p.id AS product_id, p.keyword_id, p.shop_name, p.title,
        s.price AS price_now, s.captured_at AS at_now
      FROM products p
      JOIN snapshots s ON s.product_id = p.id
      ORDER BY p.id, s.captured_at DESC
    ),
    prev AS (
      SELECT DISTINCT ON (p.id)
        p.id AS product_id, s.price AS price_prev
      FROM products p
      JOIN snapshots s ON s.product_id = p.id
      WHERE s.captured_at < now() - interval '20 hours'
      ORDER BY p.id, s.captured_at DESC
    )
    SELECT
      l.product_id, l.keyword_id, l.shop_name, l.title,
      l.price_now, pr.price_prev,
      (l.price_now - pr.price_prev) AS delta
    FROM latest l
    JOIN prev pr ON pr.product_id = l.product_id
    WHERE pr.price_prev IS DISTINCT FROM l.price_now
    ORDER BY delta ASC
  `;

  const priceChanges = changes.map((c) => ({
    productId: Number(c.product_id),
    keywordId: Number(c.keyword_id),
    shopName: c.shop_name,
    title: c.title,
    priceNow: c.price_now != null ? Number(c.price_now) : null,
    pricePrev: c.price_prev != null ? Number(c.price_prev) : null,
    delta: c.delta != null ? Number(c.delta) : null,
  }));

  const staleKeywords = freshness
    .filter((f) => f.is_stale || f.last_captured == null)
    .map((f) => ({ id: Number(f.id), keyword: f.keyword, label: f.label }));

  // TODO(เฟสถัดไป): ส่งแจ้งเตือนผ่าน LINE Notify / อีเมล
  // ตอนนี้แค่คืน summary ให้ dashboard ดึงไปแสดง + log
  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    staleKeywords,
    priceChanges,
    searchJobsCleaned,
  });
}
