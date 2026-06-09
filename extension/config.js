// ค่าตั้งค่าแบบ fix ของ extension — ตั้งทีเดียว ไม่ต้องกรอกใน popup
// แก้ที่นี่ที่เดียวถ้าเปลี่ยน backend หรือ rotate token
//
// BACKEND_URL: ตอน deploy ใช้ URL Vercel / ตอน dev ใช้ http://localhost:3000
// INGEST_TOKEN: ต้องตรงกับ INGEST_TOKEN ใน web/.env (Vercel env)

export const CONFIG = {
  // 👉 ตอนเทสบนเครื่อง สลับเป็น "http://localhost:3000"
  BACKEND_URL: "https://aooprice.vercel.app",
  INGEST_TOKEN: "4442271b18efd8bb07e0e2de8287c70a26e1a501de860397",

  // ระยะ poll หา "คิวสั่งดึงจากเว็บ" (วินาที) — เว็บกดปุ่มแล้ว extension จะเห็นภายในไม่เกินนี้
  POLL_SECONDS: 30,

  // จำนวนสินค้าสูงสุดต่อ keyword
  MAX_ITEMS: 60,
};

// helper: ตัด trailing slash ออกจาก backend url
export function apiBase() {
  return CONFIG.BACKEND_URL.replace(/\/$/, "");
}
