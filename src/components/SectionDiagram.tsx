import React from "react";
import { View } from "react-native";
import Svg, { Line, Rect, Text } from "react-native-svg";

type Props = {
  /** 幅 b [mm]（外寸 or L形の全幅 b1+b2） */
  b: number;
  /** せい h [mm]（外寸） */
  h: number;
  /** 断面形状: rectangle / hollow-rect / L-shape / H-shape / T-shape */
  shape?: "rectangle" | "hollow-rect" | "L-shape" | "H-shape" | "T-shape";
  /** 中空断面の内側幅 [mm] */
  bInner?: number;
  /** 中空断面の内側せい [mm] */
  hInner?: number;
  /** L形: 左矩形の幅 b1 [mm]。b1 と b2 指定時は L形として描画 */
  b1?: number;
  /** L形: 右矩形の幅 b2 [mm] */
  b2?: number;
  /** H形: フランジ厚さ tf [mm]。tf と tw 指定時は H形として描画 */
  tf?: number;
  /** H形: ウェブ厚さ tw [mm] */
  tw?: number;
};

const MARGIN = 24;
const RECT_WIDTH = 120;
const RECT_HEIGHT = 180;
const EXTRA_LEFT_MARGIN = 32;
const EXTRA_RIGHT_MARGIN = 88;

/** 長方形断面図（b, h と図心軸・寸法線を表示）。
 * shape により、中空（hollow-rect）/ L形 / H形 / T形 を描画する。
 */
