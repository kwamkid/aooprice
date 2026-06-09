# aooprice — Shopee Price Monitor

ระบบเทียบราคา/ติดตามคู่แข่งบน Shopee: ดึงราคา/ยอดขาย/เรตติ้งตาม keyword
เก็บประวัติ (price history) แสดง dashboard เทียบราคา + กราฟ + monitor รายวัน

Repo: https://github.com/kwamkid/aooprice · เจ้าของร้านขายบน Shopee

> 📘 **วิธีติดตั้ง + ใช้งานทีละขั้น** อยู่ที่ [SETUP.md](./SETUP.md)
> (setup Neon, รัน web, ติดตั้ง+ตั้งค่า extension, ดึงข้อมูลจริง, deploy Vercel, แก้ปัญหา)

---

## สถาปัตยกรรม (สำคัญ — อ่านก่อนแก้)

```
Chrome Extension (เครื่องผู้ใช้, session Shopee)  ──ยิง internal API──►  shopee.co.th
        │  POST /api/ingest (+ Bearer INGEST_TOKEN)
        ▼
Next.js + Neon (Vercel)  ──►  เก็บ snapshot ทุกครั้ง = price history (ไม่ overwrite)
        ▼
Dashboard (Next.js)  ──►  ตารางเทียบราคา + กราฟย้อนหลัง (recharts)
        ▼
Vercel Cron รายวัน (/api/cron/daily)  ──►  เช็คความสด + price delta
```

**เหตุผลที่ใช้ Chrome Extension (ไม่ scrape ฝั่ง server):** Shopee บล็อก IP
ของ cloud/datacenter (Vercel/VPS) ทันที. การดึงจากเบราว์เซอร์ผู้ใช้ที่ login
อยู่ = Shopee เห็นเป็นคนจริง + ใช้ IP บ้าน → ไม่โดนบล็อก. ดังนั้น:
- **การดึงข้อมูลจริงเกิดที่ extension เท่านั้น** (ต้องเปิดเบราว์เซอร์)
- backend แค่ "รับข้อมูล + เก็บ + แสดงผล" — ไม่เคยยิง Shopee เอง
- Vercel Cron ทำหน้าที่ "สรุป/เช็คความสด/แจ้งเตือน" ไม่ใช่ scraper

---

## โครงสร้างโปรเจกต์

```
aooprice/
├── web/                          # Next.js 15 App Router + Drizzle + Neon (deploy Vercel)
│   ├── app/
│   │   ├── api/ingest/route.ts        # รับข้อมูลจาก extension (auth: INGEST_TOKEN)
│   │   ├── api/keywords/route.ts      # GET list / POST add / DELETE keyword
│   │   ├── api/compare/route.ts       # snapshot ล่าสุดต่อ product เรียงราคา + มาร์คร้านเรา
│   │   ├── api/history/route.ts       # timeseries ราคารายวันไว้ทำกราฟ
│   │   ├── api/cron/daily/route.ts    # Vercel cron (auth: CRON_SECRET)
│   │   ├── page.tsx                   # หน้าแรก: การ์ด keyword
│   │   ├── k/[id]/page.tsx            # หน้าเทียบราคาราย keyword + กราฟ
│   │   └── layout.tsx, globals.css
│   ├── components/PriceChart.tsx      # client component (recharts) ดึง /api/history
│   ├── lib/schema.ts                  # Drizzle schema (keywords/products/snapshots)
│   ├── lib/db.ts                      # neon-http drizzle client
│   ├── lib/auth.ts                    # checkIngestAuth / checkCronAuth (Bearer)
│   ├── scripts/seed.ts               # ข้อมูลตัวอย่าง (npm run db:seed)
│   ├── drizzle.config.ts, vercel.json (cron 0 9 * * *)
│   └── .env (gitignored), .env.example
└── extension/                    # Chrome Extension MV3 (โหลด unpacked, ไม่มี build step)
    ├── manifest.json                 # host: shopee.co.th, permissions: alarms/storage/scripting/tabs
    ├── lib/shopee-api.js             # fetchShopeeItems() ยิง /api/v4/search/search_items + map
    ├── content.js                    # รันบน shopee.co.th: ดึง+ส่ง+ปุ่ม Rescan ลอย
    ├── background.js                 # service worker: chrome.alarms (auto) + catch-up + เปิดแท็บ
    ├── popup.html / popup.js         # ตั้งค่า backend URL/token/keywords/auto interval
    └── icons/ (16/48/128 สีส้ม gen ด้วย Node)
```

---

## Database Schema (Neon Postgres, ผ่าน Drizzle)

- **keywords** — `id, keyword(unique), label, my_shop, created_at`
  (`my_shop` = ชื่อร้านเราไว้ไฮไลต์)
- **products** — `id, keyword_id→keywords, item_id, shop_id, shop_name, title,
  image_url, product_url` · UNIQUE(keyword_id, item_id, shop_id)
- **snapshots** — `id, product_id→products, price, sold, rating, rating_count,
  is_official, captured_at` · INDEX(product_id, captured_at DESC)
  **insert เสมอทุกครั้งที่ดึง = เก็บ history ไม่ทับ**

