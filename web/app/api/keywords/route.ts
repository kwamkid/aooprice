import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { keywords } from "@/lib/schema";

export const runtime = "nodejs";

// GET /api/keywords — รายการ keyword ทั้งหมดที่ติดตาม
// ใช้ทั้งเว็บ (หน้า settings) และ extension (ดึง keyword list มาทำงาน)
export async function GET() {
  const rows = await db
    .select()
    .from(keywords)
    .orderBy(desc(keywords.createdAt));
  return NextResponse.json({ keywords: rows });
}

// POST /api/keywords — เพิ่ม/แก้ keyword
//   { keyword, label?, myShopShopee?, myShopTiktok?, myShopLazada? }  (myShop เดิม = shopee)
// upsert ตาม keyword (unique) — ถ้าไม่ส่งคอลัมน์ไหนจะคงค่าเดิมไว้
export async function POST(req: Request) {
  let body: {
    keyword?: string;
    label?: string;
    myShop?: string;
    myShopShopee?: string;
    myShopTiktok?: string;
    myShopLazada?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const kw = body.keyword?.trim();
  if (!kw) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const label = body.label?.trim() || kw;
  const norm = (v: string | undefined) => v?.trim() || null;
  const shopee = body.myShopShopee ?? body.myShop;

  // เซ็ตเฉพาะคอลัมน์ที่ "ส่งมา" เพื่อไม่ทับค่าเดิมโดยไม่ตั้งใจ
  const updateSet: {
    label: string;
    myShopShopee?: string | null;
    myShopTiktok?: string | null;
    myShopLazada?: string | null;
  } = { label };
  if (shopee !== undefined) updateSet.myShopShopee = norm(shopee);
  if (body.myShopTiktok !== undefined) updateSet.myShopTiktok = norm(body.myShopTiktok);
  if (body.myShopLazada !== undefined) updateSet.myShopLazada = norm(body.myShopLazada);

  const [row] = await db
    .insert(keywords)
    .values({
      keyword: kw,
      label,
      myShopShopee: norm(shopee),
      myShopTiktok: norm(body.myShopTiktok),
      myShopLazada: norm(body.myShopLazada),
    })
    .onConflictDoUpdate({ target: keywords.keyword, set: updateSet })
    .returning();

  return NextResponse.json({ keyword: row });
}

// PATCH /api/keywords — แก้ label ของ keyword ที่มีอยู่ { id, label }
export async function PATCH(req: Request) {
  let body: { id?: number; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const [row] = await db
    .update(keywords)
    .set({ label: body.label?.trim() || null })
    .where(eq(keywords.id, body.id))
    .returning();
  return NextResponse.json({ keyword: row });
}

// DELETE /api/keywords?id=123 — ลบ keyword (cascade ลบ products/snapshots)
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await db.delete(keywords).where(eq(keywords.id, id));
  return NextResponse.json({ ok: true });
}
