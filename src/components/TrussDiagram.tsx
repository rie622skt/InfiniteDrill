import React from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text } from "react-native-svg";
import type { TrussPattern } from "../types";

const SCALE = 32;
const MARGIN = 24;
const NODE_R = 5;
const ARROW_H = 12;
const ARROW_W = 6;
const DIM_TICK = 5;
const SUPPORT_H = 14;
/** 図の大きさを統一するための描画用基準L（viewBoxはこれで固定。寸法ラベルのみ問題のLを使用） */
const L_DISPLAY = 5;
/** 高さ寸法付きトラス（片持ち・プラット）の左シフト量 */
const SHIFT_LEFT = 48;
/** トラス軸力計算の表示倍率（viewBoxは不変で出力のみ縮小） */
const DIAGRAM_SIZE_SCALE = 0.88;
/** 片持ちトラスは viewBox 幅が大きいため scale が効いて小さく見える。他図と同程度の見た目にする補正。 */
const CANTILEVER_DIAGRAM_SIZE_SCALE = 1.15;

type Props = {
  pattern: TrussPattern;
  P: number;
  L: number;
  targetMember: string;
};

/**
 * 静定トラスの図示要件（構造力学の慣例）:
 * - 反力3つで静定 → 左ピン（反力2）＋右ローラー（反力1）
 * - ピン支点: 三角形のみ。下線は引かない（地盤線はローラー側のみ）
 * - ローラー支点: 縦材＋下線（転がり面）＋円2つ。下線は「どちらか一方」= ローラー側にのみ描く
 */

