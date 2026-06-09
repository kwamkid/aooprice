import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { keywords } from "@/lib/schema";

export const runtime = "nodejs";

// GET /api/keywords — รายการ keyword ทั้งหมดที่ติดตาม
export async function GET() {
  const rows = await db
    .select()
    .from(keywords)
    .orderBy(desc(keywords.createdAt));
  return NextResponse.json({ keywords: rows });
}

// POST /api/keywords — เพิ่ม keyword ใหม่ { keyword, label?, myShop? }
export async function POST(req: Request) {
  let body: { keyword?: string; label?: string; myShop?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const kw = body.keyword?.trim();
  if (!kw) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const [row] = await db
    .insert(keywords)
    .values({ keyword: kw, label: body.label ?? null, myShop: body.myShop ?? null })
    .onConflictDoUpdate({
      target: keywords.keyword,
      set: { label: body.label ?? null, myShop: body.myShop ?? null },
    })
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
