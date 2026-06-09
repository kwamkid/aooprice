import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { keywords, products, snapshots } from "@/lib/schema";
import { checkIngestAuth } from "@/lib/auth";

export const runtime = "nodejs";

type Platform = "shopee" | "tiktok" | "lazada";
const PLATFORMS: Platform[] = ["shopee", "tiktok", "lazada"];
function normPlatform(p: unknown): Platform {
  return PLATFORMS.includes(p as Platform) ? (p as Platform) : "shopee";
}

// รูปร่างข้อมูลที่ extension ส่งมาต่อ 1 รายการสินค้า
type IngestItem = {
  platform?: string | null; // shopee | tiktok | lazada (default shopee)
  itemId: string | number;
  shopId: string | number;
  shopName?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  price?: number | null; // บาท (extension แปลงเป็นบาทมาแล้ว)
  sold?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  isOfficial?: boolean | null;
};

type IngestBody = {
  keyword: string;
  label?: string | null;
  myShop?: string | null; // legacy
  myShopShopee?: string | null;
  myShopTiktok?: string | null;
  myShopLazada?: string | null;
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

  // 1) upsert keyword (สร้างถ้ายังไม่มี, อัพเดต label / ชื่อร้านเราต่อ platform ถ้าส่งมา)
  const [kwRow] = await db
    .insert(keywords)
    .values({
      keyword: kw,
      label: body.label ?? null,
      myShop: body.myShop ?? null,
      myShopShopee: body.myShopShopee ?? null,
      myShopTiktok: body.myShopTiktok ?? null,
      myShopLazada: body.myShopLazada ?? null,
    })
    .onConflictDoUpdate({
      target: keywords.keyword,
      set: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.myShop !== undefined ? { myShop: body.myShop } : {}),
        ...(body.myShopShopee !== undefined ? { myShopShopee: body.myShopShopee } : {}),
        ...(body.myShopTiktok !== undefined ? { myShopTiktok: body.myShopTiktok } : {}),
        ...(body.myShopLazada !== undefined ? { myShopLazada: body.myShopLazada } : {}),
      },
    })
    .returning();

  const keywordId = kwRow.id;
  let snapshotCount = 0;

  // 2) ต่อแต่ละ item: upsert product แล้ว insert snapshot (insert เสมอ = เก็บ history)
  for (const item of body.items) {
    if (item.itemId == null || item.shopId == null) continue;

    const platform = normPlatform(item.platform);
    const [prod] = await db
      .insert(products)
      .values({
        keywordId,
        platform,
        itemId: String(item.itemId),
        shopId: String(item.shopId),
        shopName: item.shopName ?? null,
        title: item.title ?? null,
        imageUrl: item.imageUrl ?? null,
        productUrl: item.productUrl ?? null,
      })
      .onConflictDoUpdate({
        target: [
          products.keywordId,
          products.platform,
          products.itemId,
          products.shopId,
        ],
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
