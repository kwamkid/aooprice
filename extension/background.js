// Background service worker — จัดการ AUTO (chrome.alarms) + catch-up
// การดึงจริงเกิดใน content script (ต้องอยู่บนแท็บ shopee.co.th เพื่อใช้ session)
// background จึงทำหน้าที่: ตั้ง alarm, หา/เปิดแท็บ Shopee, สั่ง content script ให้ดึง

const ALARM = "aooprice-scrape";

// สร้าง/อัพเดท alarm ตามค่าที่ผู้ใช้ตั้งใน popup
async function syncAlarm() {
  const cfg = await chrome.storage.sync.get(["autoEnabled", "intervalHours"]);
  await chrome.alarms.clear(ALARM);
  if (cfg.autoEnabled) {
    const hours = Math.max(1, Number(cfg.intervalHours) || 24);
    chrome.alarms.create(ALARM, {
      periodInMinutes: hours * 60,
      delayInMinutes: 1,
    });
  }
}

chrome.runtime.onInstalled.addListener(syncAlarm);
chrome.runtime.onStartup.addListener(async () => {
  await syncAlarm();
  await catchUpIfMissed();
});

// popup แจ้งว่าตั้งค่าเปลี่ยน -> sync alarm ใหม่
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === "SYNC_ALARM") {
    syncAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "RUN_NOW") {
    runScrape().then((r) => sendResponse(r)).catch((e) =>
      sendResponse({ ok: false, error: String(e.message || e) }),
    );
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) runScrape();
});

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

// หา/เปิดแท็บ Shopee แล้วสั่ง content script ให้ดึงทุก keyword
async function runScrape() {
  const tabs = await chrome.tabs.query({ url: "https://shopee.co.th/*" });
  let tab = tabs[0];
  let createdTab = false;

  if (!tab) {
    // เปิดแท็บ Shopee แบบ background (ไม่ขโมย focus)
    tab = await chrome.tabs.create({
      url: "https://shopee.co.th/",
      active: false,
    });
    createdTab = true;
    // รอให้หน้าโหลด + content script พร้อม
    await waitForTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, 3000));
  }

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_ALL" });
    await chrome.storage.local.set({
      lastRunAt: Date.now(),
      lastResult: resp,
    });
    if (createdTab) {
      // ปิดแท็บที่เราเปิดเองหลังเสร็จ
      setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 2000);
    }
    return { ok: true, resp };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
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
    // กันค้าง
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}
