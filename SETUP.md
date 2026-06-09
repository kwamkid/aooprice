# aooprice — คู่มือการใช้งาน (SETUP)

คู่มือ setup + ใช้งานแบบทีละขั้น ตั้งแต่ติดตั้งจนถึงดึงข้อมูล Shopee จริง

---

## ภาพรวม 3 ส่วน

1. **web/** — เว็บ dashboard + API (รันบนเครื่อง หรือ deploy Vercel)
2. **Neon** — ฐานข้อมูล Postgres (cloud)
3. **extension/** — Chrome Extension ที่ดึงข้อมูลจาก Shopee แล้วส่งเข้า web

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

## STEP 4 — ตั้งค่า Extension

คลิกไอคอน aooprice → กรอก:

| ช่อง | ใส่อะไร |
|------|---------|
| **Backend URL** | `http://localhost:3000` (ตอนเทส) หรือ URL Vercel ตอน deploy |
| **Ingest Token** | ค่าเดียวกับ `INGEST_TOKEN` ใน `web/.env` |
| **ชื่อร้านเรา** | ชื่อร้านบน Shopee ของเรา (ไว้ไฮไลต์สีฟ้าในตาราง) เช่น `pungklombabyshop` |
| **Keywords** | คำค้นที่อยากติดตาม บรรทัดละ 1 คำ เช่น `GB Pockit+ All Terrain` |
| **เปิด Auto** | ติ๊กถ้าอยากให้ดึงเองตามเวลา + ตั้งช่วงเป็นชั่วโมง (เช่น 24) |

> 🔑 INGEST_TOKEN ของโปรเจกต์นี้ (จาก setup ล่าสุด):
> `4442271b18efd8bb07e0e2de8287c70a26e1a501de860397`
> *(ถ้า rotate ใหม่ใน .env แล้ว ต้องอัพเดทช่องนี้ให้ตรงด้วย)*

กด **บันทึกการตั้งค่า**

---

## STEP 5 — ดึงข้อมูล Shopee จริง

### วิธี A — Manual (กดเอง)
1. เปิด **shopee.co.th** แล้ว **login** ให้เรียบร้อย
2. **วิธีที่ 1:** คลิกไอคอน aooprice → กด **⟳ ดึงเดี๋ยวนี้ (ทุก keyword)**
   - ถ้าไม่มีแท็บ Shopee เปิดอยู่ extension จะเปิดให้เอง
3. **วิธีที่ 2:** ไปหน้า search ของ keyword นั้นบน Shopee →
   กดปุ่ม **⟳ aooprice Rescan** สีส้มมุมขวาล่าง
4. กลับมาดูที่ http://localhost:3000 → ข้อมูลควรเข้าตาราง

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
| กดดึงแล้ว "ไม่พบสินค้า (อาจโดน anti-bot)" | Shopee บล็อก — ลอง login ใหม่, เปิดหน้า search ค้างไว้ก่อนกด, ลดความถี่ |
| "ยังไม่ได้ตั้งค่า backend URL / token" | ยังไม่กดบันทึกใน popup หรือกรอกไม่ครบ |
| ingest 401 | INGEST_TOKEN ใน popup ไม่ตรงกับใน `web/.env` |
| ตารางไม่มีข้อมูลหลังดึง | ดู console ของแท็บ Shopee (F12) ว่า fetch สำเร็จไหม / Backend URL ถูกไหม |
| ร้านเราไม่ถูกไฮไลต์ | ชื่อ "ร้านเรา" ต้องตรงเป๊ะกับ shop_name ที่ Shopee คืนมา |

> ⚠️ Shopee internal API ไม่เป็นทางการ — ถ้าวันหนึ่งดึงไม่ได้เลย อาจเพราะ
> Shopee เปลี่ยน API/anti-bot ต้องปรับ `extension/lib/shopee-api.js`
> (แผนสำรอง: เปลี่ยนไปอ่าน DOM ของหน้า search แทน)
