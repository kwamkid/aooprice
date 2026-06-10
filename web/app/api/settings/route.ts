import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { withCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

export const OPTIONS = preflight;

// GET /api/settings — ค่าตั้งค่ารวม: ชื่อร้านเราแยกต่อ platform
// ใช้ทั้งฝั่งเว็บ (โหลดฟอร์ม) และ extension (รู้ชื่อร้านเราตอนส่ง ingest)
// myShop (legacy) = ชื่อร้าน shopee เพื่อ backward compat
export async function GET() {
  const [shopee, tiktok, lazada, legacy] = await Promise.all([
    getSetting("my_shop_shopee"),
    getSetting("my_shop_tiktok"),
    getSetting("my_shop_lazada"),
    getSetting("my_shop"),
  ]);
  const myShopShopee = shopee ?? legacy ?? null;
  return withCors(NextResponse.json({
    myShopShopee,
    myShopTiktok: tiktok ?? null,
    myShopLazada: lazada ?? null,
    myShop: myShopShopee, // legacy alias
  }));
}

// POST /api/settings — บันทึก { myShopShopee?, myShopTiktok?, myShopLazada? }
// (รับ myShop เดิมได้ด้วย → ลงช่อง shopee)
export async function POST(req: Request) {
  let body: {
    myShop?: string | null;
    myShopShopee?: string | null;
    myShopTiktok?: string | null;
    myShopLazada?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid json" }, { status: 400 }));
  }
  const norm = (v: string | null | undefined) => v?.trim() || null;
  const shopee = norm(body.myShopShopee ?? body.myShop);
  const tiktok = norm(body.myShopTiktok);
  const lazada = norm(body.myShopLazada);
  await Promise.all([
    setSetting("my_shop_shopee", shopee),
    setSetting("my_shop_tiktok", tiktok),
    setSetting("my_shop_lazada", lazada),
  ]);
  return withCors(NextResponse.json({
    myShopShopee: shopee,
    myShopTiktok: tiktok,
    myShopLazada: lazada,
    myShop: shopee,
  }));
}
