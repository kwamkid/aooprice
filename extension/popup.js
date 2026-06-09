// popup — แค่ toggle Auto + ปุ่มดึงเดี๋ยวนี้ + เปิดหน้าตั้งค่าบนเว็บ
// (Backend URL / token เป็นค่า fix ใน config.js · keyword/ชื่อร้านจัดการบนเว็บ)

import { apiBase } from "./config.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const setStatus = (msg) => (statusEl.textContent = msg);

// โหลดค่า Auto + platform ที่เลือก + สถานะล่าสุด
async function load() {
  const sync = await chrome.storage.sync.get([
    "autoEnabled",
    "intervalHours",
    "platforms",
  ]);
  $("autoEnabled").checked = !!sync.autoEnabled;
  $("intervalHours").value = sync.intervalHours || 24;

  // default: เปิดครบทุก platform ถ้ายังไม่เคยตั้ง
  const pf = sync.platforms || { shopee: true, tiktok: true, lazada: true };
  $("pf-shopee").checked = pf.shopee !== false;
  $("pf-tiktok").checked = pf.tiktok !== false;
  $("pf-lazada").checked = pf.lazada !== false;

  const local = await chrome.storage.local.get(["lastRunAt"]);
  if (local.lastRunAt) {
    const ago = Math.round((Date.now() - local.lastRunAt) / 60000);
    setStatus(`ดึงล่าสุด: ${ago} นาทีที่แล้ว`);
  }
}

// เปิดหน้าตั้งค่าบนเว็บ
$("openWeb").onclick = () => {
  chrome.tabs.create({ url: apiBase() + "/settings" });
};

// บันทึกค่า Auto + platform ที่เลือก
$("save").onclick = async () => {
  await chrome.storage.sync.set({
    autoEnabled: $("autoEnabled").checked,
    intervalHours: Number($("intervalHours").value) || 24,
    platforms: {
      shopee: $("pf-shopee").checked,
      tiktok: $("pf-tiktok").checked,
      lazada: $("pf-lazada").checked,
    },
  });
  await chrome.runtime.sendMessage({ type: "SYNC_ALARM" });
  setStatus("บันทึกแล้ว ✓" + ($("autoEnabled").checked ? " · Auto เปิด" : ""));
};

// ดึงเดี๋ยวนี้ (ผ่าน background -> content script บนแท็บ Shopee)
$("runNow").onclick = async () => {
  setStatus("กำลังดึง… (ต้องมีแท็บ Shopee หรือจะเปิดให้อัตโนมัติ)");
  $("runNow").disabled = true;
  try {
    const resp = await chrome.runtime.sendMessage({ type: "RUN_NOW" });
    if (resp?.ok) {
      const results = resp.resp?.resp?.results || resp.resp?.results || [];
      const tag = (r) => (r.platform ? `[${r.platform}] ` : "");
      const lines = (results || []).map((r) =>
        r.error
          ? `✗ ${tag(r)}${r.keyword || ""}: ${r.error}`
          : `✓ ${tag(r)}${r.keyword}: ${r.sent} รายการ`,
      );
      setStatus(lines.join("\n") || "เสร็จ");
    } else {
      setStatus("ผิดพลาด: " + (resp?.error || "ไม่ทราบสาเหตุ"));
    }
  } catch (e) {
    setStatus("ผิดพลาด: " + (e.message || e));
  }
  $("runNow").disabled = false;
};

load();
