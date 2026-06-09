import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { keywords, products, snapshots } from "@/lib/schema";
import { checkIngestAuth } from "@/lib/auth";

export const runtime = "nodejs";

// รูปร่างข้อมูลที่ extension ส่งมาต่อ 1 รายการสินค้า
type IngestItem = {
  itemId: number;
  shopId: number;
  shopName?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  price?: number | null; // บาท (extension แปลง /100000 มาแล้ว)
  sold?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  isOfficial?: boolean | null;
};

type IngestBody = {
  keyword: string;
  label?: string | null;
  myShop?: string | null;
  items: IngestItem[];
};

export async function POST(req: Request) {
  if (!checkIngestAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const kw = body.keyword?.trim();
  if (!kw || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "keyword and items[] required" },
      { status: 400 },
    );
  }

  // 1) upsert keyword (สร้างถ้ายังไม่มี, อัพเดต label/myShop ถ้าส่งมา)
  const [kwRow] = await db
    .insert(keywords)
    .values({ keyword: kw, label: body.label ?? null, myShop: body.myShop ?? null })
    .onConflictDoUpdate({
      target: keywords.keyword,
      set: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.myShop !== undefined ? { myShop: body.myShop } : {}),
      },
    })
    .returning();

  const keywordId = kwRow.id;
  let snapshotCount = 0;

  // 2) ต่อแต่ละ item: upsert product แล้ว insert snapshot (insert เสมอ = เก็บ history)
  for (const item of body.items) {
    if (item.itemId == null || item.shopId == null) continue;

    const [prod] = await db
      .insert(products)
      .values({
        keywordId,
        itemId: item.itemId,
        shopId: item.shopId,
        shopName: item.shopName ?? null,
        title: item.title ?? null,
        imageUrl: item.imageUrl ?? null,
        productUrl: item.productUrl ?? null,
      })
      .onConflictDoUpdate({
        target: [products.keywordId, products.itemId, products.shopId],
        set: {
          shopName: item.shopName ?? null,
          title: item.title ?? null,
          imageUrl: item.imageUrl ?? null,
          productUrl: item.productUrl ?? null,
        },
      })
      .returning();

    await db.insert(snapshots).values({
      productId: prod.id,
      price: item.price != null ? String(item.price) : null,
      sold: item.sold ?? null,
      rating: item.rating != null ? String(item.rating) : null,
      ratingCount: item.ratingCount ?? null,
      isOfficial: item.isOfficial ?? null,
    });
    snapshotCount++;
  }

  return NextResponse.json({
    ok: true,
    keywordId,
    products: body.items.length,
    snapshots: snapshotCount,
  });
}
