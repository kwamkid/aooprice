// Seed ข้อมูลตัวอย่าง (mock) ไว้ทดสอบ dashboard ก่อน extension พร้อม
// รัน: npm run db:seed   (ต้องตั้ง DATABASE_URL ใน .env ก่อน)
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL!);

type Platform = "shopee" | "tiktok" | "lazada";

type Row = {
  platform: Platform;
  shop: string;
  title: string;
  price: number;
  sold: number | null;
  rating: number | null;
  ratingCount: number;
  official: boolean;
};

type Seed = {
  keyword: string;
  label: string;
  myShopShopee?: string;
  myShopTiktok?: string;
  myShopLazada?: string;
  rows: Row[];
};

const SEED: Seed[] = [
  {
    keyword: "GB Pockit+ All Terrain",
    label: "GB Pockit+ All Terrain",
    myShopShopee: "pungklombabyshop",
    myShopTiktok: "pungklom.official",
    rows: [
      { platform: "shopee", shop: "pungklombabyshop", title: "(คุ้มกว่า) GB รถเข็นเด็ก Pockit+ All Terrain", price: 7990, sold: 25, rating: 5.0, ratingCount: 25, official: false },
      { platform: "shopee", shop: "BabyandKidsthailand", title: "New2025 ศูนย์ไทย GB Pockit+ All Terrain", price: 7830, sold: 119, rating: 4.9, ratingCount: 200, official: false },
      { platform: "shopee", shop: "iDawin Thailand", title: "GB Pockit+ All Terrain 6เดือน-4ปี", price: 7890, sold: 46, rating: 5.0, ratingCount: 46, official: true },
      { platform: "tiktok", shop: "pungklom.official", title: "GB Pockit+ All Terrain รถเข็นพับเล็ก", price: 7790, sold: 58, rating: 4.9, ratingCount: 58, official: false },
      { platform: "tiktok", shop: "babykids.th", title: "GB Pockit+ All Terrain ของแท้ ศูนย์ไทย", price: 7950, sold: 12, rating: 4.8, ratingCount: 12, official: true },
      { platform: "lazada", shop: "iDawin Official Store", title: "GB Pockit+ All Terrain Stroller", price: 7690, sold: 33, rating: 4.9, ratingCount: 33, official: true },
      { platform: "lazada", shop: "Baby&Kids LazMall", title: "GB รถเข็นเด็ก Pockit+ All Terrain", price: 8090, sold: 7, rating: 4.7, ratingCount: 7, official: true },
    ],
  },
  {
    keyword: "STOKKE YOYO3 6+",
    label: "STOKKE YOYO3 6+",
    rows: [
      { platform: "shopee", shop: "BabyandKidsthailand", title: "Stokke YOYO3 6+ color รถเข็นเด็ก", price: 20064, sold: 237, rating: 5.0, ratingCount: 237, official: false },
      { platform: "shopee", shop: "Stokke Thailand", title: "Stokke YOYO3 สำหรับเด็ก 6เดือน-5ขวบ", price: 20900, sold: 20, rating: 5.0, ratingCount: 20, official: true },
      { platform: "tiktok", shop: "stokke.thailand", title: "Stokke YOYO3 6+ รถเข็นเด็กโต", price: 20500, sold: 15, rating: 5.0, ratingCount: 15, official: true },
      { platform: "lazada", shop: "Stokke Official Store", title: "Stokke YOYO3 6+ Stroller", price: 20900, sold: 9, rating: 4.9, ratingCount: 9, official: true },
    ],
  },
];

async function main() {
  for (const k of SEED) {
    const [kw] = await sql`
      INSERT INTO keywords (keyword, label, my_shop_shopee, my_shop_tiktok, my_shop_lazada)
      VALUES (${k.keyword}, ${k.label}, ${k.myShopShopee || null}, ${k.myShopTiktok || null}, ${k.myShopLazada || null})
      ON CONFLICT (keyword) DO UPDATE SET
        label = EXCLUDED.label,
        my_shop_shopee = EXCLUDED.my_shop_shopee,
        my_shop_tiktok = EXCLUDED.my_shop_tiktok,
        my_shop_lazada = EXCLUDED.my_shop_lazada
      RETURNING id`;
    const keywordId = kw.id;
    let n = keywordId * 1000;
    for (const r of k.rows) {
      n++;
      // id จำลองเป็น string (เลียนแบบ id จริงที่ไม่เหมือนกันข้าม platform)
      const itemId = `${r.platform}-${n}`;
      const shopId = `${r.platform}-shop-${n + 500000}`;
      const productUrl =
        r.platform === "shopee"
          ? `https://shopee.co.th/product/${shopId}/${itemId}`
          : r.platform === "tiktok"
            ? `https://www.tiktok.com/shop/pdp/${itemId}`
            : `https://www.lazada.co.th/products/${itemId}.html`;
      const [p] = await sql`
        INSERT INTO products (keyword_id, platform, item_id, shop_id, shop_name, title, image_url, product_url)
        VALUES (${keywordId}, ${r.platform}, ${itemId}, ${shopId}, ${r.shop}, ${r.title}, null, ${productUrl})
        ON CONFLICT (keyword_id, platform, item_id, shop_id) DO UPDATE SET shop_name = EXCLUDED.shop_name, title = EXCLUDED.title
        RETURNING id`;
      // สร้าง snapshot ย้อนหลัง 7 วัน ให้ราคาขยับเล็กน้อย -> เห็นกราฟ
      for (let d = 6; d >= 0; d--) {
        const jitter = d === 0 ? 0 : Math.round((((n + d) % 5) - 2) * 50);
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
