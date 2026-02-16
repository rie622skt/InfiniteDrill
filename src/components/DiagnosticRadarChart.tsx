import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text } from "react-native-svg";
import type {
  DiagnosticCategoryStats,
  ProblemCategory,
} from "../types";

/** レーダー軸用の短いラベル（全カテゴリ） */
const RADAR_SHORT_LABELS: Record<ProblemCategory, string> = {
  "simple-concentrated": "単純×集中",
  "simple-distributed": "単純×分布",
  "cantilever-concentrated": "片持ち×集中",
  "cantilever-distributed": "片持ち×分布",
  "overhang-concentrated": "張り出し×集中",
  "overhang-distributed": "張り出し×分布",
  "section-properties": "断面",
  "bending-stress": "曲げ応力",
  "buckling": "座屈",
  "truss-zero": "トラス零",
  "truss-calculation": "トラス軸力",
  "frame": "ラーメン",
  "deflection": "たわみ",
};

type Props = {
  /** レーダーに表示するカテゴリ（3または4推奨。可読性のため） */
  categories: readonly ProblemCategory[];
  statsByCategory: Record<ProblemCategory, DiagnosticCategoryStats>;
};

export function DiagnosticRadarChart({ categories, statsByCategory }: Props) {
  const n = categories.length;
  if (n < 2) return null;

  const size = 260;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const maxRadius = 80;
  const levels = [0.2, 0.4, 0.6, 0.8, 1];

  const points: { x: number; y: number }[] = categories.map((cat, index) => {
    const accuracy = statsByCategory[cat]?.accuracy ?? 0;
    const value = Math.max(0, Math.min(1, accuracy));
    const radius = value * maxRadius;
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { x, y };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={{ alignItems: "center", marginVertical: 12 }}>
      <Svg width={size} height={size}>
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
        {categories.map((cat, index) => {
          const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
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
        <Polygon
          points={polygonPoints}
          fill="rgba(25, 118, 210, 0.25)"
          stroke="#1976d2"
          strokeWidth={2}
        />
        {categories.map((cat, index) => {
          const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
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
              {RADAR_SHORT_LABELS[cat]}
            </Text>
          );
        })}
        <Text x={size - 8} y={14} fill="#666" fontSize={11} textAnchor="end">
          正答率レーダー (%)
        </Text>
      </Svg>
    </View>
  );
}
