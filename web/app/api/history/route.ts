import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/history?keywordId=...  -> price history ของทุก product ใน keyword
// หรือ ?productId=...             -> เฉพาะ product เดียว
// คืนเป็น snapshot รายวัน (ราคาล่าสุดของแต่ละวัน) ไว้ทำกราฟ
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const productId = params.get("productId");
  const keywordId = params.get("keywordId");
  const days = Math.min(Number(params.get("days")) || 90, 365);

  if (!productId && !keywordId) {
    return NextResponse.json(
      { error: "productId or keywordId required" },
      { status: 400 },
    );
  }

  // ดึงราคาล่าสุดของแต่ละวัน (เผื่อดึงหลายครั้งต่อวัน) ต่อ product
  const rows = productId
    ? await sql`
        SELECT DISTINCT ON (day) day, price, sold, product_id
        FROM (
          SELECT
            product_id,
            date_trunc('day', captured_at) AS day,
            price, sold, captured_at
          FROM snapshots
          WHERE product_id = ${Number(productId)}
            AND captured_at > now() - (${days} || ' days')::interval
        ) t
        ORDER BY day, captured_at DESC
      `
    : await sql`
        SELECT DISTINCT ON (product_id, day) product_id, day, price, sold
        FROM (
          SELECT
            s.product_id,
            date_trunc('day', s.captured_at) AS day,
            s.price, s.sold, s.captured_at
          FROM snapshots s
          JOIN products p ON p.id = s.product_id
          WHERE p.keyword_id = ${Number(keywordId)}
            AND s.captured_at > now() - (${days} || ' days')::interval
        ) t
        ORDER BY product_id, day, captured_at DESC
      `;

  const series = rows.map((r) => ({
    productId: Number(r.product_id),
    day: r.day,
    price: r.price != null ? Number(r.price) : null,
    sold: r.sold,
  }));

  return NextResponse.json({ series });
}