export function SectionDiagram({ b, h, shape, bInner, hInner, b1, b2, tf, tw }: Props) {
  const svgWidth = EXTRA_LEFT_MARGIN + RECT_WIDTH + MARGIN * 2 + EXTRA_RIGHT_MARGIN;

  const xLeft = MARGIN + EXTRA_LEFT_MARGIN;
  const xRight = xLeft + RECT_WIDTH;
  const yTop = MARGIN;
  const yBottom = MARGIN + RECT_HEIGHT;

  const cx = (xLeft + xRight) / 2;
  const cy = (yTop + yBottom) / 2;

  const dimOffset = 12;
  const dimTick = 6;

  const hollow = shape === "hollow-rect" && bInner != null && hInner != null && bInner < b && hInner < h;
  const lshape = shape === "L-shape" && b1 != null && b2 != null && b1 > 0 && b2 > 0 && b === b1 + b2;
  const hshape =
    shape === "H-shape" && tf != null && tw != null && tf > 0 && tw > 0 && h > 2 * tf && !hollow && !lshape;
  const isTShape =
    shape === "T-shape" && tf != null && tw != null && tf > 0 && tw > 0 && h > tf && !hollow && !lshape;
  const svgHeight = RECT_HEIGHT + MARGIN * 2 + 24 + (isTShape ? 32 : 0);
  const innerW = hollow ? (bInner! / b) * RECT_WIDTH : 0;
  const innerH = hollow ? (hInner! / h) * RECT_HEIGHT : 0;
  const innerX = hollow ? xLeft + (RECT_WIDTH - innerW) / 2 : 0;
  const innerY = hollow ? yTop + (RECT_HEIGHT - innerH) / 2 : 0;

  const w1 = lshape && b1 != null && b2 != null ? (b1 / b) * RECT_WIDTH : 0;
  const w2 = lshape && b1 != null && b2 != null ? (b2 / b) * RECT_WIDTH : 0;
  const x_g_mm = lshape && b1 != null && b2 != null ? (b1 * b1 / 2 + b2 * (b1 + b2 / 2)) / b : 0;
  const x_g_px = lshape ? (x_g_mm / b) * RECT_WIDTH : 0;

  const tfPx = hshape && tf != null ? (tf / h) * RECT_HEIGHT : 0;
  const hwPx = hshape && tf != null ? ((h - 2 * tf) / h) * RECT_HEIGHT : 0;
  const twPx = hshape && tw != null ? (tw / b) * RECT_WIDTH : 0;
  const webLeft = hshape ? xLeft + (RECT_WIDTH - twPx) / 2 : 0;

  const tfPxT = isTShape && tf != null ? (tf / h) * RECT_HEIGHT : 0;
  const hwPxT = isTShape && tf != null ? ((h - tf) / h) * RECT_HEIGHT : 0;
  const twPxT = isTShape && tw != null ? (tw / b) * RECT_WIDTH : 0;
  const webLeftT = isTShape ? xLeft + (RECT_WIDTH - twPxT) / 2 : 0;
  const y_g_mm_T =
    isTShape && tf != null && tw != null
      ? (() => {
          const hw = h - tf;
          const Af = b * tf;
          const Aw = tw * hw;
          const A = Af + Aw;
          const yF = tf / 2;
          const yW = tf + hw / 2;
          return (Af * yF + Aw * yW) / A;
        })()
      : 0;
  const y_g_px_T = isTShape ? yTop + (y_g_mm_T / h) * RECT_HEIGHT : 0;

  const svgViewBox = isTShape ? `-40 0 ${svgWidth + 40} ${svgHeight}` : undefined;
  const svgWidthActual = isTShape ? svgWidth + 40 : svgWidth;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgWidthActual} height={svgHeight} viewBox={svgViewBox}>
        {lshape ? (
          <>
            <Rect x={xLeft} y={yTop} width={w1} height={RECT_HEIGHT} fill="#fafafa" stroke="#333" strokeWidth={2} />
            <Rect x={xLeft + w1} y={yTop} width={w2} height={RECT_HEIGHT} fill="#f0f0f0" stroke="#333" strokeWidth={2} />
            <Line x1={xLeft + x_g_px} y1={yTop - 6} x2={xLeft + x_g_px} y2={yBottom + 6} stroke="#c62828" strokeWidth={1.5} strokeDasharray="4,3" />
            <Text x={xLeft + x_g_px} y={yTop - 10} fill="#c62828" fontSize={10} textAnchor="middle">x_g</Text>
            <Line x1={xLeft} y1={yBottom + dimOffset} x2={xLeft + w1} y2={yBottom + dimOffset} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
            <Text x={xLeft + w1 - 4} y={yBottom + dimOffset + 14} fill="#333" fontSize={11} textAnchor="end">b1 = {b1} mm</Text>
            <Line x1={xLeft + w1} y1={yBottom + dimOffset} x2={xRight} y2={yBottom + dimOffset} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
            <Text x={xLeft + w1 + 4} y={yBottom + dimOffset + 14} fill="#333" fontSize={11} textAnchor="start">b2 = {b2} mm</Text>
            <Line x1={xRight + dimOffset} y1={yTop} x2={xRight + dimOffset} y2={yBottom} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
            <Text x={xRight + dimOffset + 8} y={cy} fill="#333" fontSize={12} textAnchor="start">h = {h} mm</Text>
          </>
        ) : hshape ? (
          <>
            <Rect x={xLeft} y={yTop} width={RECT_WIDTH} height={tfPx} fill="#fafafa" stroke="#333" strokeWidth={2} />
            <Rect x={xLeft} y={yTop + tfPx + hwPx} width={RECT_WIDTH} height={tfPx} fill="#fafafa" stroke="#333" strokeWidth={2} />
            <Rect x={webLeft} y={yTop + tfPx} width={twPx} height={hwPx} fill="#f0f0f0" stroke="#333" strokeWidth={2} />
            <Line x1={xLeft - 8} y1={cy} x2={xRight + 8} y2={cy} stroke="#1976d2" strokeWidth={1} strokeDasharray="6,4" />
            <Text x={xLeft - 12} y={cy - 4} fill="#1976d2" fontSize={11} textAnchor="end">中立軸</Text>
            <Line x1={xLeft} y1={yBottom + dimOffset} x2={xRight} y2={yBottom + dimOffset} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
            <Line x1={xLeft} y1={yBottom + dimOffset - dimTick / 2} x2={xLeft} y2={yBottom + dimOffset + dimTick / 2} stroke="#333" strokeWidth={1} />
            <Line x1={xRight} y1={yBottom + dimOffset - dimTick / 2} x2={xRight} y2={yBottom + dimOffset + dimTick / 2} stroke="#333" strokeWidth={1} />
            <Text x={(xLeft + xRight) / 2} y={yBottom + dimOffset + 14} fill="#333" fontSize={12} textAnchor="middle">b = {b} mm</Text>
            <Line x1={xRight + dimOffset} y1={yTop} x2={xRight + dimOffset} y2={yBottom} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
            <Line x1={xRight + dimOffset - dimTick / 2} y1={yTop} x2={xRight + dimOffset + dimTick / 2} y2={yTop} stroke="#333" strokeWidth={1} />
            <Line x1={xRight + dimOffset - dimTick / 2} y1={yBottom} x2={xRight + dimOffset + dimTick / 2} y2={yBottom} stroke="#333" strokeWidth={1} />
            <Text x={xRight + dimOffset + 8} y={cy} fill="#333" fontSize={12} textAnchor="start">h = {h} mm</Text>
          </>
        ) : isTShape ? (
          <>
            {/* フランジ（上部） */}
            <Rect x={xLeft} y={yTop} width={RECT_WIDTH} height={tfPxT} fill="#fafafa" stroke="#333" strokeWidth={2} />
            {/* ウェブ（中央） */}
            <Rect
              x={webLeftT}
              y={yTop + tfPxT}
              width={twPxT}
              height={hwPxT}
              fill="#f0f0f0"
              stroke="#333"
              strokeWidth={2}
            />
            {/* 中立軸（図心を通る水平軸。上から y_g_mm_T の位置） */}
            <Line
              x1={xLeft - 8}
              y1={y_g_px_T}
              x2={xRight + 8}
              y2={y_g_px_T}
              stroke="#1976d2"
              strokeWidth={1}
              strokeDasharray="6,4"
            />
            <Text x={xLeft - 12} y={y_g_px_T + 4} fill="#1976d2" fontSize={11} textAnchor="end">
              中立軸
            </Text>
            {/* 寸法 b */}
            <Line
              x1={xLeft}
              y1={yBottom + dimOffset}
              x2={xRight}
              y2={yBottom + dimOffset}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="4,2"
            />
            <Line
              x1={xLeft}
              y1={yBottom + dimOffset - dimTick / 2}
              x2={xLeft}
              y2={yBottom + dimOffset + dimTick / 2}
              stroke="#333"
              strokeWidth={1}
            />
            <Line
              x1={xRight}
              y1={yBottom + dimOffset - dimTick / 2}
              x2={xRight}
              y2={yBottom + dimOffset + dimTick / 2}
              stroke="#333"
              strokeWidth={1}
            />
            <Text
              x={(xLeft + xRight) / 2}
              y={yBottom + dimOffset + 14}
              fill="#333"
              fontSize={12}
              textAnchor="middle"
            >
              b = {b} mm
            </Text>
            {/* 寸法 h */}
            <Line
              x1={xRight + dimOffset}
              y1={yTop}
              x2={xRight + dimOffset}
              y2={yBottom}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="4,2"
            />
            <Line
              x1={xRight + dimOffset - dimTick / 2}
              y1={yTop}
              x2={xRight + dimOffset + dimTick / 2}
              y2={yTop}
              stroke="#333"
              strokeWidth={1}
            />
            <Line
              x1={xRight + dimOffset - dimTick / 2}
              y1={yBottom}
              x2={xRight + dimOffset + dimTick / 2}
              y2={yBottom}
              stroke="#333"
              strokeWidth={1}
            />
            <Text x={xRight + dimOffset + 8} y={y_g_px_T - 4} fill="#333" fontSize={12} textAnchor="start">
              h = {h} mm
            </Text>
            {/* フランジ厚 t_f の寸法線（左側）。テキストはフランジ直下に配置して、上端で見切れないようにする */}
            {tf != null && tfPxT > 0 && (
              <>
                <Line
                  x1={xLeft - dimOffset}
                  y1={yTop}
                  x2={xLeft - dimOffset}
                  y2={yTop + tfPxT}
                  stroke="#333"
                  strokeWidth={1}
                  strokeDasharray="4,2"
                />
                <Line
                  x1={xLeft - dimTick / 2 - dimOffset}
                  y1={yTop}
                  x2={xLeft + dimTick / 2 - dimOffset}
                  y2={yTop}
                  stroke="#333"
                  strokeWidth={1}
                />
                <Line
                  x1={xLeft - dimTick / 2 - dimOffset}
                  y1={yTop + tfPxT}
                  x2={xLeft + dimTick / 2 - dimOffset}
                  y2={yTop + tfPxT}
                  stroke="#333"
                  strokeWidth={1}
                />
                <Text
                  x={xLeft - dimOffset - 4}
                  y={yTop + tfPxT / 2 + 4}
                  fill="#333"
                  fontSize={11}
                  textAnchor="end"
                >
                  t_f = {tf} mm
                </Text>
              </>
            )}
            {/* ウェブ厚 t_w の寸法線（下側中央） */}
            {tw != null && twPxT > 0 && (
              <>
                <Line
                  x1={webLeftT}
                  y1={yBottom + dimOffset + 26}
                  x2={webLeftT + twPxT}
                  y2={yBottom + dimOffset + 26}
                  stroke="#333"
                  strokeWidth={1}
                  strokeDasharray="4,2"
                />
                <Line
                  x1={webLeftT}
                  y1={yBottom + dimOffset + 26 - dimTick / 2}
                  x2={webLeftT}
                  y2={yBottom + dimOffset + 26 + dimTick / 2}
                  stroke="#333"
                  strokeWidth={1}
                />
                <Line
                  x1={webLeftT + twPxT}
                  y1={yBottom + dimOffset + 26 - dimTick / 2}
                  x2={webLeftT + twPxT}
                  y2={yBottom + dimOffset + 26 + dimTick / 2}
                  stroke="#333"
                  strokeWidth={1}
                />
                <Text
                  x={webLeftT + twPxT / 2}
                  y={yBottom + dimOffset + 26 + 14}
                  fill="#333"
                  fontSize={11}
                  textAnchor="middle"
                >
                  t_w = {tw} mm
                </Text>
              </>
            )}
          </>
        ) : (
          <>
        {/* 断面本体（中空のときは外枠） */}
        <Rect
          x={xLeft}
          y={yTop}
          width={RECT_WIDTH}
          height={RECT_HEIGHT}
          fill="#fafafa"
          stroke="#333"
          strokeWidth={2}
        />
        {hollow && (
          <Rect
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            fill="#fff"
            stroke="#333"
            strokeWidth={1.5}
          />
        )}

        <Line x1={xLeft - 8} y1={cy} x2={xRight + 8} y2={cy} stroke="#1976d2" strokeWidth={1} strokeDasharray="6,4" />
        <Text x={xLeft - 12} y={cy - 4} fill="#1976d2" fontSize={11} textAnchor="end">中立軸</Text>

        <Line x1={xLeft} y1={yBottom + dimOffset} x2={xRight} y2={yBottom + dimOffset} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
        <Line x1={xLeft} y1={yBottom + dimOffset - dimTick / 2} x2={xLeft} y2={yBottom + dimOffset + dimTick / 2} stroke="#333" strokeWidth={1} />
        <Line x1={xRight} y1={yBottom + dimOffset - dimTick / 2} x2={xRight} y2={yBottom + dimOffset + dimTick / 2} stroke="#333" strokeWidth={1} />
        <Text x={(xLeft + xRight) / 2} y={yBottom + dimOffset + 14} fill="#333" fontSize={12} textAnchor="middle">b = {b} mm</Text>

        <Line x1={xRight + dimOffset} y1={yTop} x2={xRight + dimOffset} y2={yBottom} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
        <Line x1={xRight + dimOffset - dimTick / 2} y1={yTop} x2={xRight + dimOffset + dimTick / 2} y2={yTop} stroke="#333" strokeWidth={1} />
        <Line x1={xRight + dimOffset - dimTick / 2} y1={yBottom} x2={xRight + dimOffset + dimTick / 2} y2={yBottom} stroke="#333" strokeWidth={1} />
        <Text x={xRight + dimOffset + 8} y={(yTop + yBottom) / 2} fill="#333" fontSize={12} textAnchor="start">h = {h} mm</Text>
          </>
        )}
      </Svg>
    </View>
  );
}

