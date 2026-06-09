# aooprice

ระบบเทียบราคา/ติดตามคู่แข่งบน Shopee — ดึงราคา/ยอดขาย/เรตติ้งตาม keyword
แล้วเก็บประวัติ + แสดง dashboard เทียบราคา พร้อม monitor รายวัน

## สถาปัตยกรรม

```
Chrome Extension (เครื่องคุณ, session Shopee)  →  ยิง internal search API
        │  POST /api/ingest (+ Bearer token)
        ▼
Next.js + Neon (Vercel)  →  เก็บ snapshot ทุกครั้ง = price history
        ▼
Dashboard  →  ตารางเทียบราคา + กราฟย้อนหลัง
        ▼
Vercel Cron (รายวัน)  →  เช็คความสด + price delta + แจ้งเตือน
```

**ทำไมใช้ Extension:** Shopee บล็อก IP ของ cloud/datacenter → ดึงจาก
เบราว์เซอร์ผู้ใช้ที่ login อยู่ = Shopee เห็นเป็นคนจริง ไม่โดนบล็อก

## โครงสร้าง

- `web/` — Next.js 15 (App Router) + Drizzle + Neon, deploy บน Vercel
- `extension/` — Chrome Extension (Manifest V3), โหลด unpacked

## ติดตั้ง — Web (backend + dashboard)

```bash
cd web
npm install
cp .env.example .env        # ใส่ DATABASE_URL (Neon), INGEST_TOKEN, CRON_SECRET
npm run db:push             # สร้างตารางใน Neon
npm run db:seed             # (ทางเลือก) ใส่ข้อมูลตัวอย่างไว้ดู dashboard
npm run dev                 # http://localhost:3000
```

Deploy: push ขึ้น GitHub แล้วต่อกับ Vercel — ตั้ง env vars 3 ตัวใน Vercel
(`DATABASE_URL`, `INGEST_TOKEN`, `CRON_SECRET`). Cron รายวันตั้งใน `web/vercel.json` แล้ว

## ติดตั้ง — Extension

1. เปิด `chrome://extensions` → เปิด **Developer mode**
2. **Load unpacked** → เลือกโฟลเดอร์ `extension/`
3. คลิกไอคอน aooprice → ตั้งค่า:
   - **Backend URL**: เช่น `https://aooprice.vercel.app` (หรือ `http://localhost:3000` ตอนเทส)
   - **Ingest Token**: ค่าเดียวกับ `INGEST_TOKEN` ใน .env
   - **ชื่อร้านเรา**: ไว้ไฮไลต์ในตาราง
   - **Keywords**: ใส่บรรทัดละ 1 คำ
   - เปิด **Auto** + ตั้งช่วงเวลา (ชม.) ถ้าต้องการดึงอัตโนมัติ
4. กด **บันทึก** แล้วกด **⟳ ดึงเดี๋ยวนี้** เพื่อทดสอบ (หรือกดปุ่ม Rescan ลอยบนหน้า Shopee)

## โหมดการทำงาน

- **Manual:** ปุ่ม "ดึงเดี๋ยวนี้" ใน popup / ปุ่ม Rescan ลอยบนหน้า Shopee
- **Auto:** `chrome.alarms` ตามช่วงเวลาที่ตั้ง — ดึงเมื่อ Chrome เปิดอยู่,
  มีระบบดึงชดเชยถ้าพลาดรอบเพราะปิดเครื่อง

## ข้อจำกัด / ความเสี่ยง

- Shopee internal API ไม่เป็นทางการ — header/endpoint อาจเปลี่ยน
- อาจติด captcha/anti-bot ได้แม้ใช้ session จริง (เผื่อ fallback อ่าน DOM ในอนาคต)
- การดึงต้องเปิดเบราว์เซอร์ — ไม่ใช่ scrape ฝั่ง server 24/7
- อยู่ในพื้นที่สีเทาของ Shopee ToS — ใช้ความถี่ต่ำ รับความเสี่ยงเอง
