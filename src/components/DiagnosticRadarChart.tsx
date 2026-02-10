import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text } from "react-native-svg";
import type {
  DiagnosticCategoryStats,
  ProblemCategory,
} from "../types";

const CATEGORIES: ProblemCategory[] = [
  "simple-concentrated",
  "simple-distributed",
  "cantilever-concentrated",
  "cantilever-distributed",
];

const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  "simple-concentrated": "単純×集中",
  "simple-distributed": "単純×分布",
  "cantilever-concentrated": "片持ち×集中",
  "cantilever-distributed": "片持ち×分布",
};

type Props = {
  statsByCategory: Record<ProblemCategory, DiagnosticCategoryStats>;
};

export function DiagnosticRadarChart({ statsByCategory }: Props) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const maxRadius = 80;
  const levels = [0.2, 0.4, 0.6, 0.8, 1];

  const points: { x: number; y: number }[] = CATEGORIES.map((cat, index) => {
    const accuracy = statsByCategory[cat]?.accuracy ?? 0;
    const value = Math.max(0, Math.min(1, accuracy));
    const radius = value * maxRadius;
    const angle = (Math.PI * 2 * index) / CATEGORIES.length - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { x, y };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={{ alignItems: "center", marginVertical: 12 }}>
      <Svg width={size} height={size}>
        {/* グリッド（同心円） */}
        {levels.map((level, idx) => (
          <Circle
            key={`grid-${idx}`}
            cx={cx}
            cy={cy}
            r={maxRadius * level}
            stroke="#ccc"
            strokeWidth={1}
            fill="none"
          />
        ))}

        {/* 軸線 */}
        {CATEGORIES.map((cat, index) => {
          const angle = (Math.PI * 2 * index) / CATEGORIES.length - Math.PI / 2;
          const x = cx + maxRadius * Math.cos(angle);
          const y = cy + maxRadius * Math.sin(angle);
          return (
            <Line
              key={`axis-${cat}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#bbb"
              strokeWidth={1}
            />
          );
        })}

        {/* レーダーポリゴン */}
        <Polygon
          points={polygonPoints}
          fill="rgba(25, 118, 210, 0.25)"
          stroke="#1976d2"
          strokeWidth={2}
        />

        {/* カテゴリラベル */}
        {CATEGORIES.map((cat, index) => {
          const angle = (Math.PI * 2 * index) / CATEGORIES.length - Math.PI / 2;
          const labelRadius = maxRadius + 26;
          const x = cx + labelRadius * Math.cos(angle);
          const y = cy + labelRadius * Math.sin(angle);
          return (
            <Text
              key={`label-${cat}`}
              x={x}
              y={y}
              fill="#333"
              fontSize={11}
              textAnchor="middle"
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          );
        })}

        {/* スケールラベル（右上の凡例） */}
        <Text
          x={size - 8}
          y={14}
          fill="#666"
          fontSize={11}
          textAnchor="end"
        >
          正答率レーダー (%)
        </Text>
      </Svg>
    </View>
  );
}

