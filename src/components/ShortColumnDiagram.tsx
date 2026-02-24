import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Rect, Text } from "react-native-svg";

type Props = {
  /** 幅 b [mm] */
  b: number;
  /** せい h [mm] */
  h: number;
  /** 軸力 P [kN]（図中ラベル用。数値そのものは応力度計算ロジック側で使用） */
  P: number;
  /** 問題モード（図の説明ラベルだけに使用） */
  mode: "eccentric-max-compression" | "no-tension-limit";
};

const MARGIN = 24;
const BASE_RECT_HEIGHT = 180;

/** 短柱の偏心荷重図。
 * 長方形断面の図心に「＋」を描き、そこから距離 e だけ離れた位置に軸力 P を描画する。
 */
export function ShortColumnDiagram({ b, h, P, mode }: Props) {
  // b, h の比率に応じて長方形の縦横比を動的に調整する。
  // 高さを基準にし、幅 = BASE_RECT_HEIGHT × (b/h) とする。
  const aspect = b > 0 && h > 0 ? b / h : 1;
  const rectHeight = BASE_RECT_HEIGHT;
  const rectWidth = BASE_RECT_HEIGHT * aspect;

  const svgWidth = rectWidth + MARGIN * 2 + 80;
  const svgHeight = rectHeight + MARGIN * 2 + 40;

  const xLeft = MARGIN;
  const xRight = xLeft + rectWidth;
  const yTop = MARGIN;
  const yBottom = yTop + rectHeight;

  const cx = (xLeft + xRight) / 2;
  const cy = (yTop + yBottom) / 2;
  const eccentricOriginX = cx;

  // 荷重位置（図心から右側へオフセット）。実際の e の値とは独立に、見やすい比率で配置する。
  const loadX = cx + rectWidth * 0.25;
  const loadYTop = yTop - 12;
  const loadYBottom = yTop + 32;

  const dimYOffset = 12;

  const modeLabel = mode === "eccentric-max-compression" ? "最大圧縮応力度" : "引張が生じない限界偏心";

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgWidth} height={svgHeight}>
        {/* 断面矩形 */}
        <Rect x={xLeft} y={yTop} width={rectWidth} height={rectHeight} fill="#fafafa" stroke="#333" strokeWidth={2} />

        {/* 図心（＋マーク） */}
        <Line
          x1={eccentricOriginX - 8}
          y1={cy}
          x2={eccentricOriginX + 8}
          y2={cy}
          stroke="#1976d2"
          strokeWidth={1.5}
        />
        <Line
          x1={eccentricOriginX}
          y1={cy - 8}
          x2={eccentricOriginX}
          y2={cy + 8}
          stroke="#1976d2"
          strokeWidth={1.5}
        />
        <Text x={eccentricOriginX - 10} y={cy - 12} fill="#1976d2" fontSize={10} textAnchor="end">
          図心
        </Text>

        {/* 図心から寸法線までの補助線（e の起点を明確にする） */}
        <Line
          x1={eccentricOriginX}
          y1={cy - 8}
          x2={eccentricOriginX}
          y2={yTop - dimYOffset}
          stroke="#1976d2"
          strokeWidth={1}
          strokeDasharray="4,2"
        />

        {/* 荷重 P（図の上から押しているイメージで下向き矢印） */}
        <Line x1={loadX} y1={loadYTop} x2={loadX} y2={loadYBottom} stroke="#333" strokeWidth={2} />
        <Line
          x1={loadX - 6}
          y1={loadYBottom - 2}
          x2={loadX}
          y2={loadYBottom + 8}
          stroke="#333"
          strokeWidth={2}
        />
        <Line
          x1={loadX + 6}
          y1={loadYBottom - 2}
          x2={loadX}
          y2={loadYBottom + 8}
          stroke="#333"
          strokeWidth={2}
        />
        <Text x={loadX + 8} y={loadYTop + 4} fill="#333" fontSize={12} textAnchor="start">
          P = {P} kN
        </Text>

        {/* e の寸法線（図心の鉛直線と荷重作用線の水平距離） */}
        <Line
          x1={eccentricOriginX}
          y1={yTop - dimYOffset}
          x2={loadX}
          y2={yTop - dimYOffset}
          stroke="#333"
          strokeWidth={1}
        />
        <Line
          x1={eccentricOriginX}
          y1={yTop - dimYOffset - 4}
          x2={eccentricOriginX}
          y2={yTop - dimYOffset + 4}
          stroke="#333"
          strokeWidth={1}
        />
        <Line
          x1={loadX}
          y1={yTop - dimYOffset - 4}
          x2={loadX}
          y2={yTop - dimYOffset + 4}
          stroke="#333"
          strokeWidth={1}
        />
        <Text x={(cx + loadX) / 2} y={yTop - dimYOffset - 6} fill="#333" fontSize={11} textAnchor="middle">
          e
        </Text>

        {/* b, h の簡易寸法（下と右） */}
        <Line
          x1={xLeft}
          y1={yBottom + dimYOffset}
          x2={xRight}
          y2={yBottom + dimYOffset}
          stroke="#333"
          strokeWidth={1}
          strokeDasharray="4,2"
        />
        <Text x={(xLeft + xRight) / 2} y={yBottom + dimYOffset + 14} fill="#333" fontSize={11} textAnchor="middle">
          b = {b} mm
        </Text>
        <Line
          x1={xRight + 10}
          y1={yTop}
          x2={xRight + 10}
          y2={yBottom}
          stroke="#333"
          strokeWidth={1}
          strokeDasharray="4,2"
        />
        <Text x={xRight + 14} y={cy + 4} fill="#333" fontSize={11} textAnchor="start">
          h = {h} mm
        </Text>

        {/* 図の説明 */}
        <Text x={svgWidth / 2} y={svgHeight - 8} fill="#666" fontSize={11} textAnchor="middle">
          短柱・偏心荷重（{modeLabel}）
        </Text>
      </Svg>
    </View>
  );
}

