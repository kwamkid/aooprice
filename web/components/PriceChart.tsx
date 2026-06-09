"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type SeriesPoint = { productId: number; day: string; price: number | null };

const COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f59e0b", "#6366f1", "#84cc16",
];

export default function PriceChart({
  keywordId,
  labels,
}: {
  keywordId: number;
  labels: Record<number, string>; // productId -> ชื่อร้าน
}) {
  const [data, setData] = useState<Record<string, number | string>[]>([]);
  const [pids, setPids] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/history?keywordId=${keywordId}&days=90`)
      .then((r) => r.json())
      .then((j: { series: SeriesPoint[] }) => {
        // pivot: แต่ละวันเป็น 1 แถว, แต่ละ product เป็น 1 คอลัมน์
        const byDay: Record<string, Record<string, number | string>> = {};
        const seen = new Set<number>();
        for (const p of j.series) {
          const day = new Date(p.day).toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
          });
          byDay[day] ??= { day };
          if (p.price != null) byDay[day][`p${p.productId}`] = p.price;
          seen.add(p.productId);
        }
        setData(Object.values(byDay));
        setPids([...seen]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [keywordId]);

  if (loading) return <div className="text-sm text-gray-400">กำลังโหลดกราฟ…</div>;
  if (data.length === 0)
    return <div className="text-sm text-gray-400">ยังไม่มีประวัติราคาเพียงพอ</div>;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis
          fontSize={12}
          tickFormatter={(v) => "฿" + (v / 1000).toFixed(0) + "k"}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(v: number) => "฿" + Number(v).toLocaleString("th-TH")}
        />
        <Legend />
        {pids.map((pid, i) => (
          <Line
            key={pid}
            type="monotone"
            dataKey={`p${pid}`}
            name={labels[pid] || `#${pid}`}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
