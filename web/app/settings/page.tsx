"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconRefresh } from "@/components/ui/icons";

type Keyword = {
  id: number;
  keyword: string;
  label: string | null;
  myShop: string | null;
};

export default function SettingsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [myShopShopee, setMyShopShopee] = useState("");
  const [myShopTiktok, setMyShopTiktok] = useState("");
  const [myShopLazada, setMyShopLazada] = useState("");
  const [newKw, setNewKw] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingShop, setSavingShop] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);

  const reload = useCallback(async () => {
    const [kwRes, setRes] = await Promise.all([
      fetch("/api/keywords").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setKeywords(kwRes.keywords ?? []);
    setMyShopShopee(setRes.myShopShopee ?? "");
    setMyShopTiktok(setRes.myShopTiktok ?? "");
    setMyShopLazada(setRes.myShopLazada ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function saveShop() {
    setSavingShop(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ myShopShopee, myShopTiktok, myShopLazada }),
    });
    setSavingShop(false);
  }

  async function addKeyword() {
    const kw = newKw.trim();
    if (!kw) return;
    setAdding(true);
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyword: kw, label: kw }),
    });
    setNewKw("");
    await reload();
    setAdding(false);
  }

  async function removeKeyword(id: number) {
    if (!confirm("ลบ keyword นี้? (ประวัติราคาของ keyword นี้จะถูกลบด้วย)")) return;
    await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
    await reload();
  }

  async function saveLabel(id: number, label: string) {
    await fetch("/api/keywords", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, label }),
    });
  }

  async function requestScrape() {
    setScraping(true);
    setScrapeMsg(null);
    try {
      await fetch("/api/scrape-request", { method: "POST" });
      setScrapeMsg(
        "ส่งคำสั่งแล้ว ✓ — ถ้า Chrome + Extension เปิดอยู่ จะเริ่มดึงภายใน ~30 วินาที"
      );
    } catch {
      setScrapeMsg("ส่งคำสั่งไม่สำเร็จ");
    }
    setScraping(false);
  }

  return (
    <div>
      <PageHeader
        title="ตั้งค่า"
        subtitle="จัดการ keyword ที่ติดตาม และสั่งดึงข้อมูลจากเว็บได้เลย"
        action={
          <Button onClick={requestScrape} disabled={scraping}>
            <IconRefresh width={16} height={16} />
            {scraping ? "กำลังส่ง…" : "ดึงเดี๋ยวนี้"}
          </Button>
        }
      />

      {scrapeMsg && (
        <div className="mb-6">
          <Card className="border-brand-400/30 bg-gradient-card p-4 text-sm">
            {scrapeMsg}
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ชื่อร้านเรา (แยกต่อ platform) */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="ชื่อร้านของเรา"
            subtitle="ไว้ไฮไลต์ร้านเราในตารางเทียบราคา (ชื่อร้านแต่ละ platform มักไม่เหมือนกัน)"
          />
          <CardBody>
            <label className="muted mb-1 block text-xs text-orange-300">Shopee</label>
            <input
              className="input-field"
              placeholder="เช่น pungklombabyshop"
              value={myShopShopee}
              onChange={(e) => setMyShopShopee(e.target.value)}
            />
            <label className="muted mb-1 mt-3 block text-xs text-pink-200">TikTok Shop</label>
            <input
              className="input-field"
              placeholder="เช่น pungklom.official"
              value={myShopTiktok}
              onChange={(e) => setMyShopTiktok(e.target.value)}
            />
            <label className="muted mb-1 mt-3 block text-xs text-indigo-300">Lazada</label>
            <input
              className="input-field"
              placeholder="เช่น Pungklom Official Store"
              value={myShopLazada}
              onChange={(e) => setMyShopLazada(e.target.value)}
            />
            <Button
              className="mt-4 w-full"
              variant="ghost"
              onClick={saveShop}
              disabled={savingShop}
            >
              {savingShop ? "กำลังบันทึก…" : "บันทึกชื่อร้าน"}
            </Button>
          </CardBody>
        </Card>

        {/* keyword list */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Keyword ที่ติดตาม"
            subtitle="เพิ่มคำค้นที่อยากเทียบราคา (Shopee / TikTok Shop / Lazada)"
            action={<Badge tone="brand">{keywords.length} คำ</Badge>}
          />
          <CardBody>
            {/* เพิ่มใหม่ */}
            <div className="mb-4 flex gap-2">
              <input
                className="input-field"
                placeholder="เช่น GB Pockit+ All Terrain"
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              />
              <Button onClick={addKeyword} disabled={adding || !newKw.trim()}>
                {adding ? "…" : "เพิ่ม"}
              </Button>
            </div>

            {loading ? (
              <div className="muted text-sm">กำลังโหลด…</div>
            ) : keywords.length === 0 ? (
              <EmptyState icon="🏷️" title="ยังไม่มี keyword">
                เพิ่มคำค้นด้านบนเพื่อเริ่มติดตามราคา
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {keywords.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <input
                        className="w-full bg-transparent text-sm font-medium text-white outline-none focus:text-brand-200"
                        defaultValue={k.label ?? k.keyword}
                        onBlur={(e) => saveLabel(k.id, e.target.value)}
                        title="แก้ชื่อแสดงผลแล้วคลิกที่อื่นเพื่อบันทึก"
                      />
                      <div className="muted truncate text-xs">{k.keyword}</div>
                    </div>
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => removeKeyword(k.id)}
                    >
                      ลบ
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* คำอธิบายการทำงาน */}
      <Card className="mt-6 p-5 text-sm leading-relaxed">
        <div className="mb-1 font-semibold">การดึงข้อมูลทำงานยังไง?</div>
        <p className="muted">
          ปุ่ม “ดึงเดี๋ยวนี้” จะ <span className="text-brand-200">ส่งคำสั่งผ่านเว็บ</span>{" "}
          แล้ว Chrome Extension ที่เปิดอยู่จะมารับไปทำงาน (ดึงราคาจาก Shopee ด้วย
          session ของคุณ แล้วส่งกลับเข้าระบบ) — เพราะ Shopee บล็อกการดึงจากเซิร์ฟเวอร์
          โดยตรง จึงต้องให้เบราว์เซอร์ที่ล็อกอินอยู่เป็นคนดึง
          <br />
          <span className="text-amber-300">
            เงื่อนไข: ต้องเปิด Chrome ที่ติดตั้ง Extension ไว้ และล็อกอิน Shopee อยู่
          </span>
        </p>
      </Card>
    </div>
  );
}
