import {
  pgTable,
  serial,
  bigint,
  bigserial,
  integer,
  text,
  numeric,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

// keyword ที่ผู้ใช้ติดตาม
export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  label: text("label"), // ชื่อแสดงผล เช่น "GB Pockit+ All Terrain"
  myShop: text("my_shop"), // ชื่อร้านเรา ไว้ไฮไลต์ในตาราง
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ตัวสินค้า/ร้าน (unique ต่อ item ภายใต้ keyword) — ข้อมูลที่ไม่ค่อยเปลี่ยน
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    itemId: bigint("item_id", { mode: "number" }).notNull(), // Shopee itemid
    shopId: bigint("shop_id", { mode: "number" }).notNull(), // Shopee shopid
    shopName: text("shop_name"),
    title: text("title"),
    imageUrl: text("image_url"),
    productUrl: text("product_url"),
  },
  (t) => ({
    uniqItem: unique("uniq_keyword_item_shop").on(
      t.keywordId,
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
    price: numeric("price", { precision: 12, scale: 2 }), // บาท
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

export type Keyword = typeof keywords.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
