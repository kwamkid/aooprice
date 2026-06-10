import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { checkIngestAuth } from "@/lib/auth";
import { withCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

export const OPTIONS = preflight;

// คิวสั่งดึงแบบง่ายผ่าน DB (เว็บสั่ง → extension poll มาทำ)
// เก็บใน settings key "scrape_request" = ISO timestamp ตอนกดปุ่ม, ว่าง = ไม่มีคิว

// POST /api/scrape-request — เว็บกดปุ่ม "ดึงเดี๋ยวนี้" → ตั้ง flag
// (เรียกจาก browser เดียวกับเว็บ ไม่ต้องใช้ token)
export async function POST() {
  const now = new Date().toISOString();
  await setSetting("scrape_request", now);
  return withCors(NextResponse.json({ ok: true, requestedAt: now }));
}

// GET /api/scrape-request — extension poll มาเช็คว่ามีคิวค้างไหม (ต้องมี token)
//   ?consume=1 → ถ้ามีคิวจะเคลียร์ทิ้งเลย (กันดึงซ้ำ) แล้วคืน pending:true
export async function GET(req: Request) {
  if (!checkIngestAuth(req)) {
    return withCors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }
  const requestedAt = await getSetting("scrape_request");
  const pending = !!requestedAt;
  const consume = new URL(req.url).searchParams.get("consume") === "1";
  if (pending && consume) {
    await setSetting("scrape_request", null);
  }
  return withCors(NextResponse.json({ pending, requestedAt }));
}
