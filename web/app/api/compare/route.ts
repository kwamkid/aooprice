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
    ? await sql`SELECT id, keyword, label, my_shop, my_shop_shopee, my_shop_tiktok, my_shop_lazada FROM keywords WHERE id = ${Number(keywordId)}`
    : await sql`SELECT id, keyword, label, my_shop, my_shop_shopee, my_shop_tiktok, my_shop_lazada FROM keywords WHERE keyword = ${keyword}`;

  if (kwRows.length === 0) {
    return NextResponse.json({ error: "keyword not found" }, { status: 404 });
  }
  const kw = kwRows[0];
  // ชื่อร้านเราต่อ platform (fallback ไปที่ my_shop เดิมถ้ายังไม่ได้ตั้งแยก)
  const myShopByPlatform: Record<string, string | null> = {
    shopee: kw.my_shop_shopee ?? kw.my_shop ?? null,
    tiktok: kw.my_shop_tiktok ?? null,
    lazada: kw.my_shop_lazada ?? null,
  };

  // snapshot ล่าสุดต่อ product (DISTINCT ON) เรียงตามราคา
  const rows = await sql`
    SELECT
      p.id            AS product_id,
      p.platform,
      p.item_id,
      p.shop_id,
      p.shop_name,
      p.title,
      p.image_url,
      p.product_url,
      s.price,
      s.price_before,
      s.sold,
      s.sold_monthly,
      s.sold_total,
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
    ORDER BY p.id ASC
  `;

  const items = rows.map((r, idx) => {
    const mine = myShopByPlatform[r.platform];
    return {
      rank: idx + 1,
      productId: r.product_id,
      platform: r.platform,
      itemId: r.item_id,
      shopId: r.shop_id,
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
      capturedAt: r.captured_at,
      isMine: !!(mine && r.shop_name && r.shop_name === mine),
    };
  });

  return NextResponse.json({
    keyword: {
      id: kw.id,
      keyword: kw.keyword,
      label: kw.label,
      myShop: kw.my_shop,
      myShopByPlatform,
    },
    count: items.length,
    items,
  });
}
