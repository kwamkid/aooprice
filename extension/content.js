// Content script — รันบน shopee.co.th
// หน้าที่: (1) ดึงข้อมูลตาม keyword ผ่าน internal API ด้วย session ผู้ใช้
//          (2) ส่งเข้า backend  (3) inject ปุ่ม "Rescan" ลอยมุมจอ
// รับคำสั่งดึงจาก background (auto/alarm) และจากปุ่ม (manual) ผ่านโค้ดเดียวกัน

(async () => {
  const { fetchShopeeItems } = await import(
    chrome.runtime.getURL("lib/shopee-api.js")
  );

  // ดึง 1 keyword แล้วส่งเข้า backend
  async function scrapeKeyword(keyword) {
    const cfg = await chrome.storage.sync.get(["backendUrl", "ingestToken", "myShop"]);
    if (!cfg.backendUrl || !cfg.ingestToken) {
      throw new Error("ยังไม่ได้ตั้งค่า backend URL / token ใน popup");
    }

    const items = await fetchShopeeItems(keyword, { maxItems: 60 });
    if (items.length === 0) throw new Error("ไม่พบสินค้า (อาจโดน anti-bot)");

    const res = await fetch(
      cfg.backendUrl.replace(/\/$/, "") + "/api/ingest",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + cfg.ingestToken,
        },
        body: JSON.stringify({
          keyword,
          label: keyword,
          myShop: cfg.myShop || null,
          items,
        }),
      },
    );
    if (!res.ok) throw new Error("ingest HTTP " + res.status);
    const json = await res.json();

    await chrome.storage.local.set({ lastRunAt: Date.now() });
    return { keyword, sent: items.length, result: json };
  }

  // ดึงทุก keyword ที่ตั้งไว้ (เรียกโดย background ตอน alarm หรือปุ่ม "ดึงทั้งหมด")
  async function scrapeAll() {
    const { keywords = [] } = await chrome.storage.sync.get("keywords");
    const results = [];
    for (const kw of keywords) {
      try {
        results.push(await scrapeKeyword(kw));
      } catch (e) {
        results.push({ keyword: kw, error: String(e.message || e) });
      }
      await new Promise((r) => setTimeout(r, 1500)); // หน่วงระหว่าง keyword
    }
    return results;
  }

  // ฟังคำสั่งจาก background / popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SCRAPE_ALL") {
      scrapeAll()
        .then((r) => sendResponse({ ok: true, results: r }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
      return true; // async response
    }
    if (msg.type === "SCRAPE_ONE") {
      scrapeKeyword(msg.keyword)
        .then((r) => sendResponse({ ok: true, result: r }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
      return true;
    }
  });

  // ---- inject ปุ่ม Rescan ลอย ----
  function injectButton() {
    if (document.getElementById("aooprice-rescan")) return;
    const btn = document.createElement("button");
    btn.id = "aooprice-rescan";
    btn.textContent = "⟳ aooprice Rescan";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "999999",
      background: "#f97316",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,.2)",
    });
    btn.onclick = async () => {
      const kwParam = new URLSearchParams(location.search).get("keyword");
      const keyword = kwParam || prompt("ดึง keyword:");
      if (!keyword) return;
      btn.textContent = "⏳ กำลังดึง…";
      btn.disabled = true;
      try {
        const r = await scrapeKeyword(keyword);
        btn.textContent = `✓ ส่ง ${r.sent} รายการ`;
      } catch (e) {
        btn.textContent = "✗ " + (e.message || e);
      }
      setTimeout(() => {
        btn.textContent = "⟳ aooprice Rescan";
        btn.disabled = false;
      }, 3000);
    };
    document.body.appendChild(btn);
  }

  injectButton();
})();
