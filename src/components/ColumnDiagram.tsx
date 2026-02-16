import React from "react";
import { View } from "react-native";
import Svg, { Line, Polygon, Text } from "react-native-svg";
import type { BucklingSupportType } from "../types";

const PIXELS_PER_METER = 36;
const COLUMN_CX = 56;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 28;
/** L = ○ m が切れないよう十分な右余白（L=10 m など2桁でも収まる） */
const MARGIN_RIGHT = 88;
const DIM_TICK = 6;
const SUPPORT_SIZE = 14;
const HATCH_SPACING = 4;
const WALL_THICK = 14;

type Props = {
  supportType: BucklingSupportType;
  L: number;
};

/** 上端・下端の支持を supportType から取得（描画順: 上 → 下） */
function getEnds(
  supportType: BucklingSupportType
): { top: "free" | "pinned" | "fixed"; bottom: "free" | "pinned" | "fixed" } {
  switch (supportType) {
    case "pinned-pinned":
      return { top: "pinned", bottom: "pinned" };
    case "fixed-fixed":
      return { top: "fixed", bottom: "fixed" };
    case "fixed-pinned":
      return { top: "pinned", bottom: "fixed" };
    case "fixed-free":
      return { top: "free", bottom: "fixed" };
  }
}

/** ピン支持（三角形） */
function PinSymbol({
  x,
  y,
  pointingDown,
}: {
  x: number;
  y: number;
  pointingDown: boolean;
}) {
  const h = SUPPORT_SIZE;
  const w = SUPPORT_SIZE * 1.2;
  const points = pointingDown
    ? `${x},${y} ${x - w / 2},${y + h} ${x + w / 2},${y + h}`
    : `${x},${y + h} ${x - w / 2},${y} ${x + w / 2},${y}`;
  return (
    <Polygon
      points={points}
      fill="none"
      stroke="#333"
      strokeWidth={2}
    />
  );
}

/** 固定支持（壁：水平線＋斜めハッチ。構造の図で一般的な表現） */
function FixedSymbol({
  x,
  y,
  isTop,
}: {
  x: number;
  y: number;
  isTop: boolean;
}) {
  const sign = isTop ? -1 : 1;
  const hatchLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i <= WALL_THICK; i += HATCH_SPACING) {
    hatchLines.push({
      x1: x - WALL_THICK + i,
      y1: y,
      x2: x - WALL_THICK + i - 8,
      y2: y + sign * 8,
    });
  }
  return (
    <>
      <Line
        x1={x - WALL_THICK}
        y1={y}
        x2={x + WALL_THICK}
        y2={y}
        stroke="#333"
        strokeWidth={2}
      />
      {hatchLines.map((line, i) => (
        <Line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#555"
          strokeWidth={1}
        />
      ))}
    </>
  );
}

/** 柱の図（支持条件・長さ L・EI 表示）。縦長でスマホに収まる viewBox。 */
export function ColumnDiagram({ supportType, L }: Props) {
  const columnHeight = L * PIXELS_PER_METER;
  const totalHeight = MARGIN_TOP + columnHeight + MARGIN_BOTTOM;
  const totalWidth = COLUMN_CX + MARGIN_RIGHT;

  const yTop = MARGIN_TOP;
  const yBottom = MARGIN_TOP + columnHeight;
  const { top, bottom } = getEnds(supportType);

  const dimLineX = COLUMN_CX + 20;
  const dimLabelY = (yTop + yBottom) / 2;
  const arrowSize = 5;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        {/* 柱（縦線） */}
        <Line
          x1={COLUMN_CX}
          y1={yTop}
          x2={COLUMN_CX}
          y2={yBottom}
          stroke="#333"
          strokeWidth={3}
        />

        {/* 上端支持 */}
        {top === "pinned" && (
          <PinSymbol x={COLUMN_CX} y={yTop} pointingDown={true} />
        )}
        {top === "fixed" && (
          <FixedSymbol x={COLUMN_CX} y={yTop} isTop={true} />
        )}

        {/* 下端支持 */}
        {bottom === "pinned" && (
          <PinSymbol x={COLUMN_CX} y={yBottom} pointingDown={false} />
        )}
        {bottom === "fixed" && (
          <FixedSymbol x={COLUMN_CX} y={yBottom} isTop={false} />
        )}

        {/* 寸法線 L（柱の右側・両端に矢印） */}
        <Line
          x1={dimLineX}
          y1={yTop}
          x2={dimLineX}
          y2={yBottom}
          stroke="#333"
          strokeWidth={1}
        />
        <Polygon
          points={`${dimLineX},${yTop} ${dimLineX - arrowSize},${yTop + arrowSize} ${dimLineX + arrowSize},${yTop + arrowSize}`}
          fill="#333"
          stroke="none"
        />
        <Polygon
          points={`${dimLineX},${yBottom} ${dimLineX - arrowSize},${yBottom - arrowSize} ${dimLineX + arrowSize},${yBottom - arrowSize}`}
          fill="#333"
          stroke="none"
        />
        <Text
          x={dimLineX + 12}
          y={dimLabelY}
          fill="#333"
          fontSize={14}
          textAnchor="start"
        >
          L = {L} m
        </Text>

        {/* EI 表示（柱の左側） */}
        <Text
          x={COLUMN_CX - 8}
          y={dimLabelY}
          fill="#555"
          fontSize={12}
          textAnchor="end"
        >
          EI
        </Text>
      </Svg>
    </View>
  );
}
