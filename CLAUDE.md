# aooprice — Price Monitor (Shopee / TikTok Shop / Lazada)

ระบบเทียบราคา/ติดตามคู่แข่งบน **Shopee, TikTok Shop และ Lazada**: ดึงราคา/ยอดขาย/
เรตติ้งตาม keyword (keyword เดียวเห็นได้ทั้ง 3 platform) เก็บประวัติ (price history)
แสดง dashboard เทียบราคาข้าม platform + กราฟ + monitor รายวัน

Repo: https://github.com/kwamkid/aooprice · เจ้าของร้านขายบน Shopee/TikTok/Lazada

> 📘 **วิธีติดตั้ง + ใช้งานทีละขั้น** อยู่ที่ [SETUP.md](./SETUP.md)
> (setup Neon, รัน web, ติดตั้ง+ตั้งค่า extension, ดึงข้อมูลจริง, deploy Vercel, แก้ปัญหา)

---

## สถาปัตยกรรม (สำคัญ — อ่านก่อนแก้)

```
Chrome Extension (เครื่องผู้ใช้, session แต่ละ platform)
   ──ยิง internal API / อ่าน DOM──►  shopee.co.th · tiktok.com · lazada.co.th
        │  POST /api/ingest (+ Bearer INGEST_TOKEN, แต่ละ item มี field `platform`)
        ▼
Next.js + Neon (Vercel)  ──►  เก็บ snapshot ทุกครั้ง = price history (ไม่ overwrite)
        ▼
Dashboard (Next.js)  ──►  ตารางเทียบราคาข้าม platform (badge+filter) + กราฟย้อนหลัง
        ▼
Vercel Cron รายวัน (/api/cron/daily)  ──►  เช็คความสด + price delta
```

**เหตุผลที่ใช้ Chrome Extension (ไม่ scrape ฝั่ง server):** marketplace บล็อก IP
ของ cloud/datacenter (Vercel/VPS) ทันที. การดึงจากเบราว์เซอร์ผู้ใช้ที่ login
อยู่ = เว็บเห็นเป็นคนจริง + ใช้ IP บ้าน → ไม่โดนบล็อก. ดังนั้น:
- **การดึงข้อมูลจริงเกิดที่ extension เท่านั้น** (ต้องเปิดเบราว์เซอร์)
- backend แค่ "รับข้อมูล + เก็บ + แสดงผล" — ไม่เคยยิง marketplace เอง
- Vercel Cron ทำหน้าที่ "สรุป/เช็คความสด/แจ้งเตือน" ไม่ใช่ scraper

> ⚠️ **"ยิงสด / real-time" ในโปรเจกต์นี้ = ยิงผ่าน extension เสมอ ไม่ใช่ผ่าน server.**
> ห้ามทำ feature ที่ให้ Next.js/Vercel ยิง marketplace API เองเด็ดขาด (โดน
> บล็อก IP). flow "ค้นสด" ที่ถูกต้อง = เว็บตั้งคิว → extension (ที่เปิด Chrome
> ค้างไว้) poll เจอ → ยิง marketplace ให้ → ส่งผลกลับเข้า backend → เว็บแสดงผล.
> ถ้าไม่มี extension เปิดอยู่ = ค้นสดไม่ได้ (ไม่มี fallback ฝั่ง server).

**Multi-platform (Shopee / TikTok Shop / Lazada):**
- `keyword` **ไม่ผูกกับ platform** — keyword เดียวเก็บสินค้าได้ทุก platform; platform
  อยู่ที่ระดับ `products` (คอลัมน์ `platform`)
- `item_id`/`shop_id` เป็น **text** (รองรับ id ที่เป็น string ของ tiktok/lazada)
- **ชื่อร้านเราแยกต่อ platform** (`my_shop_shopee/tiktok/lazada`) เพราะชื่อร้าน
  มักไม่เหมือนกันข้าม marketplace
