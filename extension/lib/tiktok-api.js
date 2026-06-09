// ดึงข้อมูลจาก TikTok Shop ตาม keyword + map เป็นรูปแบบกลางที่ backend ต้องการ
// ถูกเรียกจาก content script (รันบน *.tiktok.com) จึงใช้ session/cookie ผู้ใช้
//
// กลยุทธ์ (ตามที่ตกลงไว้): ลอง internal API ก่อน → ถ้าไม่ได้/ว่าง → fallback อ่าน DOM
//
// ⚠️ TikTok Shop ป้องกันหนัก: search API ภายในมักต้องมี signature (msToken / X-Bogus
//    / _signature) ที่คำนวณยากจากใน content script. โค้ดนี้จึง "ลองยิงแบบ best-effort"
//    แล้วพึ่ง DOM fallback เป็นหลัก. endpoint/selector จริงต้อง verify กับหน้าเว็บจริง.

const PLATFORM = "tiktok";

// TikTok ส่งราคาเป็น "หน่วยย่อย" บ้าง (เช่น สตางค์/หน่วย*100) — เผื่อแปลง
function toBaht(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (!isFinite(n)) return null;
  // ถ้าค่ามากผิดปกติ (เกิน ~1e5 สำหรับสินค้าแม่และเด็กทั่วไป) อาจเป็นหน่วย *100
  return n > 100000 ? Math.round(n) / 100 : n;
}

// ---- (1) ลอง internal API ----
async function tryApi(keyword, maxItems) {
  // best-effort: endpoint นี้อาจเปลี่ยน / ต้อง signature — ถ้าพังให้ throw เพื่อไป DOM
  const url =
    `https://www.tiktok.com/api/shop/search/item/?` +
    `keyword=${encodeURIComponent(keyword)}&count=${maxItems}&cursor=0&aid=1988`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "x-requested-with": "XMLHttpRequest" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`TikTok API HTTP ${res.status}`);

  const data = await res.json();
  // โครงสร้างไม่นิ่ง — เผื่อหลายชื่อ field
  const list =
    data?.data?.items ||
    data?.items ||
    data?.data?.products ||
    data?.products ||
    [];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("TikTok API: empty/unknown shape");
  }

  return list.slice(0, maxItems).map((it) => {
    const seller = it.seller || it.shop || {};
    const priceRaw =
      it.price?.real_price ??
      it.price?.sale_price ??
      it.sale_price ??
      it.price ??
      it.min_price;
    return {
      platform: PLATFORM,
      itemId: String(it.product_id || it.id || it.item_id || ""),
      shopId: String(seller.seller_id || seller.id || it.seller_id || ""),
      shopName: seller.name || seller.shop_name || it.seller_name || null,
      title: it.title || it.product_name || it.name || null,
      imageUrl:
        it.cover || it.image || (it.images && it.images[0]) || null,
      productUrl: it.product_id
        ? `https://www.tiktok.com/shop/pdp/${it.product_id}`
        : it.url || null,
      price: toBaht(priceRaw),
      sold: it.sold_count ?? it.sales ?? it.sold ?? null,
      rating: it.review?.rating ?? it.rating ?? null,
      ratingCount: it.review?.review_count ?? it.review_count ?? null,
      isOfficial: !!(seller.is_official || it.is_mall),
    };
  });
}

// ---- (2) fallback: อ่าน DOM จากหน้า search ----
// หมายเหตุ: selector ของ TikTok เปลี่ยนบ่อย — ต้องปรับจากหน้าเว็บจริง
function scrapeDom(maxItems) {
  const out = [];
  // เผื่อหลาย selector (โครง DOM TikTok Shop เปลี่ยนได้)
  const cards = document.querySelectorAll(
    '[data-e2e="search-card"], a[href*="/shop/pdp/"], [class*="product-card"]',
  );
  for (const card of cards) {
    if (out.length >= maxItems) break;
    const link = card.matches('a[href*="/shop/pdp/"]')
      ? card
      : card.querySelector('a[href*="/shop/pdp/"]');
    const href = link?.getAttribute("href") || "";
    const idMatch = href.match(/\/pdp\/(\d+)/);
    if (!idMatch) continue;
    const itemId = idMatch[1];

    const text = card.textContent || "";
    const priceMatch = text.replace(/,/g, "").match(/฿\s*([\d.]+)/);
    const price = priceMatch ? Number(priceMatch[1]) : null;
    const titleEl =
      card.querySelector('[class*="title"], [class*="name"], h3, h4') || null;
    const imgEl = card.querySelector("img");

    out.push({
      platform: PLATFORM,
      itemId,
      shopId: "", // DOM ของหน้า search มักไม่มี seller id — เติมทีหลังได้
      shopName: null,
      title: titleEl?.textContent?.trim() || imgEl?.getAttribute("alt") || null,
      imageUrl: imgEl?.getAttribute("src") || null,
      productUrl: `https://www.tiktok.com/shop/pdp/${itemId}`,
      price,
      sold: null,
      rating: null,
      ratingCount: null,
      isOfficial: false,
    });
  }
  return out;
}

export async function fetchTiktokItems(keyword, { maxItems = 60 } = {}) {
  try {
    const items = await tryApi(keyword, maxItems);
    if (items.length > 0) return items;
  } catch (e) {
    console.warn("[aooprice] TikTok API failed, fallback to DOM:", e.message);
  }
  // fallback: ต้องอยู่บนหน้า search ของ TikTok Shop ที่ค้นด้วย keyword นี้แล้ว
  return scrapeDom(maxItems);
}