ราคา: extension แปลงจาก Shopee (`price/100000`) เป็นบาทก่อนส่ง.
"ราคาล่าสุดต่อ product" ใช้ `DISTINCT ON` / `JOIN LATERAL ... ORDER BY captured_at DESC LIMIT 1`.

---

## Extension: โหมดการทำงาน

- **MANUAL:** ปุ่ม "ดึงเดี๋ยวนี้" ใน popup + ปุ่ม Rescan ลอยมุมขวาล่างบนหน้า Shopee
- **AUTO:** `chrome.alarms` ทุก N ชม. (ตั้งใน popup) — ดึงเมื่อ Chrome เปิดอยู่
  - background หาแท็บ shopee.co.th ที่เปิดอยู่ ถ้าไม่มีจะเปิดแท็บ background เอง
  - **catch-up:** ถ้าพลาดรอบเพราะปิดเครื่อง → ดึงชดเชยตอน `onStartup`
    (เทียบ `lastRunAt` ใน chrome.storage.local กับ interval)
- โค้ดดึงตัวเดียวกัน (`scrapeKeyword` ใน content.js) ทั้ง auto/manual
- การสื่อสาร: popup→background (`RUN_NOW`/`SYNC_ALARM`), background→content (`SCRAPE_ALL`)

---

## ENV (web/.env — gitignored)

- `DATABASE_URL` — Neon (project region ap-southeast-1/Singapore)
- `INGEST_TOKEN` — Bearer ที่ extension ต้องส่งใน /api/ingest (ต้องตรงกับใน popup)
- `CRON_SECRET` — Vercel ส่งเป็น `Authorization: Bearer` ให้ /api/cron/daily

> token ถูก generate แบบสุ่ม (crypto.randomBytes) ตอน setup. ดูค่าจริงใน web/.env

---

## คำสั่งที่ใช้บ่อย

```bash
cd web
npm run dev          # localhost:3000
npm run db:push      # apply schema -> Neon (drizzle-kit push)
npm run db:seed      # ใส่ข้อมูลตัวอย่าง GB Pockit+ / Stokke YOYO3
npm run build        # production build
```

Extension: `chrome://extensions` → Developer mode → Load unpacked → เลือก `extension/`

> ขั้นตอนละเอียด (ตั้งค่า popup, ดึงข้อมูลจริง, deploy, แก้ปัญหา) → ดู [SETUP.md](./SETUP.md)

---

## Progress (ล่าสุด: 2026-06-09)

### เสร็จแล้ว ✅
- [x] โครง Next.js 15 + Tailwind + Drizzle + Neon (typecheck + build ผ่าน)
- [x] Schema + migration push ขึ้น Neon แล้ว (ตารางสร้างจริง)
- [x] API ครบ: ingest / keywords / compare / history / cron/daily
- [x] Dashboard: หน้าแรก (การ์ด keyword) + หน้าเทียบราคา (ตาราง + ไฮไลต์ร้านเรา + กราฟ)
- [x] Chrome Extension ครบ: manifest, shopee-api, content, background (auto+manual), popup, icons
- [x] Vercel cron config (รายวัน 9 โมง) + auth ป้องกันด้วย CRON_SECRET
- [x] seed ข้อมูลตัวอย่าง 2 keyword × 5 ร้าน × 7 วัน
- [x] **ทดสอบ localhost ผ่านครบทุก endpoint** (compare เรียงราคา, history 35 จุด,
      ingest auth 401, ingest สร้างข้อมูลได้, cron คำนวณ price delta ได้)
- [x] push ขึ้น GitHub (main)

### ยังไม่ได้ทำ / ขั้นต่อไป 🔜
- [ ] **ทดสอบ extension กับ Shopee จริง** — ยังไม่ได้ลองยิง search_items จริง
      ความเสี่ยง: อาจติด captcha/anti-bot, shop_name อาจไม่มาใน search API
      (มี fallback อ่าน DOM เป็นแผนสำรองถ้าจำเป็น)
- [ ] Deploy web ขึ้น Vercel + ตั้ง env 3 ตัว (DATABASE_URL/INGEST_TOKEN/CRON_SECRET)
- [ ] ระบบแจ้งเตือนจริง (ตอนนี้ cron แค่คืน summary) — แผน: LINE Notify / อีเมล
      เมื่อคู่แข่งลดราคา. ต่อยอดที่ app/api/cron/daily/route.ts (มี TODO มาร์คไว้)
- [ ] UI: sort/filter ในตาราง, กราฟยอดขาย, แสดง flag คู่แข่งลดราคาบน dashboard

### Known issues / ข้อควรรู้
- Shopee internal API ไม่เป็นทางการ — header/endpoint อาจเปลี่ยน
- `shopee-api.js` ใช้ ES module → ต้องอยู่ใน `web_accessible_resources` (จัดการแล้ว)
- การดึงต้องเปิดเบราว์เซอร์ — ไม่ใช่ scrape ฝั่ง server 24/7
- อยู่ในพื้นที่สีเทาของ Shopee ToS — ใช้ความถี่ต่ำ
