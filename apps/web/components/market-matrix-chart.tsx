"use client";

import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RechartsTooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { getMessages } from "@/lib/i18n";

export type MatrixPoint = {
  id: string;
  name: string;
  code: string;
  opportunity: number;
  confidence: number;
  quadrant: number;
  color: string;
};

type MarketMatrixChartProps = {
  matrixData: MatrixPoint[];
  selectedId: string;
  onSelectId: (id: string) => void;
  t: ReturnType<typeof getMessages>;
  number: Intl.NumberFormat;
};

export function MarketMatrixChart({
  matrixData,
  selectedId,
  onSelectId,
  t,
  number,
}: MarketMatrixChartProps) {
  return (
    <div className="w-full" style={{ height: 280, minHeight: 280 }}>
      <ResponsiveContainer width="100%" height={280} minHeight={280} initialDimension={{ width: 800, height: 280 }}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
          <XAxis
            type="number"
            dataKey="confidence"
            name={t.confidence}
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "#82918c" }}
          />
          <YAxis
            type="number"
            dataKey="opportunity"
            name={t.opportunity}
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#82918c" }}
          />
          <ZAxis range={[220, 220]} />
          <ReferenceLine x={60} stroke="#cbd5e1" strokeDasharray="3 3" />
          <ReferenceLine y={65} stroke="#cbd5e1" strokeDasharray="3 3" />
          <RechartsTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const data = payload[0].payload as MatrixPoint;
              return (
                <div className="rounded-xl border border-[#dfe9e5] bg-white p-3 shadow-lg text-xs">
                  <p className="font-bold text-[#182623]">{data.name} ({data.code})</p>
                  <p className="text-[#087e6b] mt-1 font-semibold">{t.opportunity}: {number.format(data.opportunity)}/100</p>
                  <p className="text-[#4b635c] font-semibold">{t.confidence}: {number.format(data.confidence)}%</p>
                </div>
              );
            }}
          />
          <Scatter
            data={matrixData}
            onClick={(entry: unknown) => {
              const point = entry as { id?: string; payload?: { id?: string } } | undefined;
              const id = point?.id ?? point?.payload?.id;
              if (id) onSelectId(id);
            }}
            className="cursor-pointer"
          >
            {matrixData.map((entry) => (
              <Cell
                key={`cell-${entry.id}`}
                fill={selectedId === entry.id ? "#182623" : entry.color}
                stroke={selectedId === entry.id ? "#087e6b" : "transparent"}
                strokeWidth={3}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
