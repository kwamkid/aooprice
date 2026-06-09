// Content script — รันบน shopee.co.th / *.tiktok.com / *.lazada.co.th
// หน้าที่: (1) ดึงข้อมูลตาม keyword ผ่าน API/DOM ของ platform นั้น ด้วย session ผู้ใช้
//          (2) ส่งเข้า backend  (3) inject ปุ่ม "Rescan" ลอยมุมจอ
// รับคำสั่งดึงจาก background (auto/alarm/คิวจากเว็บ) และจากปุ่ม (manual) ผ่านโค้ดเดียวกัน
//
// ⚙️ ค่า backend URL / token เป็นค่า fix ใน config.js (ไม่กรอกใน popup แล้ว)
// 📋 keyword list + ชื่อร้านเรา ดึงจากเว็บ (/api/keywords, /api/settings) ไม่ใช่ chrome.storage

(async () => {
  // ระบุ platform จาก hostname ของหน้าปัจจุบัน
  function detectPlatform() {
    const h = location.hostname;
    if (h.includes("tiktok.com")) return "tiktok";
    if (h.includes("lazada.co.th")) return "lazada";
    return "shopee";
  }
  const PLATFORM = detectPlatform();

  // โหลด fetcher ของ platform ปัจจุบัน + config (โหลดเฉพาะตัวที่ใช้)
  const { CONFIG, apiBase } = await import(chrome.runtime.getURL("config.js"));
  const FETCHER_MODULE = {
    shopee: "lib/shopee-api.js",
    tiktok: "lib/tiktok-api.js",
    lazada: "lib/lazada-api.js",
  }[PLATFORM];
  const FETCHER_FN = {
    shopee: "fetchShopeeItems",
    tiktok: "fetchTiktokItems",
    lazada: "fetchLazadaItems",
  }[PLATFORM];
  const mod = await import(chrome.runtime.getURL(FETCHER_MODULE));
  const fetchItems = mod[FETCHER_FN];

  const authHeader = "Bearer " + CONFIG.INGEST_TOKEN;

  // อ่าน keyword จาก URL ปัจจุบัน (param ต่าง platform: shopee=keyword, อื่น=q)
  function keywordFromUrl() {
    const p = new URLSearchParams(location.search);
    return p.get("keyword") || p.get("q");
  }

  // ดึงรายการ keyword + ชื่อร้านเรา (ต่อ platform) จากเว็บ (แหล่งความจริงเดียว)
  async function fetchConfig() {
    const base = apiBase();
    const [kwRes, setRes] = await Promise.all([
      fetch(base + "/api/keywords").then((r) => r.json()),
      fetch(base + "/api/settings").then((r) => r.json()).catch(() => ({})),
    ]);
    const keywords = (kwRes.keywords || []).map((k) => k.keyword);
    return {
      keywords,
      myShopShopee: setRes.myShopShopee ?? setRes.myShop ?? null,
      myShopTiktok: setRes.myShopTiktok ?? null,
      myShopLazada: setRes.myShopLazada ?? null,
    };
  }

  // ดึง 1 keyword (บน platform ปัจจุบัน) แล้วส่งเข้า backend
  async function scrapeKeyword(keyword, shops) {
    const items = await fetchItems(keyword, { maxItems: CONFIG.MAX_ITEMS });
    if (items.length === 0)
      throw new Error(`[${PLATFORM}] ไม่พบสินค้า (อาจโดน anti-bot หรืออยู่ผิดหน้า)`);

    const res = await fetch(apiBase() + "/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: authHeader },
      body: JSON.stringify({
        keyword,
        label: keyword,
        myShopShopee: shops?.myShopShopee ?? null,
        myShopTiktok: shops?.myShopTiktok ?? null,
        myShopLazada: shops?.myShopLazada ?? null,
        items, // แต่ละ item มี platform ติดมาจาก fetcher แล้ว
      }),
    });
    if (!res.ok) throw new Error("ingest HTTP " + res.status);
    const json = await res.json();

    await chrome.storage.local.set({ lastRunAt: Date.now() });
    return { platform: PLATFORM, keyword, sent: items.length, result: json };
  }

  // ดึงทุก keyword บน platform ปัจจุบัน (Shopee ใช้ API จึงดึงได้ในหน้าเดียว)
  // สำหรับ tiktok/lazada ที่พึ่ง DOM — background จะพาแท็บไปหน้า search แต่ละ keyword
  // แล้วสั่ง SCRAPE_ONE ทีละคำ (ไม่ใช้ลูปนี้)
  async function scrapeAll() {
    const cfg = await fetchConfig();
    if (cfg.keywords.length === 0) {
      return [{ error: "ยังไม่มี keyword — เพิ่มในหน้าตั้งค่าบนเว็บก่อน" }];
    }
    const results = [];
    for (const kw of cfg.keywords) {
      try {
        results.push(await scrapeKeyword(kw, cfg));
      } catch (e) {
        results.push({ platform: PLATFORM, keyword: kw, error: String(e.message || e) });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return results;
  }

  // ฟังคำสั่งจาก background / popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SCRAPE_ALL") {
      scrapeAll()
        .then((r) => sendResponse({ ok: true, platform: PLATFORM, results: r }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
      return true; // async response
    }
    if (msg.type === "SCRAPE_ONE") {
      fetchConfig()
        .then((cfg) => scrapeKeyword(msg.keyword, cfg))
        .then((r) => sendResponse({ ok: true, result: r }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
      return true;
    }
  });

  // ---- inject ปุ่ม Rescan ลอย ----
  const PLATFORM_LABEL = { shopee: "Shopee", tiktok: "TikTok", lazada: "Lazada" }[PLATFORM];
  function injectButton() {
    if (document.getElementById("aooprice-rescan")) return;
    const btn = document.createElement("button");
    btn.id = "aooprice-rescan";
    btn.textContent = `⟳ aooprice (${PLATFORM_LABEL})`;
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "999999",
      background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      padding: "10px 14px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(124,58,237,.4)",
    });
    btn.onclick = async () => {
      const kwParam = keywordFromUrl();
      btn.textContent = "⏳ กำลังดึง…";
      btn.disabled = true;
      try {
        if (kwParam) {
          const cfg = await fetchConfig();
          const r = await scrapeKeyword(kwParam, cfg);
          btn.textContent = `✓ ส่ง ${r.sent} รายการ`;
        } else {
          const rs = await scrapeAll();
          const sent = rs.reduce((s, r) => s + (r.sent || 0), 0);
          btn.textContent = `✓ ส่งรวม ${sent} รายการ`;
        }
      } catch (e) {
        btn.textContent = "✗ " + (e.message || e);
      }
      setTimeout(() => {
        btn.textContent = `⟳ aooprice (${PLATFORM_LABEL})`;
        btn.disabled = false;
      }, 3000);
    };
    document.body.appendChild(btn);
  }

  injectButton();
})();
