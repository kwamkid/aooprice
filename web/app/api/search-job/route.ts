import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { checkIngestAuth } from "@/lib/auth";
import { withCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

export const OPTIONS = preflight;

const sql = neon(process.env.DATABASE_URL!);

// ค้นหา real-time (ad-hoc) — ดู [[cors-per-route-not-middleware]] + CLAUDE.md "ยิงสด = ผ่าน extension"
// POST       (no token, จาก browser)  : สร้าง job → { jobId }
// GET ?id=   (no token, จาก browser)  : เว็บ poll สถานะ/ผล → { status, result, error }
// GET ?claim=1 (token, จาก extension) : claim job pending เก่าสุดแบบ atomic → { job } | { job:null }

// POST /api/search-job  { keyword, platform? } → สร้าง job ใหม่
export async function POST(req: Request) {
  let body: { keyword?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid json" }, { status: 400 }));
  }
  const keyword = body.keyword?.trim();
  if (!keyword) {
    return withCors(NextResponse.json({ error: "keyword required" }, { status: 400 }));
  }
  const platform = body.platform?.trim() || "shopee";
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO search_jobs (id, keyword, platform, status)
    VALUES (${id}, ${keyword}, ${platform}, 'pending')
  `;
  return withCors(NextResponse.json({ jobId: id }));
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  // --- extension claim งาน (ต้องมี token) ---
  if (params.get("claim") === "1") {
    if (!checkIngestAuth(req)) {
      return withCors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }
    // atomic: หยิบ job pending เก่าสุด 1 อัน กัน extension หลายตัวชนกัน (SKIP LOCKED)
    const rows = await sql`
      UPDATE search_jobs SET status = 'running', claimed_at = now(), updated_at = now()
      WHERE id = (
        SELECT id FROM search_jobs WHERE status = 'pending'
        ORDER BY created_at ASC LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, keyword, platform
    `;
    const job = rows[0] ?? null;
    return withCors(NextResponse.json({ job }));
  }

  // --- เว็บ poll สถานะ job (ไม่ต้อง token) ---
  const id = params.get("id");
  if (!id) {
    return withCors(NextResponse.json({ error: "id or claim required" }, { status: 400 }));
  }
  const rows = await sql`
    SELECT id, keyword, platform, status, result, error
    FROM search_jobs WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return withCors(NextResponse.json({ error: "job not found" }, { status: 404 }));
  }
  return withCors(NextResponse.json({ job: rows[0] }));
}
