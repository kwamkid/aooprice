// ดึงข้อมูลจาก Lazada ตาม keyword + map เป็นรูปแบบกลางที่ backend ต้องการ
// ถูกเรียกจาก content script (รันบน *.lazada.co.th) จึงใช้ session/cookie ผู้ใช้
//
// กลยุทธ์: ลอง internal API ก่อน (Lazada มี endpoint catalog ที่คืน JSON ตรงค่อนข้างนิ่ง)
//          → ถ้าไม่ได้/ว่าง → fallback อ่าน DOM
//
// ⚠️ endpoint/selector อาจเปลี่ยน — ต้อง verify กับหน้าเว็บจริง

const PLATFORM = "lazada";

function toBaht(raw) {
  if (raw == null) return null;
  // Lazada ส่งราคามาเป็น string เช่น "฿7,990" หรือ number ตรง ๆ
  if (typeof raw === "number") return raw;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return isFinite(n) ? n : null;
}

function num(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return isFinite(n) ? n : null;
}

// ---- (1) ลอง internal API: catalog JSON ----
async function tryApi(keyword, maxItems) {
  const collected = [];
  let page = 1;
  while (collected.length < maxItems && page <= 3) {
    const url =
      `https://www.lazada.co.th/catalog/?ajax=true&isFirstRequest=true` +
      `&q=${encodeURIComponent(keyword)}&page=${page}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-requested-with": "XMLHttpRequest" },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Lazada API HTTP ${res.status}`);
    const data = await res.json();

    const list = data?.mods?.listItems || data?.listItems || [];
    if (!Array.isArray(list) || list.length === 0) {
      if (page === 1) throw new Error("Lazada API: empty/unknown shape");
      break;
    }

    for (const it of list) {
      if (collected.length >= maxItems) break;
      collected.push({
        platform: PLATFORM,
        itemId: String(it.itemId || it.nid || ""),
        shopId: String(it.sellerId || it.brandId || ""),
        shopName: it.sellerName || it.brandName || null,
        title: it.name || it.title || null,
        imageUrl: it.image || it.thumb || null,
        productUrl: it.itemUrl
          ? it.itemUrl.startsWith("http")
            ? it.itemUrl
            : "https:" + it.itemUrl
          : it.itemId
            ? `https://www.lazada.co.th/products/-i${it.itemId}.html`
            : null,
        price: toBaht(it.priceShow ?? it.price),
        sold: num(it.itemSoldCntShow ?? it.soldCount),
        rating: it.ratingScore != null ? Number(it.ratingScore) : null,
        ratingCount: num(it.review),
        isOfficial: !!(it.sellerType === "official" || it.officialStore),
      });
    }
    page++;
    await new Promise((r) => setTimeout(r, 600));
  }
  return collected;
}

// ---- (2) fallback: อ่าน DOM จากหน้า catalog ----
// selector อาจเปลี่ยน — ปรับจากหน้าเว็บจริง
function scrapeDom(maxItems) {
  const out = [];
  const cards = document.querySelectorAll(
    '[data-qa-locator="product-item"], a[href*="/products/"]',
  );
  for (const card of cards) {
    if (out.length >= maxItems) break;
    const link = card.matches('a[href*="/products/"]')
      ? card
      : card.querySelector('a[href*="/products/"]');
    const href = link?.getAttribute("href") || "";
    const idMatch = href.match(/-i(\d+)/);
    const itemId = idMatch ? idMatch[1] : "";
    if (!itemId) continue;

    const text = card.textContent || "";
    const priceMatch = text.replace(/,/g, "").match(/฿\s*([\d.]+)/);
    const titleEl = card.querySelector('[class*="title"], img');

    out.push({
      platform: PLATFORM,
      itemId,
      shopId: "",
      shopName: null,
      title:
        titleEl?.getAttribute?.("alt") || titleEl?.textContent?.trim() || null,
      imageUrl: card.querySelector("img")?.getAttribute("src") || null,
      productUrl: href.startsWith("http") ? href : "https:" + href,
      price: priceMatch ? Number(priceMatch[1]) : null,
      sold: null,
      rating: null,
      ratingCount: null,
      isOfficial: false,
    });
  }
  return out;
}

export async function fetchLazadaItems(keyword, { maxItems = 60 } = {}) {
  try {
    const items = await tryApi(keyword, maxItems);
    if (items.length > 0) return items;
  } catch (e) {
    console.warn("[aooprice] Lazada API failed, fallback to DOM:", e.message);
  }
  return scrapeDom(maxItems);
}
