// popup — ตั้งค่า + ปุ่มดึงเดี๋ยวนี้ (manual)

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg) {
  statusEl.textContent = msg;
}

// โหลดค่าเดิม
async function load() {
  const sync = await chrome.storage.sync.get([
    "backendUrl",
    "ingestToken",
    "myShop",
    "keywords",
    "autoEnabled",
    "intervalHours",
  ]);
  $("backendUrl").value = sync.backendUrl || "";
  $("ingestToken").value = sync.ingestToken || "";
  $("myShop").value = sync.myShop || "";
  $("keywords").value = (sync.keywords || []).join("\n");
  $("autoEnabled").checked = !!sync.autoEnabled;
  $("intervalHours").value = sync.intervalHours || 24;

  const local = await chrome.storage.local.get(["lastRunAt", "lastResult"]);
  if (local.lastRunAt) {
    const ago = Math.round((Date.now() - local.lastRunAt) / 60000);
    setStatus(`ดึงล่าสุด: ${ago} นาทีที่แล้ว`);
  }
}

// บันทึก
$("save").onclick = async () => {
  const keywords = $("keywords")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  await chrome.storage.sync.set({
    backendUrl: $("backendUrl").value.trim(),
    ingestToken: $("ingestToken").value.trim(),
    myShop: $("myShop").value.trim(),
    keywords,
    autoEnabled: $("autoEnabled").checked,
    intervalHours: Number($("intervalHours").value) || 24,
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
      const lines = (results || []).map((r) =>
        r.error ? `✗ ${r.keyword}: ${r.error}` : `✓ ${r.keyword}: ${r.sent} รายการ`,
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
