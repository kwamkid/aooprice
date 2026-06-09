import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/compare?keyword=...  หรือ  ?keywordId=...
// คืน snapshot ล่าสุดต่อ product เรียงตามราคาถูก->แพง + มาร์คร้านเรา
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const keyword = params.get("keyword");
  const keywordId = params.get("keywordId");

  if (!keyword && !keywordId) {
    return NextResponse.json(
      { error: "keyword or keywordId required" },
      { status: 400 },
    );
  }

  // หา keyword row
  const kwRows = keywordId
    ? await sql`SELECT id, keyword, label, my_shop FROM keywords WHERE id = ${Number(keywordId)}`
    : await sql`SELECT id, keyword, label, my_shop FROM keywords WHERE keyword = ${keyword}`;

  if (kwRows.length === 0) {
    return NextResponse.json({ error: "keyword not found" }, { status: 404 });
  }
  const kw = kwRows[0];
  const myShop: string | null = kw.my_shop;

  // snapshot ล่าสุดต่อ product (DISTINCT ON) เรียงตามราคา
  const rows = await sql`
    SELECT
      p.id            AS product_id,
      p.item_id,
      p.shop_id,
      p.shop_name,
      p.title,
      p.image_url,
      p.product_url,
      s.price,
      s.sold,
      s.rating,
      s.rating_count,
      s.is_official,
      s.captured_at
    FROM products p
    JOIN LATERAL (
      SELECT * FROM snapshots s2
      WHERE s2.product_id = p.id
      ORDER BY s2.captured_at DESC
      LIMIT 1
    ) s ON true
    WHERE p.keyword_id = ${kw.id}
    ORDER BY s.price ASC NULLS LAST
  `;

  const items = rows.map((r, idx) => ({
    rank: idx + 1,
    productId: r.product_id,
    itemId: Number(r.item_id),
    shopId: Number(r.shop_id),
    shopName: r.shop_name,
    title: r.title,
    imageUrl: r.image_url,
    productUrl: r.product_url,
    price: r.price != null ? Number(r.price) : null,
    sold: r.sold,
    rating: r.rating != null ? Number(r.rating) : null,
    ratingCount: r.rating_count,
    isOfficial: r.is_official,
    capturedAt: r.captured_at,
    isMine: !!(myShop && r.shop_name && r.shop_name === myShop),
  }));

  return NextResponse.json({
    keyword: { id: kw.id, keyword: kw.keyword, label: kw.label, myShop },
    count: items.length,
    items,
  });
}
