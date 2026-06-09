// ตรวจ Bearer token สำหรับ endpoint ที่ extension เรียก (/api/ingest)
export function checkIngestAuth(req: Request): boolean {
  const token = process.env.INGEST_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${token}`;
}

// ตรวจ secret สำหรับ Vercel Cron (/api/cron/*)
export function checkCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}
