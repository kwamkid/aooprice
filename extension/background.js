// Background service worker — จัดการ AUTO (chrome.alarms) + catch-up + คิวสั่งดึงจากเว็บ
// การดึงจริงเกิดใน content script (ต้องอยู่บนแท็บ marketplace เพื่อใช้ session)
// background จึงทำหน้าที่: ตั้ง alarm, poll คิวจากเว็บ, เปิด/นำทางแท็บ search ของแต่ละ
// platform (Shopee/TikTok/Lazada) ทีละ keyword แล้วสั่ง content script ให้ดึง
//
// ⚙️ backend URL / token เป็นค่า fix ใน config.js

import { CONFIG, apiBase } from "./config.js";

// platform ที่รองรับ + ตัวสร้าง URL หน้า search (ไว้พาแท็บไปหน้าที่มีผลลัพธ์)
const PLATFORM_SEARCH = {
  shopee: (q) => `https://shopee.co.th/search?keyword=${encodeURIComponent(q)}`,
  tiktok: (q) => `https://www.tiktok.com/search/shop?q=${encodeURIComponent(q)}`,
  lazada: (q) => `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(q)}`,
};
const ALL_PLATFORMS = Object.keys(PLATFORM_SEARCH);

const ALARM_SCRAPE = "aooprice-scrape"; // รอบ auto ตามชั่วโมงที่ตั้ง
const ALARM_POLL = "aooprice-poll"; // เช็คคิว "ดึงเดี๋ยวนี้" จากเว็บ

const authHeader = "Bearer " + CONFIG.INGEST_TOKEN;

// สร้าง/อัพเดท alarm: รอบ auto (ตาม popup) + poll คิวจากเว็บ (เปิดตลอด)
async function syncAlarm() {
  const cfg = await chrome.storage.sync.get(["autoEnabled", "intervalHours"]);
  await chrome.alarms.clear(ALARM_SCRAPE);
  if (cfg.autoEnabled) {
    const hours = Math.max(1, Number(cfg.intervalHours) || 24);
    chrome.alarms.create(ALARM_SCRAPE, {
      periodInMinutes: hours * 60,
      delayInMinutes: 1,
    });
  }
  // poll คิวจากเว็บทุก 1 นาที (ขั้นต่ำของ chrome.alarms) — เปิดเสมอ
  chrome.alarms.create(ALARM_POLL, { periodInMinutes: 1, delayInMinutes: 0.2 });
}

chrome.runtime.onInstalled.addListener(syncAlarm);
chrome.runtime.onStartup.addListener(async () => {
  await syncAlarm();
  await catchUpIfMissed();
});

// popup แจ้งว่าตั้งค่าเปลี่ยน -> sync alarm ใหม่ / สั่งดึงเดี๋ยวนี้
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === "SYNC_ALARM") {
    syncAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "RUN_NOW") {
    runScrape()
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_SCRAPE) runScrape();
  if (alarm.name === ALARM_POLL) {
    pollWebRequest();
    // alarm ทุก 1 นาทีคือขั้นต่ำ — แต่ค้นสดต้องไวกว่านั้น จึงปั่น fast-poll
    // ทุก 5 วิ ต่ออีกราว ๆ 1 รอบ alarm ขณะ service worker ยังตื่น
    startFastPoll();
  }
});

// เช็คคิว "ดึงเดี๋ยวนี้" ที่กดจากหน้าเว็บ — ถ้ามีก็ดึงเลย (consume=1 เพื่อกันดึงซ้ำ)
async function pollWebRequest() {
  try {
    const res = await fetch(apiBase() + "/api/scrape-request?consume=1", {
      headers: { authorization: authHeader },
    });
    if (!res.ok) return;
    const json = await res.json();
    if (json.pending) {
      await runScrape();
    }
  } catch {
    // เงียบไว้ — เว็บอาจปิด/ออฟไลน์ชั่วคราว
  }
}

// ===== ค้นหา real-time (ad-hoc) — ดู CLAUDE.md "ยิงสด = ผ่าน extension" =====

// fast-poll: เช็คคิวค้นสดทุก 5 วิ ~11 รอบ (≈55 วิ) แล้วหยุด รอ alarm รอบหน้าปลุกใหม่
// ทำให้ latency การค้นสดเหลือ ~5 วิ ขณะ worker ตื่น (แทนที่จะรอ alarm 1 นาที)
let fastPollTimer = null;
let fastPollLeft = 0;
function startFastPoll() {
  fastPollLeft = 11;
  if (fastPollTimer) return; // กำลังปั่นอยู่แล้ว
  const tick = async () => {
    await pollSearchJob();
    if (--fastPollLeft > 0) {
      fastPollTimer = setTimeout(tick, 5000);
    } else {
      fastPollTimer = null;
    }
  };
  tick();
}