/** 山形トラス（simple-triangle）: 底辺 2L、高さ L（45°）、頂点に荷重 */
function SimpleTriangleTruss({
  P,
  L,
  targetMember,
  maxWidth,
  sizeScale = 1,
}: {
  P: number;
  L: number;
  targetMember: string;
  maxWidth?: number;
  sizeScale?: number;
}) {
  const dimHX = MARGIN - 2;
  const leftX = MARGIN + 22;
  const rightX = leftX + 2 * L_DISPLAY * SCALE;
  const apexX = leftX + L_DISPLAY * SCALE;
  const triangleHeight = L_DISPLAY * SCALE;
  const baseY = MARGIN + triangleHeight + 22;
  const apexY = baseY - triangleHeight;
  const w = 22 + 2 * L_DISPLAY * SCALE + MARGIN * 2 + 26;
  const h = baseY + MARGIN + SUPPORT_H + 44;
  const isBottom = targetMember === "A" || targetMember === "底辺";
  const scale = maxWidth != null && w > maxWidth ? maxWidth / w : 1;
  const svgW = scale * w * sizeScale;
  const svgH = scale * h * sizeScale;

  return (
    <Svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 部材: 底辺・左斜材・右斜材（全同じ strokeWidth で節点がずれないようにする） */}
      <Line
        x1={leftX}
        y1={baseY}
        x2={rightX}
        y2={baseY}
        stroke={isBottom ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line
        x1={leftX}
        y1={baseY}
        x2={apexX}
        y2={apexY}
        stroke="#333"
        strokeWidth={2}
      />
      <Line
        x1={rightX}
        y1={baseY}
        x2={apexX}
        y2={apexY}
        stroke="#333"
        strokeWidth={2}
      />
      {/* 節点 */}
      <Circle cx={leftX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={rightX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={apexX} cy={apexY} r={NODE_R} fill="#333" />
      {/* 荷重（頂点に下向き。建築図法: 作用点から力の向きに矢印、矢尻は下向き） */}
      <Line
        x1={apexX}
        y1={apexY + NODE_R}
        x2={apexX}
        y2={apexY + NODE_R + ARROW_H}
        stroke="#333"
        strokeWidth={2}
      />
      <Polygon
        points={`${apexX},${apexY + NODE_R + ARROW_H + 4} ${apexX - ARROW_W},${apexY + NODE_R + ARROW_H} ${apexX + ARROW_W},${apexY + NODE_R + ARROW_H}`}
        fill="#333"
      />
      {/* 荷重ラベル: 矢印の直下。右にずらして矢印と揃える */}
      <Text
        x={apexX + 28}
        y={apexY + NODE_R + ARROW_H + 26}
        fill="#333"
        fontSize={16}
        textAnchor="end"
      >
        P={P}kN
      </Text>
      {/* 支点: 左ピン／右ローラー（三角の色・形を同じに。下線は右ローラーのみ） */}
      <Line
        x1={leftX - 8}
        y1={baseY}
        x2={leftX + 8}
        y2={baseY}
        stroke="#333"
        strokeWidth={2}
      />
      <Polygon
        points={`${leftX},${baseY} ${leftX - 10},${baseY + SUPPORT_H} ${leftX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={rightX - 8} y1={baseY} x2={rightX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${rightX},${baseY} ${rightX - 10},${baseY + SUPPORT_H} ${rightX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={rightX - 12}
        y1={baseY + SUPPORT_H + 4}
        x2={rightX + 12}
        y2={baseY + SUPPORT_H + 4}
        stroke="#333"
        strokeWidth={1}
      />
      {/* 寸法: スパン 2L（2L= ラベルを右にずらして見やすく） */}
      <Line
        x1={leftX}
        y1={baseY + SUPPORT_H + 12}
        x2={rightX}
        y2={baseY + SUPPORT_H + 12}
        stroke="#555"
        strokeWidth={1}
      />
      <Line x1={leftX} y1={baseY + SUPPORT_H + 12 - DIM_TICK} x2={leftX} y2={baseY + SUPPORT_H + 12 + DIM_TICK} stroke="#555" strokeWidth={1} />
      <Line x1={rightX} y1={baseY + SUPPORT_H + 12 - DIM_TICK} x2={rightX} y2={baseY + SUPPORT_H + 12 + DIM_TICK} stroke="#555" strokeWidth={1} />
      <Text
        x={(leftX + rightX) / 2 + 36}
        y={baseY + SUPPORT_H + 12 + 18}
        fill="#555"
        fontSize={16}
        textAnchor="middle"
      >
        2L = {2 * L} m
      </Text>
      {/* 寸法: 高さ h = L（斜材45°の条件を図で明示） */}
      <Line
        x1={dimHX}
        y1={apexY}
        x2={dimHX}
        y2={baseY}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={dimHX - DIM_TICK}
        y1={apexY}
        x2={dimHX + DIM_TICK}
        y2={apexY}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={dimHX - DIM_TICK}
        y1={baseY}
        x2={dimHX + DIM_TICK}
        y2={baseY}
        stroke="#555"
        strokeWidth={1}
      />
      <Text
        x={dimHX + 4}
        y={(apexY + baseY) / 2}
        fill="#555"
        fontSize={16}
        textAnchor="start"
      >
        h={L}m
      </Text>
      {isBottom && (
        <Text
          x={(leftX + rightX) / 2}
          y={baseY - 8}
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
    </Svg>
  );
}

/** ゼロメンバー用: L字節点に3部材が接続。同一直線上にある2本以外の1本がゼロメンバー（部材A＝L字→右下） */
function ZeroMemberTruss({
  P,
  L,
  targetMember,
  maxWidth,
  sizeScale = 1,
}: {
  P: number;
  L: number;
  targetMember: string;
  maxWidth?: number;
  sizeScale?: number;
}) {
  const offsetX = 28;
  const w = 2 * L_DISPLAY * SCALE + MARGIN * 2 + 68;
  const h =
    MARGIN +
    SUPPORT_H +
    Math.ceil(1.2 * L_DISPLAY * SCALE) +
    MARGIN +
    SUPPORT_H +
    24;
  const baseY = h - MARGIN - SUPPORT_H;
  const leftX = MARGIN + offsetX;
  const rightX = leftX + 2 * L_DISPLAY * SCALE;
  const midX = leftX + L_DISPLAY * SCALE;
  const topRightX = rightX;
  const lNodeX = midX;
  const lNodeY = baseY - L_DISPLAY * 0.6 * SCALE;
  const leftDiagDy = lNodeY - baseY;
  const leftDiagDx = lNodeX - leftX;
  const topRightY = lNodeY + (leftDiagDy / leftDiagDx) * (topRightX - lNodeX);
  const isTarget = targetMember === "A";
  const scale = maxWidth != null && w > maxWidth ? maxWidth / w : 1;
  const svgW = scale * w * sizeScale;
  const svgH = scale * h * sizeScale;

  return (
    <Svg width={svgW} height={svgH} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {/* 部材。部材A＝L字節点→右下（ゼロメンバー）。左斜材とL字→右上は同一直線上 */}
      <Line x1={leftX} y1={baseY} x2={rightX} y2={baseY} stroke="#333" strokeWidth={2} />
      <Line x1={leftX} y1={baseY} x2={lNodeX} y2={lNodeY} stroke="#333" strokeWidth={2} />
      <Line
        x1={lNodeX}
        y1={lNodeY}
        x2={topRightX}
        y2={topRightY}
        stroke="#333"
        strokeWidth={2}
      />
      <Line
        x1={lNodeX}
        y1={lNodeY}
        x2={rightX}
        y2={baseY}
        stroke={isTarget ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line x1={rightX} y1={baseY} x2={topRightX} y2={topRightY} stroke="#333" strokeWidth={2} />
      {/* 節点 */}
      <Circle cx={leftX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={rightX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={lNodeX} cy={lNodeY} r={NODE_R} fill="#333" />
      <Circle cx={topRightX} cy={topRightY} r={NODE_R} fill="#333" />
      {/* 荷重（右上節点に下向き） */}
      <Line
        x1={topRightX}
        y1={topRightY + NODE_R}
        x2={topRightX}
        y2={topRightY + NODE_R + ARROW_H}
        stroke="#333"
        strokeWidth={2}
      />
      <Polygon
        points={`${topRightX},${topRightY + NODE_R + ARROW_H + 4} ${topRightX - ARROW_W},${topRightY + NODE_R + ARROW_H} ${topRightX + ARROW_W},${topRightY + NODE_R + ARROW_H}`}
        fill="#333"
      />
      <Text
        x={topRightX - 50}
        y={topRightY + NODE_R + ARROW_H - 12}
        fill="#333"
        fontSize={16}
        textAnchor="end"
      >
        P={P}kN
      </Text>
      {/* 支点: 左ピン／右ローラー（三角の色・形を同じに。下線は右ローラーのみ） */}
      <Line x1={leftX - 8} y1={baseY} x2={leftX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${leftX},${baseY} ${leftX - 10},${baseY + SUPPORT_H} ${leftX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={rightX - 8} y1={baseY} x2={rightX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${rightX},${baseY} ${rightX - 10},${baseY + SUPPORT_H} ${rightX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={rightX - 12}
        y1={baseY + SUPPORT_H + 4}
        x2={rightX + 12}
        y2={baseY + SUPPORT_H + 4}
        stroke="#333"
        strokeWidth={1}
      />
      {isTarget && (
        <Text
          x={(lNodeX + rightX) / 2 + 8}
          y={(lNodeY + baseY) / 2 - 14}
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
    </Svg>
  );
}

/** ゼロメンバー用（T字節点）: 直線上に2部材、その節点に1部材が交接。外力なしならその1部材の軸力は0。部材A＝T字の縦棒。 */
function ZeroMemberTTruss({
  P,
  L,
  targetMember,
  maxWidth,
  sizeScale = 1,
}: {
  P: number;
  L: number;
  targetMember: string;
  maxWidth?: number;
  sizeScale?: number;
}) {
  const offsetX = 28;
  const span = 2 * L_DISPLAY * SCALE;
  const w = span + MARGIN * 2 + 68;
  const topY = MARGIN + 24;
  const tNodeY = topY + L_DISPLAY * 0.5 * SCALE;
  const baseY = tNodeY + L_DISPLAY * 0.55 * SCALE;
  const bottomY = baseY + L_DISPLAY * 0.45 * SCALE;
  const h = bottomY + SUPPORT_H + ARROW_H + 40 + MARGIN;
  const leftX = MARGIN + offsetX;
  const rightX = leftX + span;
  const midX = leftX + L_DISPLAY * SCALE;
  const isTarget = targetMember === "A";
  const scale = maxWidth != null && w > maxWidth ? maxWidth / w : 1;
  const svgW = scale * w * sizeScale;
  const svgH = scale * h * sizeScale;

  return (
    <Svg width={svgW} height={svgH} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {/* 上弦: 左−T節点−右（同一直線上の2部材）。T節点から下に部材A（ゼロメンバー）。下弦: 左下・右下と荷重節点 */}
      <Line x1={leftX} y1={tNodeY} x2={midX} y2={tNodeY} stroke="#333" strokeWidth={2} />
      <Line x1={midX} y1={tNodeY} x2={rightX} y2={tNodeY} stroke="#333" strokeWidth={2} />
      <Line
        x1={midX}
        y1={tNodeY}
        x2={midX}
        y2={bottomY}
        stroke={isTarget ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line x1={leftX} y1={tNodeY} x2={leftX} y2={baseY} stroke="#333" strokeWidth={2} />
      <Line x1={rightX} y1={tNodeY} x2={rightX} y2={baseY} stroke="#333" strokeWidth={2} />
      <Line x1={leftX} y1={baseY} x2={midX} y2={bottomY} stroke="#333" strokeWidth={2} />
      <Line x1={rightX} y1={baseY} x2={midX} y2={bottomY} stroke="#333" strokeWidth={2} />
      <Line x1={leftX} y1={baseY} x2={rightX} y2={baseY} stroke="#333" strokeWidth={2} />
      {/* 節点 */}
      <Circle cx={leftX} cy={tNodeY} r={NODE_R} fill="#333" />
      <Circle cx={midX} cy={tNodeY} r={NODE_R} fill="#333" />
      <Circle cx={rightX} cy={tNodeY} r={NODE_R} fill="#333" />
      <Circle cx={leftX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={rightX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={midX} cy={bottomY} r={NODE_R} fill="#333" />
      {/* 荷重（下中央節点に下向き） */}
      <Line
        x1={midX}
        y1={bottomY + NODE_R}
        x2={midX}
        y2={bottomY + NODE_R + ARROW_H}
        stroke="#333"
        strokeWidth={2}
      />
      <Polygon
        points={`${midX},${bottomY + NODE_R + ARROW_H + 4} ${midX - ARROW_W},${bottomY + NODE_R + ARROW_H} ${midX + ARROW_W},${bottomY + NODE_R + ARROW_H}`}
        fill="#333"
      />
      <Text
        x={midX}
        y={bottomY + NODE_R + ARROW_H + 26}
        fill="#333"
        fontSize={16}
        textAnchor="middle"
      >
        P={P}kN
      </Text>
      {/* 支点: 左ピン・右ローラー */}
      <Line x1={leftX - 8} y1={baseY} x2={leftX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${leftX},${baseY} ${leftX - 10},${baseY + SUPPORT_H} ${leftX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={rightX - 8} y1={baseY} x2={rightX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${rightX},${baseY} ${rightX - 10},${baseY + SUPPORT_H} ${rightX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={rightX - 12}
        y1={baseY + SUPPORT_H + 4}
        x2={rightX + 12}
        y2={baseY + SUPPORT_H + 4}
        stroke="#333"
        strokeWidth={1}
      />
      {isTarget && (
        <Text
          x={midX + 24}
          y={(tNodeY + bottomY) / 2 - 14}
          fill="#e65100"
          fontSize={16}
          textAnchor="start"
        >
          部材{targetMember}
        </Text>
      )}
    </Svg>
  );
}

/** 片持ちトラス: 左に壁、2スパン右に突出。先端に荷重 P。図は右寄せし、左余白に h= を配置。 */
const CANTILEVER_LEFT_MARGIN = 112 - SHIFT_LEFT;

function CantileverTruss({
  P,
  L,
  targetMember,
  maxWidth,
  sizeScale = 1,
}: {
  P: number;
  L: number;
  targetMember: string;
  maxWidth?: number;
  sizeScale?: number;
}) {
  const baseX = CANTILEVER_LEFT_MARGIN;
  const dimHX = baseX + 20;
  const wallX = dimHX + 72;
  const span = L_DISPLAY * SCALE;
  const topY = MARGIN + 30;
  const baseY = topY + span;
  const n1x = wallX;
  const n2x = wallX + span;
  const n3x = wallX + 2 * span;
  const w = baseX + wallX + 2 * span + MARGIN + 50;
  const h = baseY + SUPPORT_H + 50;
  const isTop = targetMember === "A" || targetMember === "上弦";
  const isBottom = targetMember === "B" || targetMember === "下弦";
  const isDiag = targetMember === "C" || targetMember === "斜材";
  const scale = maxWidth != null && w > maxWidth ? maxWidth / w : 1;
  const svgW = scale * w * sizeScale;
  const svgH = scale * h * sizeScale;
  const wallLineX = wallX - 4;
  const hatchLeft = wallLineX - 20;
  const hatchLen = wallLineX - hatchLeft;
  const hatchStep = 5;
  const wallTop = topY - 8;
  const wallBottom = baseY + SUPPORT_H + 8;

  return (
    <Svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 高さ h = L（左側に固定。壁・トラスは右にずらして被らない） */}
      <Line x1={dimHX} y1={topY} x2={dimHX} y2={baseY} stroke="#555" strokeWidth={1} />
      <Line
        x1={dimHX - DIM_TICK}
        y1={topY}
        x2={dimHX + DIM_TICK}
        y2={topY}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={dimHX - DIM_TICK}
        y1={baseY}
        x2={dimHX + DIM_TICK}
        y2={baseY}
        stroke="#555"
        strokeWidth={1}
      />
      <Text
        x={dimHX + 5}
        y={(topY + baseY) / 2}
        fill="#555"
        fontSize={16}
        textAnchor="start"
      >
        h={L}m
      </Text>
      {/* 壁のハッチング（45°斜線）：支点が壁・柱に固定されていることを示す */}
      {Array.from(
        { length: Math.ceil((wallBottom - wallTop + hatchLen) / hatchStep) },
        (_, i) => {
          const yEnd = wallTop + i * hatchStep;
          const yStart = yEnd - hatchLen;
          return (
            <Line
              key={`hatch-${i}`}
              x1={hatchLeft}
              y1={yStart}
              x2={wallLineX}
              y2={yEnd}
              stroke="#888"
              strokeWidth={1}
            />
          );
        }
      )}
      {/* 壁（鉛直線）：トラスが固定される建物・柱の面 */}
      <Line
        x1={wallLineX}
        y1={wallTop}
        x2={wallLineX}
        y2={wallBottom}
        stroke="#333"
        strokeWidth={3}
      />
      {/* 上弦 */}
      <Line
        x1={n1x}
        y1={topY}
        x2={n2x}
        y2={topY}
        stroke={isTop ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line
        x1={n2x}
        y1={topY}
        x2={n3x}
        y2={topY}
        stroke="#333"
        strokeWidth={2}
      />
      {/* 下弦 */}
      <Line
        x1={n1x}
        y1={baseY}
        x2={n2x}
        y2={baseY}
        stroke={isBottom ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line
        x1={n2x}
        y1={baseY}
        x2={n3x}
        y2={baseY}
        stroke="#333"
        strokeWidth={2}
      />
      {/* 垂直材（中央） */}
      <Line x1={n2x} y1={topY} x2={n2x} y2={baseY} stroke="#333" strokeWidth={2} />
      {/* 斜材: 左上→中央下、中央上→右下（N字） */}
      <Line
        x1={n1x}
        y1={topY}
        x2={n2x}
        y2={baseY}
        stroke={isDiag ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line
        x1={n2x}
        y1={topY}
        x2={n3x}
        y2={baseY}
        stroke="#333"
        strokeWidth={2}
      />
      {/* 節点 */}
      <Circle cx={n1x} cy={topY} r={NODE_R} fill="#333" />
      <Circle cx={n1x} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={n2x} cy={topY} r={NODE_R} fill="#333" />
      <Circle cx={n2x} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={n3x} cy={topY} r={NODE_R} fill="#333" />
      <Circle cx={n3x} cy={baseY} r={NODE_R} fill="#333" />
      {/* 荷重（先端上弦に下向き） */}
      <Line
        x1={n3x}
        y1={topY + NODE_R}
        x2={n3x}
        y2={topY + NODE_R + ARROW_H}
        stroke="#333"
        strokeWidth={2}
      />
      <Polygon
        points={`${n3x},${topY + NODE_R + ARROW_H + 4} ${n3x - ARROW_W},${topY + NODE_R + ARROW_H} ${n3x + ARROW_W},${topY + NODE_R + ARROW_H}`}
        fill="#333"
      />
      <Text
        x={n3x + (Platform.OS === "web" ? 10 : -2)}
        y={topY + NODE_R + ARROW_H + 20}
        fill="#333"
        fontSize={16}
        textAnchor="end"
      >
        P={P}kN
      </Text>
      {/* 支点（壁側: 上ピン・下ローラー） */}
      <Line x1={n1x - 8} y1={topY} x2={n1x + 8} y2={topY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${n1x},${topY} ${n1x - 10},${topY + SUPPORT_H} ${n1x + 10},${topY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={n1x - 8} y1={baseY} x2={n1x + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${n1x},${baseY} ${n1x - 10},${baseY + SUPPORT_H} ${n1x + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={n1x - 12}
        y1={baseY + SUPPORT_H + 4}
        x2={n1x + 12}
        y2={baseY + SUPPORT_H + 4}
        stroke="#333"
        strokeWidth={1}
      />
      {/* 寸法 2L */}
      <Line
        x1={n1x}
        y1={baseY + SUPPORT_H + 12}
        x2={n3x}
        y2={baseY + SUPPORT_H + 12}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={n1x}
        y1={baseY + SUPPORT_H + 12 - DIM_TICK}
        x2={n1x}
        y2={baseY + SUPPORT_H + 12 + DIM_TICK}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={n3x}
        y1={baseY + SUPPORT_H + 12 - DIM_TICK}
        x2={n3x}
        y2={baseY + SUPPORT_H + 12 + DIM_TICK}
        stroke="#555"
        strokeWidth={1}
      />
      <Text
        x={(n1x + n3x) / 2}
        y={baseY + SUPPORT_H + 12 + 18}
        fill="#555"
        fontSize={16}
        textAnchor="middle"
      >
        2L = {2 * L} m
      </Text>
      {(isTop || isBottom || isDiag) && (
        <Text
        x={
          isTop || isBottom
            ? (n1x + n2x) / 2
            : (n2x + n3x) / 2
        }
          y={
            isTop
              ? topY - 14
              : isBottom
                ? baseY - 12
                : (topY + baseY) / 2 - 20
          }
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
    </Svg>
  );
}

/** プラットトラス（N字型）: 平行弦、斜材が外向き下がり。下弦中央に荷重。 */
function PrattTruss({
  P,
  L,
  targetMember,
  maxWidth,
  sizeScale = 1,
}: {
  P: number;
  L: number;
  targetMember: string;
  maxWidth?: number;
  sizeScale?: number;
}) {
  const leftOffset = 86 - SHIFT_LEFT;
  const leftX = leftOffset + MARGIN + 24;
  /** 高さ寸法（I字＋h=）を左余白内でやや右に配置（かぶらない程度） */
  const dimHX = 28;
  const span = L_DISPLAY * SCALE;
  const baseY = MARGIN + span + 28;
  const topY = baseY - span;
  const midX = leftX + span;
  const rightX = leftX + 2 * span;
  const w = leftOffset + (rightX - leftOffset) + MARGIN + 50;
  const dim2LOffset = 32;
  const h = baseY + SUPPORT_H + dim2LOffset + 28;
  const isDiagA = targetMember === "A" || targetMember === "斜材A";
  const isTopChord = targetMember === "B";
  const isBottomChord = targetMember === "C";
  const isVertical = targetMember === "D";
  const scale = maxWidth != null && w > maxWidth ? maxWidth / w : 1;
  const svgW = scale * w * sizeScale;
  const svgH = scale * h * sizeScale;

  return (
    <Svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 端垂直材（静定化のため左右に追加） */}
      <Line x1={leftX} y1={topY} x2={leftX} y2={baseY} stroke="#333" strokeWidth={2} />
      <Line x1={rightX} y1={topY} x2={rightX} y2={baseY} stroke="#333" strokeWidth={2} />
      {/* 上弦（左スパン＝部材B、右スパン） */}
      <Line
        x1={leftX}
        y1={topY}
        x2={midX}
        y2={topY}
        stroke={isTopChord ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line x1={midX} y1={topY} x2={rightX} y2={topY} stroke="#333" strokeWidth={2} />
      {/* 下弦（左スパン＝部材C、右スパン） */}
      <Line
        x1={leftX}
        y1={baseY}
        x2={midX}
        y2={baseY}
        stroke={isBottomChord ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line x1={midX} y1={baseY} x2={rightX} y2={baseY} stroke="#333" strokeWidth={2} />
      {/* 垂直材（中央＝部材D） */}
      <Line
        x1={midX}
        y1={topY}
        x2={midX}
        y2={baseY}
        stroke={isVertical ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      {/* 斜材 プラット（V字）: 左上→中央下（部材A・↘）、右上→中央下（↙） */}
      <Line
        x1={leftX}
        y1={topY}
        x2={midX}
        y2={baseY}
        stroke={isDiagA ? "#e65100" : "#333"}
        strokeWidth={2}
      />
      <Line
        x1={rightX}
        y1={topY}
        x2={midX}
        y2={baseY}
        stroke="#333"
        strokeWidth={2}
      />
      {/* 節点 */}
      <Circle cx={leftX} cy={topY} r={NODE_R} fill="#333" />
      <Circle cx={leftX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={midX} cy={topY} r={NODE_R} fill="#333" />
      <Circle cx={midX} cy={baseY} r={NODE_R} fill="#333" />
      <Circle cx={rightX} cy={topY} r={NODE_R} fill="#333" />
      <Circle cx={rightX} cy={baseY} r={NODE_R} fill="#333" />
      {/* 荷重（下弦中央に下向き） */}
      <Line
        x1={midX}
        y1={baseY + NODE_R}
        x2={midX}
        y2={baseY + NODE_R + ARROW_H}
        stroke="#333"
        strokeWidth={2}
      />
      <Polygon
        points={`${midX},${baseY + NODE_R + ARROW_H + 4} ${midX - ARROW_W},${baseY + NODE_R + ARROW_H} ${midX + ARROW_W},${baseY + NODE_R + ARROW_H}`}
        fill="#333"
      />
      {/* 荷重ラベル: 矢印の少し左下（さらに左に寄せて部材ラベルと離す） */}
      <Text
        x={midX - 18}
        y={baseY + NODE_R + ARROW_H + 20}
        fill="#333"
        fontSize={16}
        textAnchor="middle"
      >
        P={P}kN
      </Text>
      {/* 支点: 左ピン・右ローラー */}
      <Line x1={leftX - 8} y1={baseY} x2={leftX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${leftX},${baseY} ${leftX - 10},${baseY + SUPPORT_H} ${leftX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={rightX - 8} y1={baseY} x2={rightX + 8} y2={baseY} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${rightX},${baseY} ${rightX - 10},${baseY + SUPPORT_H} ${rightX + 10},${baseY + SUPPORT_H}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={rightX - 12}
        y1={baseY + SUPPORT_H + 4}
        x2={rightX + 12}
        y2={baseY + SUPPORT_H + 4}
        stroke="#333"
        strokeWidth={1}
      />
      {/* 寸法 2L（P=ラベル・矢印の下に十分あけて重なりを防ぐ） */}
      <Line
        x1={leftX}
        y1={baseY + SUPPORT_H + dim2LOffset}
        x2={rightX}
        y2={baseY + SUPPORT_H + dim2LOffset}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={leftX}
        y1={baseY + SUPPORT_H + dim2LOffset - DIM_TICK}
        x2={leftX}
        y2={baseY + SUPPORT_H + dim2LOffset + DIM_TICK}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={rightX}
        y1={baseY + SUPPORT_H + dim2LOffset - DIM_TICK}
        x2={rightX}
        y2={baseY + SUPPORT_H + dim2LOffset + DIM_TICK}
        stroke="#555"
        strokeWidth={1}
      />
      <Text
        x={(leftX + rightX) / 2}
        y={baseY + SUPPORT_H + dim2LOffset + 18}
        fill="#555"
        fontSize={16}
        textAnchor="middle"
      >
        2L = {2 * L} m
      </Text>
      {/* 高さ h = L（左余白内） */}
      <Line x1={dimHX} y1={topY} x2={dimHX} y2={baseY} stroke="#555" strokeWidth={1} />
      <Line
        x1={dimHX - DIM_TICK}
        y1={topY}
        x2={dimHX + DIM_TICK}
        y2={topY}
        stroke="#555"
        strokeWidth={1}
      />
      <Line
        x1={dimHX - DIM_TICK}
        y1={baseY}
        x2={dimHX + DIM_TICK}
        y2={baseY}
        stroke="#555"
        strokeWidth={1}
      />
      <Text
        x={dimHX + 5}
        y={(topY + baseY) / 2}
        fill="#555"
        fontSize={16}
        textAnchor="start"
      >
        h={L === 8 ? 6 : 3}m
      </Text>
      {isDiagA && (
        <Text
          x={(leftX + midX) / 2 + 4}
          y={(topY + baseY) / 2 - 18}
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
      {isTopChord && (
        <Text
          x={(leftX + midX) / 2}
          y={topY - 14}
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
      {isBottomChord && (
        <Text
          x={(leftX + midX) / 2}
          y={baseY + 22}
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
      {isVertical && (
        <Text
          x={midX + 30}
          y={(topY + baseY) / 2}
          fill="#e65100"
          fontSize={16}
          textAnchor="middle"
        >
          部材{targetMember}
        </Text>
      )}
    </Svg>
  );
}

export function TrussDiagram({ pattern, P, L, targetMember }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const maxDiagramWidth = Math.max(280, windowWidth - 8);
  const maxDiagramWidthLarge = maxDiagramWidth + 56;
  const diagramMarginLeft = 20;

  return (
    <View
      style={{
        alignItems: "center",
        maxWidth: "100%",
        overflow: "visible",
        marginLeft: diagramMarginLeft,
      }}
    >
      {pattern === "simple-triangle" && (
        <SimpleTriangleTruss
          P={P}
          L={L}
          targetMember={targetMember}
          maxWidth={maxDiagramWidth}
          sizeScale={DIAGRAM_SIZE_SCALE}
        />
      )}
      {pattern === "zero-member" && (
        <ZeroMemberTruss
          P={P}
          L={L}
          targetMember={targetMember}
          maxWidth={maxDiagramWidth}
          sizeScale={DIAGRAM_SIZE_SCALE}
        />
      )}
      {pattern === "zero-member-t" && (
        <ZeroMemberTTruss
          P={P}
          L={L}
          targetMember={targetMember}
          maxWidth={maxDiagramWidth}
          sizeScale={DIAGRAM_SIZE_SCALE}
        />
      )}
      {pattern === "cantilever-truss" && (
        <CantileverTruss
          P={P}
          L={L}
          targetMember={targetMember}
          maxWidth={maxDiagramWidthLarge}
          sizeScale={CANTILEVER_DIAGRAM_SIZE_SCALE}
        />
      )}
      {pattern === "pratt-truss" && (
        <PrattTruss
          P={P}
          L={L}
          targetMember={targetMember}
          maxWidth={maxDiagramWidthLarge}
          sizeScale={DIAGRAM_SIZE_SCALE}
        />
      )}
    </View>
  );
}
