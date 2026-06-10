import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { checkIngestAuth } from "@/lib/auth";
import { withCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

export const OPTIONS = preflight;

const sql = neon(process.env.DATABASE_URL!);

// POST /api/search-job/result (token) — extension ส่งผลค้นสดกลับ
//   { jobId, items: [...] }  → set result + status=done
//   { jobId, error: "..." }  → status=error
export async function POST(req: Request) {
  if (!checkIngestAuth(req)) {
    return withCors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }
  let body: { jobId?: string; items?: unknown[]; error?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid json" }, { status: 400 }));
  }
  const jobId = body.jobId?.trim();
  if (!jobId) {
    return withCors(NextResponse.json({ error: "jobId required" }, { status: 400 }));
  }

  if (body.error) {
    await sql`
      UPDATE search_jobs SET status = 'error', error = ${body.error}, updated_at = now()
      WHERE id = ${jobId}
    `;
    return withCors(NextResponse.json({ ok: true }));
  }

  const items = Array.isArray(body.items) ? body.items : [];
  await sql`
    UPDATE search_jobs
    SET status = 'done', result = ${JSON.stringify(items)}::jsonb, error = NULL, updated_at = now()
    WHERE id = ${jobId}
  `;
  return withCors(NextResponse.json({ ok: true, count: items.length }));
}
