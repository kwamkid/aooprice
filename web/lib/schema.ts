import {
  pgTable,
  serial,
  bigserial,
  integer,
  // หมายเหตุ: itemId/shopId เปลี่ยนเป็น text แล้ว (รองรับ multi-platform) จึงไม่ใช้ bigint
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

// แพลตฟอร์มที่รองรับ — เก็บเป็น text (ไม่ใช่ enum) เพื่อเพิ่ม platform ใหม่ได้ง่าย
export type Platform = "shopee" | "tiktok" | "lazada";

// ค่าตั้งค่ารวมแบบ key-value (เก็บ my_shop รวม + flag สั่งดึงจากเว็บ)
// ใช้ key คงที่: "my_shop", "scrape_request" (ISO timestamp ตอนกดปุ่มดึงบนเว็บ)
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// keyword ที่ผู้ใช้ติดตาม (ไม่ผูกกับ platform — keyword เดียวเห็นได้ทุก platform)
export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  label: text("label"), // ชื่อแสดงผล เช่น "GB Pockit+ All Terrain"
  myShop: text("my_shop"), // (legacy) ชื่อร้านเรารวม — เก็บไว้เผื่อ backward compat
  // ชื่อร้านเราแยกต่อ platform (ชื่อร้านมักไม่เหมือนกันข้าม marketplace) ไว้ไฮไลต์ในตาราง
  myShopShopee: text("my_shop_shopee"),
  myShopTiktok: text("my_shop_tiktok"),
  myShopLazada: text("my_shop_lazada"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ตัวสินค้า/ร้าน (unique ต่อ item ภายใต้ keyword+platform) — ข้อมูลที่ไม่ค่อยเปลี่ยน
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().default("shopee"), // shopee | tiktok | lazada
    itemId: text("item_id").notNull(), // id สินค้า (text — รองรับ id ที่เป็น string ของ tiktok/lazada)
    shopId: text("shop_id").notNull(), // id ร้าน (text)
    shopName: text("shop_name"),
    title: text("title"),
    imageUrl: text("image_url"),
    productUrl: text("product_url"),
  },
  (t) => ({
    uniqItem: unique("uniq_keyword_platform_item_shop").on(
      t.keywordId,
      t.platform,
      t.itemId,
      t.shopId,
    ),
  }),
);

// snapshot ราคา/ยอดขาย/เรตติ้ง ทุกครั้งที่ดึง = price history
export const snapshots = pgTable(
  "snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 12, scale: 2 }), // บาท (ราคาขายจริง)
    priceBefore: numeric("price_before", { precision: 12, scale: 2 }), // ราคาตั้งก่อนลด
    sold: integer("sold"), // ขายแล้ว (historical_sold)
    rating: numeric("rating", { precision: 2, scale: 1 }), // เรตติ้งเฉลี่ย
    ratingCount: integer("rating_count"),
    isOfficial: boolean("is_official"), // ป้าย Mall/Official
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byProductTime: index("idx_snapshots_product_time").on(
      t.productId,
      t.capturedAt.desc(),
    ),
  }),
);

// ค้นหา real-time (ad-hoc) — เว็บตั้ง job → extension poll claim → ยิงสด → ส่งผลกลับ
// ไม่ผูกกับ keywords/products ถาวร (ad-hoc = ใช้แล้วทิ้ง) เก็บผลเป็น jsonb ก้อนเดียว
// status: pending (รอ extension) → running (claim แล้ว) → done | error
export const searchJobs = pgTable(
  "search_jobs",
  {
    id: text("id").primaryKey(), // crypto.randomUUID()
    keyword: text("keyword").notNull(),
    platform: text("platform").notNull().default("shopee"), // เฟสแรก shopee
    status: text("status").notNull().default("pending"),
    result: jsonb("result"), // array ของ item (รูปใกล้ CompareRow) — null จนกว่า done
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byStatusTime: index("idx_search_jobs_status_time").on(t.status, t.createdAt),
  }),
);

export type Setting = typeof settings.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type SearchJob = typeof searchJobs.$inferSelect;
