// Seed ข้อมูลตัวอย่าง (mock) ไว้ทดสอบ dashboard ก่อน extension พร้อม
// รัน: npm run db:seed   (ต้องตั้ง DATABASE_URL ใน .env ก่อน)
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL!);

type Row = {
  shop: string;
  title: string;
  price: number;
  sold: number | null;
  rating: number | null;
  ratingCount: number;
  official: boolean;
};

const SEED: { keyword: string; label: string; myShop: string; rows: Row[] }[] = [
  {
    keyword: "GB Pockit+ All Terrain",
    label: "GB Pockit+ All Terrain",
    myShop: "pungklombabyshop",
    rows: [
      { shop: "pungklombabyshop", title: "(คุ้มกว่า) GB รถเข็นเด็ก Pockit+ All Terrain", price: 7990, sold: 25, rating: 5.0, ratingCount: 25, official: false },
      { shop: "BabyandKidsthailand", title: "New2025 ศูนย์ไทย GB Pockit+ All Terrain", price: 7830, sold: 119, rating: 4.9, ratingCount: 200, official: false },
      { shop: "IreneKidsShop", title: "GB รถเข็นเด็ก พับเล็ก Pockit+ All Terrain", price: 7830, sold: null, rating: null, ratingCount: 0, official: false },
      { shop: "iDawin Thailand", title: "GB Pockit+ All Terrain 6เดือน-4ปี", price: 7890, sold: 46, rating: 5.0, ratingCount: 46, official: true },
      { shop: "ABC the Baby", title: "GB รถเข็นเด็ก พับเล็ก Pockit+ All Terrain", price: 7990, sold: 37, rating: 4.8, ratingCount: 37, official: false },
    ],
  },
  {
    keyword: "STOKKE YOYO3 6+",
    label: "STOKKE YOYO3 6+",
    myShop: "",
    rows: [
      { shop: "BabyandKidsthailand", title: "Stokke YOYO3 6+ color รถเข็นเด็ก", price: 20064, sold: 237, rating: 5.0, ratingCount: 237, official: false },
      { shop: "Stokke Thailand", title: "Stokke YOYO3 สำหรับเด็ก 6เดือน-5ขวบ", price: 20900, sold: 20, rating: 5.0, ratingCount: 20, official: true },
      { shop: "ABC the Baby", title: "Stokke YOYO รถเข็นเด็กโต YOYO3 6+", price: 20900, sold: 20, rating: 3.7, ratingCount: 20, official: false },
      { shop: "Punnita Official", title: "NEW MODEL Stokke YOYO3", price: 20900, sold: 10, rating: 5.0, ratingCount: 10, official: false },
      { shop: "BabyandKidsthailand", title: "Babyzen YOYO3 6+ ผ้าเบาะ", price: 27744, sold: 5, rating: 5.0, ratingCount: 5, official: false },
    ],
  },
];

async function main() {
  for (const k of SEED) {
    const [kw] = await sql`
      INSERT INTO keywords (keyword, label, my_shop)
      VALUES (${k.keyword}, ${k.label}, ${k.myShop || null})
      ON CONFLICT (keyword) DO UPDATE SET label = EXCLUDED.label, my_shop = EXCLUDED.my_shop
      RETURNING id`;
    const keywordId = kw.id;
    let itemId = keywordId * 1000;
    for (const r of k.rows) {
      itemId++;
      const shopId = itemId + 500000;
      const [p] = await sql`
        INSERT INTO products (keyword_id, item_id, shop_id, shop_name, title, image_url, product_url)
        VALUES (${keywordId}, ${itemId}, ${shopId}, ${r.shop}, ${r.title}, null,
                ${"https://shopee.co.th/product/" + shopId + "/" + itemId})
        ON CONFLICT (keyword_id, item_id, shop_id) DO UPDATE SET shop_name = EXCLUDED.shop_name, title = EXCLUDED.title
        RETURNING id`;
      // สร้าง snapshot ย้อนหลัง 7 วัน ให้ราคาขยับเล็กน้อย -> เห็นกราฟ
      for (let d = 6; d >= 0; d--) {
        const jitter = d === 0 ? 0 : Math.round((((itemId + d) % 5) - 2) * 50);
        await sql`
          INSERT INTO snapshots (product_id, price, sold, rating, rating_count, is_official, captured_at)
          VALUES (${p.id}, ${r.price + jitter}, ${r.sold}, ${r.rating}, ${r.ratingCount}, ${r.official},
                  now() - (${d} || ' days')::interval)`;
      }
    }
    console.log(`seeded "${k.keyword}" with ${k.rows.length} products`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
