// ดึงข้อมูลจาก Shopee internal search API + map เป็นรูปแบบที่ backend ต้องการ
// ฟังก์ชันนี้ถูกเรียกจาก content script (รันบน shopee.co.th) จึงใช้ session/cookie
// ของผู้ใช้อัตโนมัติ และผ่าน same-origin

const SEARCH_API = "https://shopee.co.th/api/v4/search/search_items";

// แปลงราคา Shopee (หน่วย *100000) -> บาท
function toBaht(raw) {
  if (raw == null) return null;
  return Math.round(raw / 1000) / 100; // /100000 แล้วปัดทศนิยม 2 ตำแหน่ง
}

// ดึงสินค้าทั้งหมดตาม keyword (วนหลายหน้าได้)
export async function fetchShopeeItems(keyword, { maxItems = 60 } = {}) {
  const limit = 60;
  const collected = [];
  let page = 0;

  while (collected.length < maxItems) {
    const url =
      `${SEARCH_API}?by=relevancy&keyword=${encodeURIComponent(keyword)}` +
      `&limit=${limit}&newest=${page * limit}&order=desc&page_type=search` +
      `&scenario=PAGE_GLOBAL_SEARCH&version=2`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-source": "pc",
        "x-shopee-language": "th",
        "x-requested-with": "XMLHttpRequest",
        referer: `https://shopee.co.th/search?keyword=${encodeURIComponent(keyword)}`,
      },
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Shopee API HTTP ${res.status}`);
    }

    const data = await res.json();

    // ถ้าโดน anti-bot Shopee มักคืน error หรือ items ว่าง + มี field error
    if (data?.error) {
      throw new Error(`Shopee API error: ${data.error} ${data.error_msg || ""}`);
    }

    const items = data?.items || [];
    if (items.length === 0) break;

    for (const it of items) {
      const b = it.item_basic || it.item || {};
      if (!b.itemid || !b.shopid) continue;
      collected.push(mapItem(b));
    }

    page++;
    if (items.length < limit) break; // หน้าสุดท้าย
    // หน่วงเล็กน้อยกันยิงถี่เกินไป
    await new Promise((r) => setTimeout(r, 600));
  }

  return collected.slice(0, maxItems);
}

function mapItem(b) {
  const rating = b.item_rating || {};
  const ratingCounts = rating.rating_count || [];
  return {
    itemId: b.itemid,
    shopId: b.shopid,
    shopName: b.shop_name || null, // หมายเหตุ: search API บางทีไม่มี shop_name -> เติมทีหลังได้
    title: b.name || null,
    imageUrl: b.image
      ? `https://down-th.img.susercontent.com/file/${b.image}`
      : null,
    productUrl: `https://shopee.co.th/product/${b.shopid}/${b.itemid}`,
    price: toBaht(b.price ?? b.price_min),
    sold: b.historical_sold ?? b.sold ?? null,
    rating:
      rating.rating_star != null
        ? Math.round(rating.rating_star * 10) / 10
        : null,
    ratingCount: Array.isArray(ratingCounts) ? ratingCounts[0] ?? null : null,
    isOfficial: !!(b.is_official_shop || b.shopee_verified),
  };
}
