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
  "#9168ff", "#22d3ee", "#34d399", "#f472b6", "#a78bfa",
  "#38bdf8", "#fbbf24", "#fb7185", "#818cf8", "#2dd4bf",
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

  if (loading)
    return <div className="text-sm text-[var(--muted)]">กำลังโหลดกราฟ…</div>;
  if (data.length === 0)
    return (
      <div className="text-sm text-[var(--muted)]">ยังไม่มีประวัติราคาเพียงพอ</div>
    );

  const axisColor = "#9890b8";
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
        <XAxis dataKey="day" fontSize={12} stroke={axisColor} tickLine={false} />
        <YAxis
          fontSize={12}
          stroke={axisColor}
          tickLine={false}
          tickFormatter={(v) => "฿" + (v / 1000).toFixed(0) + "k"}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(v: number) => "฿" + Number(v).toLocaleString("th-TH")}
          contentStyle={{
            background: "#150f2b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#ece9f5",
            fontSize: 12,
          }}
          labelStyle={{ color: "#9890b8" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9890b8" }} />
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