- Shopee ดึงผ่าน internal API; **TikTok/Lazada: ลอง internal API ก่อน → fallback DOM**
  (endpoint/selector ไม่เป็นทางการ อาจต้องปรับจากหน้าเว็บจริง)

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
    ├── manifest.json                 # hosts: shopee.co.th / *.tiktok.com / *.lazada.co.th
    ├── config.js                     # ค่า fix: BACKEND_URL / INGEST_TOKEN / MAX_ITEMS
    ├── lib/shopee-api.js             # fetchShopeeItems() ยิง /api/v4/search/search_items + map
    ├── lib/tiktok-api.js             # fetchTiktokItems() — ลอง API ก่อน → fallback DOM
    ├── lib/lazada-api.js             # fetchLazadaItems() — catalog JSON ก่อน → fallback DOM
    ├── content.js                    # detect platform จาก hostname → เลือก fetcher → ส่ง ingest
    ├── background.js                 # service worker: alarms + poll คิวเว็บ + วน platform×keyword
    ├── popup.html / popup.js         # toggle Auto + เลือก platform (checkbox) + ปุ่มดึงเดี๋ยวนี้
    └── icons/ (16/48/128 gen ด้วย Node)
```

> **หมายเหตุ:** keyword list + ชื่อร้านเรา จัดการที่หน้าเว็บ `/settings`
> (เก็บใน DB ผ่าน `/api/keywords`, `/api/settings`) — extension ดึงมาใช้ ไม่เก็บใน popup.
> ปุ่ม "ดึงเดี๋ยวนี้" บนเว็บ → `/api/scrape-request` (คิว) → extension poll มาทำ.
> fetcher ทุกตัว map ออกเป็น schema กลางเดียวกัน:
> `{ platform, itemId, shopId, shopName, title, imageUrl, productUrl, price, sold, rating, ratingCount, isOfficial }`

---

## Database Schema (Neon Postgres, ผ่าน Drizzle)

- **keywords** — `id, keyword(unique), label, my_shop(legacy),
  my_shop_shopee, my_shop_tiktok, my_shop_lazada, created_at`
  (ชื่อร้านเราแยกต่อ platform ไว้ไฮไลต์; `my_shop` เก่าเก็บไว้เผื่อ backward compat)
- **products** — `id, keyword_id→keywords, platform('shopee'|'tiktok'|'lazada'),
  item_id(text), shop_id(text), shop_name, title, image_url, product_url`
  · UNIQUE(keyword_id, **platform**, item_id, shop_id)
- **snapshots** — `id, product_id→products, price, sold, rating, rating_count,
  is_official, captured_at` · INDEX(product_id, captured_at DESC)
  **insert เสมอทุกครั้งที่ดึง = เก็บ history ไม่ทับ** (platform สืบทอดผ่าน product)
- **settings** — k-v: `my_shop_shopee/tiktok/lazada` (global ที่ extension อ่าน),
  `scrape_request` (คิวสั่งดึงจากเว็บ)

ราคา: extension แปลงเป็นบาทก่อนส่ง (Shopee `price/100000`; tiktok/lazada เช็คหน่วยใน fetcher).
"ราคาล่าสุดต่อ product" ใช้ `DISTINCT ON` / `JOIN LATERAL ... ORDER BY captured_at DESC LIMIT 1`.
`platform` เป็น `text` (ไม่ทำ enum) เพื่อเพิ่ม platform ใหม่ได้ง่าย.

---

## Extension: โหมดการทำงาน

- **MANUAL:** ปุ่ม "ดึงเดี๋ยวนี้" ใน popup / ปุ่มบนเว็บ (`/settings`) + ปุ่ม Rescan
  ลอยมุมขวาล่าง (ทำงานบนหน้า Shopee/TikTok/Lazada — label บอก platform ปัจจุบัน)
- **AUTO:** `chrome.alarms` ทุก N ชม. (ตั้งใน popup) — ดึงเมื่อ Chrome เปิดอยู่
- **เลือก platform ได้ใน popup** (checkbox Shopee/TikTok/Lazada → `storage.sync.platforms`)
- **background วนทุก platform ที่เปิด × ทุก keyword:** เปิดแท็บ background 1 แท็บ/platform
  → นำทางไปหน้า search ของแต่ละ keyword (`tabs.update`+รอโหลด) → สั่ง `SCRAPE_ONE`
  (สำคัญ: ต้องอยู่หน้า search จริง เพื่อให้ DOM fallback ของ tiktok/lazada ทำงาน)
- **catch-up:** ถ้าพลาดรอบเพราะปิดเครื่อง → ดึงชดเชยตอน `onStartup`
- content.js: `detectPlatform()` จาก hostname → import fetcher ที่ตรง; ส่ง `platform`
  + ชื่อร้านเรา 3 ช่อง เข้า ingest. โค้ดดึงตัวเดียวกันทั้ง auto/manual
- การสื่อสาร: popup→background (`RUN_NOW`/`SYNC_ALARM`), background→content (`SCRAPE_ONE`);
  `SCRAPE_ALL` ยังมีไว้ใช้กับปุ่ม Rescan (ดึงทุก keyword ในหน้าเดียว)

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

## Progress (ล่าสุด: 2026-06-10)

### เสร็จแล้ว ✅
- [x] โครง Next.js 15 + Tailwind + Drizzle + Neon (typecheck + build ผ่าน)
- [x] Schema + migration push ขึ้น Neon แล้ว
- [x] API ครบ: ingest / keywords / compare / history / cron/daily / settings / scrape-request
- [x] Dashboard: หน้าแรก (การ์ด keyword) + หน้าเทียบราคา (ตาราง + ไฮไลต์ร้านเรา + กราฟ)
- [x] Vercel cron config (รายวัน 9 โมง) + auth ป้องกันด้วย CRON_SECRET
- [x] **Multi-platform: รองรับ Shopee + TikTok Shop + Lazada** (2026-06-10)
  - schema เพิ่มคอลัมน์ `platform`, `item_id`/`shop_id` เป็น text, unique key รวม platform,
    `keywords` เพิ่มชื่อร้านเราแยก 3 ช่อง
  - ingest/compare/keywords/settings รองรับ platform + ชื่อร้านเราต่อ platform
  - dashboard: badge platform + filter ในตาราง + platform breakdown บนการ์ด
  - หน้า `/settings`: ช่องชื่อร้าน 3 platform
  - extension: manifest 3 hosts, `tiktok-api.js`/`lazada-api.js` (API ก่อน→DOM fallback),
    content.js detect platform, background วน platform×keyword, popup เลือก platform
  - **ทดสอบ localhost ingest+compare หลาย platform ผ่าน** (string id round-trip,
    isMine ต่อ platform ถูก, auth 401, build ผ่าน) + reseed ข้อมูลตัวอย่างหลาย platform
- [x] push ขึ้น GitHub (main)

### ยังไม่ได้ทำ / ขั้นต่อไป 🔜
- [ ] **ทดสอบ extension กับเว็บจริงทั้ง 3 platform** — ยังไม่ได้ลองดึงจริง
  - Shopee: ยังไม่ได้ยิง search_items จริง (อาจติด captcha/anti-bot)
  - **TikTok/Lazada: endpoint internal API + DOM selector เป็น best-guess — ต้อง verify
    กับหน้าเว็บจริง แล้วปรับ `tiktok-api.js`/`lazada-api.js`** (TikTok มักต้อง signature
    จึงน่าจะพึ่ง DOM fallback เป็นหลัก; Lazada catalog JSON น่าจะใช้ได้ตรงกว่า)
- [ ] Deploy web ขึ้น Vercel + ตั้ง env 3 ตัว (DATABASE_URL/INGEST_TOKEN/CRON_SECRET)
- [ ] ระบบแจ้งเตือนจริง (ตอนนี้ cron แค่คืน summary) — แผน: LINE Notify / อีเมล
- [ ] UI: sort/filter เพิ่ม, กราฟยอดขาย, flag คู่แข่งลดราคาบน dashboard

### Known issues / ข้อควรรู้
- internal API ทั้ง 3 platform ไม่เป็นทางการ — header/endpoint/selector อาจเปลี่ยน
- TikTok Shop search API ต้อง signature (msToken/X-Bogus) → ใน content script มักต้อง
  พึ่ง DOM fallback; ต้องอยู่หน้า search จริง (background พาไปให้)
- fetcher (shopee/tiktok/lazada-api.js) ใช้ ES module → ต้องอยู่ใน `web_accessible_resources` (จัดการแล้ว)
- ราคาแต่ละ platform หน่วยอาจต่างกัน — แปลงเป็นบาทใน fetcher (เช็คหน่วยจริงตอน verify)
- การดึงต้องเปิดเบราว์เซอร์ — ไม่ใช่ scrape ฝั่ง server 24/7
- อยู่ในพื้นที่สีเทาของ ToS แต่ละ marketplace — ใช้ความถี่ต่ำ
