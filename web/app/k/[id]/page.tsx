import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";
import PriceChart from "@/components/PriceChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

type CompareRow = {
  product_id: number;
  shop_name: string | null;
  title: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  sold: number | null;
  rating: number | null;
  rating_count: number | null;
  is_official: boolean | null;
  captured_at: string | null;
};

async function getData(id: number) {
  const kwRows = await sql`SELECT id, keyword, label, my_shop FROM keywords WHERE id = ${id}`;
  if (kwRows.length === 0) return null;
  const kw = kwRows[0];

  const rows = (await sql`
    SELECT
      p.id AS product_id, p.shop_name, p.title, p.image_url, p.product_url,
      s.price, s.sold, s.rating, s.rating_count, s.is_official, s.captured_at
    FROM products p
    JOIN LATERAL (
      SELECT * FROM snapshots s2 WHERE s2.product_id = p.id
      ORDER BY s2.captured_at DESC LIMIT 1
    ) s ON true
    WHERE p.keyword_id = ${id}
    ORDER BY s.price ASC NULLS LAST
  `) as CompareRow[];

  return { kw, rows };
}

function fmt(n: number | null) {
  return n == null ? "-" : Number(n).toLocaleString("th-TH");
}

export default async function KeywordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(Number(id));
  if (!data) notFound();
  const { kw, rows } = data;
  const myShop: string | null = kw.my_shop;

  const labels: Record<number, string> = {};
  rows.forEach((r) => (labels[r.product_id] = r.shop_name || `#${r.product_id}`));

  const minPrice = rows.find((r) => r.price != null)?.price ?? null;

  return (
    <div>
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
        ← กลับ
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-1">{kw.label || kw.keyword}</h1>
      <div className="text-xs text-gray-400 mb-5">
        keyword: {kw.keyword} · {rows.length} ร้าน
        {myShop && <> · ร้านเรา: <span className="text-blue-600">{myShop}</span></>}
      </div>

      {/* กราฟราคาย้อนหลัง */}
      <div className="rounded-lg border bg-white p-4 mb-6">
        <div className="text-sm font-semibold mb-3">ราคาย้อนหลัง 90 วัน</div>
        <PriceChart keywordId={kw.id} labels={labels} />
      </div>

      {/* ตารางเทียบราคา */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">ร้าน / สินค้า</th>
              <th className="px-3 py-2 text-right">ราคา</th>
              <th className="px-3 py-2 text-right">ขายแล้ว</th>
              <th className="px-3 py-2 text-right">เรตติ้ง</th>
              <th className="px-3 py-2 text-center w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMine = !!(myShop && r.shop_name === myShop);
              const isCheapest = r.price != null && r.price === minPrice;
              return (
                <tr
                  key={r.product_id}
                  className={`border-t ${isMine ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.image_url}
                          alt=""
                          className="w-10 h-10 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 border" />
                      )}
                      <div className="min-w-0">
                        <div className="line-clamp-1">{r.title}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          {r.shop_name}
                          {r.is_official && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">
                              Mall
                            </span>
                          )}
                          {isMine && (
                            <span className="text-[10px] bg-blue-600 text-white px-1 rounded">
                              ร้านเรา
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-semibold ${isCheapest ? "text-green-600" : "text-gray-800"}`}
                    >
                      ฿{fmt(r.price)}
                    </span>
                    {isCheapest && (
                      <div className="text-[10px] text-green-600">ถูกสุด</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {fmt(r.sold)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {r.rating != null ? `⭐ ${r.rating}` : "-"}
                    {r.rating_count ? (
                      <div className="text-[10px] text-gray-400">
                        ({r.rating_count})
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.product_url && (
                      <a
                        href={r.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-orange-600 hover:underline"
                      >
                        เปิด
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            ยังไม่มีข้อมูล — เปิด Extension แล้วกด "ดึงเดี๋ยวนี้"
          </div>
        )}
      </div>
    </div>
  );
}