// log helper — ใส่ prefix [aooprice] ให้ค้นใน console ง่าย (service worker console)
const L = (...a) => console.log("[aooprice]", ...a);

// claim job ค้นสด 1 อันจากเว็บ → ยิง marketplace สด → ส่งผลกลับ (ไม่เข้า DB ถาวร)
async function pollSearchJob() {
  let job;
  try {
    const res = await fetch(apiBase() + "/api/search-job?claim=1", {
      headers: { authorization: authHeader },
    });
    if (!res.ok) {
      L("claim: HTTP", res.status, "(ไม่ใช่ 200 — ข้าม)");
      return;
    }
    job = (await res.json()).job;
  } catch (e) {
    L("claim: fetch ล้ม (เว็บปิด/ออฟไลน์?)", String(e.message || e));
    return;
  }
  if (!job) return; // ไม่มีคิว (เงียบไว้ — poll ทุก 5 วิ)

  L("🎯 claim job:", job.id, "| keyword:", job.keyword, "| platform:", job.platform);
  try {
    const items = await scrapeAdhoc(job.platform || "shopee", job.keyword);
    L("✅ ดึงได้", items.length, "รายการ → ส่งผลกลับ");
    await postJobResult(job.id, { items });
  } catch (e) {
    L("❌ ดึงล้ม:", String(e.message || e), "→ ส่ง error กลับ");
    await postJobResult(job.id, { error: String(e.message || e) });
  }
}

// host ของแต่ละ platform ไว้หาแท็บที่เปิดอยู่แล้ว
const PLATFORM_HOST = {
  shopee: "shopee.co.th",
  tiktok: "tiktok.com",
  lazada: "lazada.co.th",
};

// ⚠️ ฟังก์ชันนี้ถูก inject ไปรันใน MAIN world ของหน้า Shopee (chrome.scripting.executeScript)
// เหตุผล: content script (isolated world) ยิง search API แล้วโดน 403 เพราะขาด anti-bot
//   token ที่ JS ของหน้า Shopee patch ลง fetch ใน main world. รันที่ main world = ได้ token ครบ
// 🔒 ต้อง self-contained 100% — ห้ามอ้างอิงตัวแปร/ฟังก์ชันนอก body (executeScript serialize
//   เฉพาะ source ของฟังก์ชัน ไม่เอา closure). args ส่งผ่าน structured-clone ได้เฉพาะ primitive
function shopeeMainWorldFetch(keyword, maxItems) {
  const SEARCH_API = "https://shopee.co.th/api/v4/search/search_items";
  const toBaht = (raw) => (raw == null ? null : Math.round(raw / 1000) / 100);
  const mapItem = (b) => {
    const rating = b.item_rating || {};
    const rc = rating.rating_count || [];
    return {
      platform: "shopee",
      itemId: b.itemid,
      shopId: b.shopid,
      shopName: b.shop_name || null,
      title: b.name || null,
      imageUrl: b.image
        ? `https://down-th.img.susercontent.com/file/${b.image}`
        : null,
      productUrl: `https://shopee.co.th/product/${b.shopid}/${b.itemid}`,
      price: toBaht(b.price ?? b.price_min),
      priceBefore: toBaht(b.price_before_discount ?? b.price_max_before_discount), // ราคาตั้ง (ก่อนลด)
      sold: b.historical_sold ?? b.sold ?? null,
      rating:
        rating.rating_star != null
          ? Math.round(rating.rating_star * 10) / 10
          : null,
      ratingCount: Array.isArray(rc) ? rc[0] ?? null : null,
      isOfficial: !!(b.is_official_shop || b.shopee_verified),
    };
  };
  return (async () => {
    const limit = 60;
    const collected = [];
    let page = 0;
    const opts = {
      method: "GET",
      credentials: "include",
      headers: {
        "x-api-source": "pc",
        "x-shopee-language": "th",
        "x-requested-with": "XMLHttpRequest",
        referer: `https://shopee.co.th/search?keyword=${encodeURIComponent(keyword)}`,
      },
    };
    while (collected.length < maxItems) {
      const url =
        `${SEARCH_API}?by=relevancy&keyword=${encodeURIComponent(keyword)}` +
        `&limit=${limit}&newest=${page * limit}&order=desc&page_type=search` +
        `&scenario=PAGE_GLOBAL_SEARCH&version=2`;
      let res = await fetch(url, opts);
      for (let a = 1; a <= 2 && (res.status === 403 || res.status === 429); a++) {
        await new Promise((r) => setTimeout(r, a * 2500));
        res = await fetch(url, opts);
      }
      if (res.status === 403) return { ok: false, error: "CAPTCHA" };
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      if (data?.error === 90309999) return { ok: false, error: "CAPTCHA" };
      if (data?.error)
        return { ok: false, error: `Shopee error ${data.error} ${data.error_msg || ""}` };
      const items = data?.items || [];
      if (!items.length) break;
      for (const it of items) {
        const b = it.item_basic || it.item || {};
        if (b.itemid && b.shopid) collected.push(mapItem(b));
      }
      page++;
      if (items.length < limit) break;
      await new Promise((r) => setTimeout(r, 600));
    }
    return { ok: true, items: collected.slice(0, maxItems) };
  })();
}

