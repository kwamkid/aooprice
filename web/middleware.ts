import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CORS สำหรับ /api/* — extension รันจาก origin chrome-extension://... จึงเป็น cross-origin
// browser จะยิง preflight (OPTIONS) ก่อน ต้องตอบ Access-Control-* ไม่งั้นโดน block
// อนุญาตทุก origin (API ป้องกันด้วย INGEST_TOKEN/CRON_SECRET อยู่แล้ว ไม่ได้พึ่ง origin)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  // ตอบ preflight ทันที
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS });
  }
  // request จริง: แปะ CORS header ลงไปใน response
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
