# aooprice — คู่มือการใช้งาน (SETUP)

คู่มือ setup + ใช้งานแบบทีละขั้น ตั้งแต่ติดตั้งจนถึงดึงข้อมูลจริง
(รองรับ **Shopee / TikTok Shop / Lazada** — keyword เดียวเทียบได้ทั้ง 3 platform)

---

## ภาพรวม 3 ส่วน

1. **web/** — เว็บ dashboard + API (รันบนเครื่อง หรือ deploy Vercel)
2. **Neon** — ฐานข้อมูล Postgres (cloud)
3. **extension/** — Chrome Extension ที่ดึงข้อมูลจาก Shopee / TikTok Shop / Lazada แล้วส่งเข้า web

> ลำดับที่ต้องทำ: ตั้ง Neon → รัน web → ติดตั้ง extension → ตั้งค่า → ดึงข้อมูล

---

## STEP 1 — ฐานข้อมูล Neon

> ทำครั้งเดียว (ทำไปแล้วถ้า setup โดย Claude — ข้ามได้ถ้ามี `web/.env` แล้ว)

1. ไป https://console.neon.tech → **New Project** → region **Singapore (ap-southeast-1)**
2. copy **Connection string** (`postgresql://...@ep-xxx.../neondb?sslmode=require`)
3. สร้างไฟล์ `web/.env`:
   ```
   DATABASE_URL="<connection string จาก Neon>"
   INGEST_TOKEN="<สุ่มยาว ๆ เช่น 48 ตัว>"
   CRON_SECRET="<สุ่มอีกตัว>"
   ```
   > สุ่ม token: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

---

## STEP 2 — รัน Web (localhost)

```bash
cd web
npm install          # ครั้งแรกครั้งเดียว
npm run db:push      # สร้างตารางใน Neon (ครั้งแรก / เมื่อแก้ schema)
npm run db:seed      # (ทางเลือก) ใส่ข้อมูลตัวอย่างไว้ดูหน้าตา
npm run dev          # เปิด http://localhost:3000
```

เปิดเบราว์เซอร์ไปที่ **http://localhost:3000** → ควรเห็นการ์ด keyword
(ถ้า seed แล้วจะเห็น GB Pockit+ / Stokke YOYO3)

**ถ้าหน้าแดง "เชื่อมต่อฐานข้อมูลไม่ได้":** ตรวจ `DATABASE_URL` ใน `.env`
แล้วรัน `npm run db:push` ใหม่

---

## STEP 3 — ติดตั้ง Chrome Extension

1. เปิด Chrome → พิมพ์ `chrome://extensions` ที่ช่อง URL
2. เปิดสวิตช์ **Developer mode** (มุมขวาบน)
3. กด **Load unpacked** → เลือกโฟลเดอร์ `aooprice/extension`
4. จะเห็นไอคอน aooprice (สีส้ม) โผล่ในแถบ extension — กด pin ไว้จะสะดวก

---

## STEP 4 — ตั้งค่า

Backend URL / Token เป็นค่า **fix ใน `extension/config.js`** (แก้ที่ไฟล์นี้ที่เดียว
ถ้าเปลี่ยน backend หรือ rotate token) — ไม่ต้องกรอกใน popup.

> 🔑 ค่าเริ่มต้น: `BACKEND_URL = "https://aooprice.vercel.app"` (ตอนเทส localhost
> สลับเป็น `http://localhost:3000`), `INGEST_TOKEN` ตรงกับ `web/.env`

**4.1 keyword + ชื่อร้านเรา → ตั้งที่หน้าเว็บ** `http://localhost:3000/settings`
- เพิ่ม **keyword** ที่อยากติดตาม (ใช้ร่วมกันทุก platform)
- กรอก **ชื่อร้านของเรา แยก 3 ช่อง**: Shopee / TikTok Shop / Lazada
  (ชื่อร้านแต่ละ platform มักไม่เหมือนกัน — ไว้ไฮไลต์ "ร้านเรา" ในตาราง) → กดบันทึก

**4.2 ใน popup ของ extension**
- ติ๊ก **platform ที่จะดึง** (Shopee / TikTok / Lazada — ดึงครบทุกตัวเป็น default)
- (ทางเลือก) เปิด **Auto** + ตั้งช่วงชั่วโมง → กด **บันทึก Auto**

---

## STEP 5 — ดึงข้อมูลจริง (Shopee / TikTok / Lazada)

### วิธี A — Manual (กดเอง)
1. **login** ให้เรียบร้อยในเว็บ platform ที่จะดึง (shopee.co.th / tiktok.com / lazada.co.th)
2. **วิธีที่ 1:** คลิกไอคอน aooprice → กด **⟳ ดึงเดี๋ยวนี้ (ทุก keyword)**
   - background จะวนทุก platform ที่ติ๊กไว้ × ทุก keyword: เปิดแท็บ search ให้เอง
     ทีละคำ แล้วดึง (TikTok/Lazada พึ่งหน้า search จริง จึงต้องให้เปิดแท็บ)
3. **วิธีที่ 2:** ไปหน้า search ของ keyword นั้นบน platform ไหนก็ได้ →
   กดปุ่ม **⟳ aooprice (ชื่อ platform)** มุมขวาล่าง (จะดึงเฉพาะ platform หน้านั้น)
4. หรือกดปุ่ม **"ดึงเดี๋ยวนี้"** บนหน้าเว็บ `/settings` → extension ที่เปิดอยู่จะมารับคิวไปทำ
5. กลับมาดูที่ dashboard → ข้อมูลควรเข้าตาราง (มี badge platform + filter)

### วิธี B — Auto (ตั้งเวลา)
- ติ๊ก "เปิด Auto" + ตั้งชั่วโมงใน popup → extension จะดึงเองตามรอบ
- **เงื่อนไข:** Chrome ต้องเปิดอยู่ตอนถึงรอบ
- ถ้าปิดเครื่องแล้วพลาดรอบ → จะดึงชดเชยให้ตอนเปิด Chrome ครั้งถัดไป
- 💡 อยากให้รันเองจริง ๆ: เปิด Chrome ทิ้งไว้บนเครื่องที่เปิดตลอด (เช่น Mini PC)

---

## STEP 6 (ทางเลือก) — Deploy ขึ้น Vercel

1. ต่อ repo `kwamkid/aooprice` กับ Vercel → ตั้ง **Root Directory = `web`**
2. ใส่ Environment Variables 3 ตัว: `DATABASE_URL`, `INGEST_TOKEN`, `CRON_SECRET`
3. Deploy → ได้ URL เช่น `https://aooprice.vercel.app`
4. กลับไปแก้ **Backend URL** ใน extension popup เป็น URL Vercel
5. Cron รายวัน (9 โมงเช้า) ทำงานเองตาม `web/vercel.json`

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|-------|----------------|
| "ไม่พบสินค้า (อาจโดน anti-bot)" | ยังไม่ login / โดนบล็อก / อยู่ผิดหน้า — login ใหม่, เปิดหน้า search ของ platform นั้นค้างไว้, ลดความถี่ |
| ingest 401 | `INGEST_TOKEN` ใน `extension/config.js` ไม่ตรงกับใน `web/.env` |
| ตารางไม่มีข้อมูลหลังดึง | เปิด console ของแท็บ platform (F12) ดูว่า fetch/DOM สำเร็จไหม / `BACKEND_URL` ใน config.js ถูกไหม |
| ร้านเราไม่ถูกไฮไลต์ | ชื่อ "ร้านเรา" ของ **platform นั้น** (ใน `/settings`) ต้องตรงเป๊ะกับ shop_name ที่ดึงมา |
| TikTok/Lazada ดึงได้ไม่ครบ/ว่าง | endpoint/selector เป็น best-guess — ดู warning ใน console แล้วปรับ `extension/lib/tiktok-api.js` / `lazada-api.js` ให้ตรงกับโครงหน้าเว็บจริง |

> ⚠️ internal API ทั้ง 3 platform ไม่เป็นทางการ — ถ้าวันหนึ่งดึงไม่ได้เลย อาจเพราะ
> platform เปลี่ยน API/anti-bot/โครง DOM. ปรับได้ที่ fetcher ของ platform นั้น
> (`extension/lib/{shopee,tiktok,lazada}-api.js`). แต่ละตัวลอง API ก่อน → fallback DOM,
> และ map ออกเป็น schema กลางเดียวกัน จึงไม่ต้องแตะ backend.