// ยิง Shopee ผ่าน MAIN world ของแท็บที่ระบุ แล้วคืน items (กัน 403 จาก isolated world)
async function scrapeShopeeMainWorld(tabId, keyword, maxItems) {
  const CAPTCHA_MSG =
    "Shopee ขอให้ยืนยันตัวตน (CAPTCHA) — เปิด shopee.co.th แล้วค้นหาสินค้าสักครั้ง เลื่อนจิ๊กซอว์ให้ผ่าน แล้วลองใหม่";
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [keyword, maxItems],
    func: shopeeMainWorldFetch,
  });
  const out = results?.[0]?.result;
  L("main-world fetch ผล:", out ? (out.ok ? `ok ${out.items?.length} items` : `FAIL ${out.error}`) : "ไม่มีผล");
  if (!out) throw new Error("main-world fetch ไม่มีผลลัพธ์ (หน้า navigate/crash?)");
  if (!out.ok) throw new Error(out.error === "CAPTCHA" ? CAPTCHA_MSG : out.error);
  return out.items;
}

// ค้นสด: ใช้แท็บ platform ที่ "เปิดอยู่แล้ว" ก่อน (session อุ่น + ผ่าน CAPTCHA แล้ว)
// เพราะแท็บที่เพิ่งเปิดใหม่ มักโดน CAPTCHA (Shopee เห็นเป็น session ไม่มีประวัติ browsing)
// ไม่มีแท็บเดิม → เปิดใหม่เป็น fallback (อาจเจอ CAPTCHA — user ต้องเลื่อนเอง)
async function scrapeAdhoc(platform, keyword) {
  const make = PLATFORM_SEARCH[platform] || PLATFORM_SEARCH.shopee;
  const host = PLATFORM_HOST[platform] || PLATFORM_HOST.shopee;

  // หาแท็บ platform ที่เปิดอยู่ (ครอบทั้ง host ตรง ๆ และ subdomain)
  const existing = [
    ...(await chrome.tabs.query({ url: `*://${host}/*` })),
    ...(await chrome.tabs.query({ url: `*://*.${host}/*` })),
  ];
  const warmTab = existing.find((t) => t.id != null);
  L("หาแท็บ", host, "ที่เปิดอยู่:", existing.length, "แท็บ", warmTab ? `(ใช้ tab ${warmTab.id})` : "(ไม่มี — จะเปิดใหม่)");

  // ดึงจากแท็บ: Shopee ใช้ main-world (กัน 403) · platform อื่นใช้ content message (DOM)
  const pull = async (tabId) => {
    if (platform === "shopee") {
      L("ยิง Shopee ผ่าน MAIN world, tab", tabId);
      return await scrapeShopeeMainWorld(tabId, keyword, CONFIG.MAX_ITEMS);
    }
    L("ส่ง SCRAPE_ONE_ADHOC ไปแท็บ", tabId);
    const resp = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_ONE_ADHOC", keyword });
    if (!resp?.ok) throw new Error(resp?.error || "ดึงไม่สำเร็จ");
    return resp.items || [];
  };

  if (warmTab) {
    L("นำแท็บอุ่นไปหน้า search:", make(keyword));
    await navigateTab(warmTab.id, make(keyword));
    await new Promise((r) => setTimeout(r, platform === "shopee" ? 2500 : 4000));
    return await pull(warmTab.id);
  }

  // ไม่มีแท็บเดิม → เปิดใหม่ (โอกาสเจอ CAPTCHA สูงกว่า)
  L("เปิดแท็บใหม่ (active):", make(keyword));
  const tab = await chrome.tabs.create({ url: make(keyword), active: true });
  try {
    await waitForTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, platform === "shopee" ? 6000 : 5000));
    return await pull(tab.id);
  } finally {
    setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 1000);
  }
}

