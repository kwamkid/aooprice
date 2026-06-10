import { NextResponse } from "next/server";

// CORS สำหรับ API ที่ extension เรียก (extension อยู่ origin chrome-extension://...)
// อนุญาตทุก origin — API ป้องกันด้วย INGEST_TOKEN/CRON_SECRET อยู่แล้ว ไม่พึ่ง origin
// ทำใน route handler ตรง ๆ (ไม่ใช้ middleware — เสถียรกว่าบน Vercel)
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// แปะ CORS header ลง response ที่มีอยู่ แล้วคืนตัวเดิม
export function withCors<T extends NextResponse>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

// ตอบ preflight OPTIONS — ใส่เป็น export const OPTIONS = preflight ในแต่ละ route
export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