async function postJobResult(jobId, payload) {
  try {
    await fetch(apiBase() + "/api/search-job/result", {
      method: "POST",
      headers: { authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, ...payload }),
    });
  } catch {
    // เว็บปิดไปแล้ว — job จะถูก expire โดย cron
  }
}

// ถ้าพลาดรอบ auto เพราะเครื่อง/เบราว์เซอร์ปิด -> ดึงชดเชยตอนเปิดใหม่
async function catchUpIfMissed() {
  const cfg = await chrome.storage.sync.get(["autoEnabled", "intervalHours"]);
  if (!cfg.autoEnabled) return;
  const { lastRunAt } = await chrome.storage.local.get("lastRunAt");
  const hours = Math.max(1, Number(cfg.intervalHours) || 24);
  const dueAfter = hours * 3.6e6;
  if (!lastRunAt || Date.now() - lastRunAt > dueAfter) {
    runScrape();
  }
}

// platform ที่เปิดใช้งาน (ตั้งใน popup) — default เปิดครบทุก platform
async function enabledPlatforms() {
  const { platforms } = await chrome.storage.sync.get("platforms");
  if (!platforms) return ALL_PLATFORMS.slice();
  const on = ALL_PLATFORMS.filter((p) => platforms[p]);
  return on.length ? on : ALL_PLATFORMS.slice();
}

// ดึงรายการ keyword จากเว็บ (แหล่งความจริงเดียว)
async function fetchKeywords() {
  try {
    const res = await fetch(apiBase() + "/api/keywords");
    const json = await res.json();
    return (json.keywords || []).map((k) => k.keyword);
  } catch {
    return [];
  }
}

// วนทุก platform ที่เปิด × ทุก keyword: นำแท็บไปหน้า search แล้วสั่ง content ดึงทีละคำ
// (พาไปหน้า search จริงสำคัญมากสำหรับ DOM fallback ของ tiktok/lazada)
async function runScrape() {
  const [platforms, keywords] = await Promise.all([
    enabledPlatforms(),
    fetchKeywords(),
  ]);
  if (keywords.length === 0) {
    return { ok: false, error: "ยังไม่มี keyword — เพิ่มในหน้าตั้งค่าบนเว็บก่อน" };
  }

  const allResults = [];
  for (const platform of platforms) {
    // เปิดแท็บ background สำหรับ platform นี้ 1 แท็บ แล้วใช้นำทางทุก keyword
    let tab;
    try {
      tab = await chrome.tabs.create({
        url: PLATFORM_SEARCH[platform](keywords[0]),
        active: false,
      });
    } catch (e) {
      allResults.push({ platform, error: "เปิดแท็บไม่ได้: " + String(e.message || e) });
      continue;
    }

    try {
      for (const kw of keywords) {
        try {
          await navigateTab(tab.id, PLATFORM_SEARCH[platform](kw));
          // รอ DOM/หน้าโหลด + content script พร้อม (tiktok/lazada โหลดช้ากว่า)
          await new Promise((r) => setTimeout(r, platform === "shopee" ? 1500 : 3500));
          const resp = await chrome.tabs.sendMessage(tab.id, {
            type: "SCRAPE_ONE",
            keyword: kw,
          });
          allResults.push(
            resp?.ok
              ? { platform, keyword: kw, sent: resp.result?.sent ?? 0 }
              : { platform, keyword: kw, error: resp?.error || "ไม่ทราบสาเหตุ" },
          );
        } catch (e) {
          allResults.push({ platform, keyword: kw, error: String(e.message || e) });
        }
      }
    } finally {
      setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 1500);
    }
  }

  await chrome.storage.local.set({ lastRunAt: Date.now(), lastResult: allResults });
  return { ok: true, resp: { results: allResults } };
}

// นำทางแท็บไป URL ใหม่แล้วรอโหลดเสร็จ
async function navigateTab(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  await waitForTabComplete(tabId);
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}
