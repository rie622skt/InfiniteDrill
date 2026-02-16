import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text } from "react-native-svg";

const PIXELS_PER_METER = 28;
/** 左余白: h= の I 字・ラベルが左柱と被らず、ラベルが viewBox 左端で切れないように確保 */
const MARGIN_LEFT = 112;
const MARGIN_RIGHT = 112;
/** 上余白: w= ラベルが切れないように十分確保 */
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 58;
const SUPPORT_H = 18;
const DIM_TICK = 6;
/** 高さ寸法の縦線（I字）の x。ラベルはこの左側に textAnchor="end" で配置 */
const DIM_H_LINE_X_OFFSET = 32;
/** スパン寸法（L=）を支点より下に取り、被らないようにする */
const DIM_L_VERTICAL = SUPPORT_H + 14;
const HINGE_R = 5;
const ARROW_HEAD = 5;
const UDL_ARROW_SPACING = 24;
const UDL_ARROW_SIZE = 6;

type Props = {
  frameL: number;
  frameH: number;
  /** 梁中央集中荷重 [kN]。等分布・水平荷重のときは未指定 */
  frameP?: number;
  /** 梁上等分布荷重 [kN/m]。集中荷重・水平荷重のときは未指定 */
  frameW?: number;
  /** 左柱に作用する水平荷重 [kN]。指定時は鉛直荷重の代わりに水平荷重を描画 */
  frameHorizontalP?: number;
  /** ヒンジ（円）の位置。0〜1で左端からの比率。未指定・0.5 で梁中央 */
  hingePositionRatio?: number;
};

/**
 * 3ヒンジ門形ラーメン（両端ピン、梁中央ヒンジ）の断面図。
 * 集中荷重 P または梁上等分布 w のいずれか一方を表示。左柱頭曲げ M = P*L/4 または w*L²/8 用。
 */
export function FrameDiagram({ frameL, frameH, frameP, frameW, frameHorizontalP, hingePositionRatio = 0.5 }: Props) {
  const beamPx = frameL * PIXELS_PER_METER;
  const colH = frameH * PIXELS_PER_METER;
  const svgWidth = MARGIN_LEFT + beamPx + MARGIN_RIGHT;
  const svgHeight = MARGIN_TOP + colH + SUPPORT_H + MARGIN_BOTTOM;

  const xLeft = MARGIN_LEFT;
  const xRight = MARGIN_LEFT + beamPx;
  const ratio = Math.max(0.05, Math.min(0.95, hingePositionRatio));
  /** ヒンジ（円）の x。問題ごとに比率で指定可能 */
  const hingeX = xLeft + beamPx * ratio;
  /** 梁の幾何中心（ラベル・等分布矢印の対称基準用） */
  const xCenter = xLeft + beamPx / 2;
  const yBeam = MARGIN_TOP;
  const yBottom = MARGIN_TOP + colH;
  const ySupportBottom = yBottom + SUPPORT_H;
  /** 高さ寸法の縦線（I字）の x。ラベルはこの左に配置して被らないようにする */
  const dimHLineX = xLeft - DIM_H_LINE_X_OFFSET;

  const pinPoints = (x: number, y: number) =>
    `${x},${y} ${x - 10},${y + SUPPORT_H} ${x + 10},${y + SUPPORT_H}`;
  const isHorizontal = frameHorizontalP != null && frameHorizontalP > 0;
  const isDistributed = !isHorizontal && frameW != null && frameW > 0;

  return (
    <View style={{ alignItems: "center", marginLeft: 24 }}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* 左柱 */}
        <Line x1={xLeft} y1={yBeam} x2={xLeft} y2={yBottom} stroke="#333" strokeWidth={2} />
        {/* 右柱 */}
        <Line x1={xRight} y1={yBeam} x2={xRight} y2={yBottom} stroke="#333" strokeWidth={2} />
        {/* 梁（ヒンジ位置で分割） */}
        <Line x1={xLeft} y1={yBeam} x2={hingeX} y2={yBeam} stroke="#333" strokeWidth={2} />
        <Line x1={hingeX} y1={yBeam} x2={xRight} y2={yBeam} stroke="#333" strokeWidth={2} />
        {/* ヒンジ（問題で指定した位置に円を描画） */}
        <Circle cx={hingeX} cy={yBeam} r={HINGE_R} fill="#fff" stroke="#333" strokeWidth={1.5} />
        <Line x1={hingeX - HINGE_R} y1={yBeam} x2={hingeX + HINGE_R} y2={yBeam} stroke="#333" strokeWidth={1} />
        {/* 左ピン */}
        <Polygon points={pinPoints(xLeft, yBottom)} fill="#555" stroke="#333" strokeWidth={1} />
        {/* 右ピン */}
        <Polygon points={pinPoints(xRight, yBottom)} fill="#555" stroke="#333" strokeWidth={1} />
        {/* 荷重: 水平 P（左柱） / 集中 P（梁中央）/ 等分布 w */}
        {isHorizontal ? (
          <>
            <Line x1={xLeft} y1={yBeam + 10} x2={xLeft + 32} y2={yBeam + 10} stroke="#333" strokeWidth={2} />
            <Polygon
              points={`${xLeft + 32},${yBeam + 10} ${xLeft + 32 - ARROW_HEAD},${yBeam + 10 - ARROW_HEAD} ${xLeft + 32 - ARROW_HEAD},${yBeam + 10 + ARROW_HEAD}`}
              fill="#333"
              stroke="#333"
              strokeWidth={1}
            />
            <Text x={xLeft + 38} y={yBeam + 20} fill="#333" fontSize={12} textAnchor="start" fontWeight="bold">
              P={frameHorizontalP} kN
            </Text>
          </>
        ) : isDistributed ? (
          <>
            {(() => {
              const arrows: React.ReactNode[] = [];
              const arrowBottom = yBeam + UDL_ARROW_SIZE;
              const halfSpan = Math.floor(beamPx / UDL_ARROW_SPACING / 2) * UDL_ARROW_SPACING;
              let x = xCenter - halfSpan;
              while (x <= xCenter + halfSpan + 1) {
                if (x >= xLeft && x <= xRight) {
                  arrows.push(
                    <Line key={x} x1={x} y1={yBeam} x2={x} y2={arrowBottom} stroke="#333" strokeWidth={1.5} />,
                    <Polygon
                      key={`${x}-head`}
                      points={`${x},${arrowBottom + 3} ${x - 2.5},${arrowBottom - 2} ${x + 2.5},${arrowBottom - 2}`}
                      fill="#333"
                      stroke="#333"
                      strokeWidth={1}
                    />
                  );
                }
                x += UDL_ARROW_SPACING;
              }
              return arrows;
            })()}
            {/* 数値ブロック（w=16）だけ左に寄せ、イコールと数字の間の空白を詰める */}
            <Text x={xCenter - 16} y={yBeam - 20} fill="#333" fontSize={12} textAnchor="end" fontWeight="bold">
              w={frameW}
            </Text>
            <Text x={xCenter + 4} y={yBeam - 20} fill="#333" fontSize={12} textAnchor="start" fontWeight="bold">
              kN/m
            </Text>
          </>
        ) : (
          (() => {
            const loadY = yBeam - 22;
            const arrowHead = `${hingeX},${yBeam + ARROW_HEAD} ${hingeX - ARROW_HEAD},${yBeam - ARROW_HEAD} ${hingeX + ARROW_HEAD},${yBeam - ARROW_HEAD}`;
            return (
              <>
                <Line x1={hingeX} y1={loadY} x2={hingeX} y2={yBeam} stroke="#333" strokeWidth={2} />
                <Polygon points={arrowHead} fill="#333" stroke="#333" strokeWidth={1} />
                <Text x={hingeX} y={loadY - 8} fill="#333" fontSize={12} textAnchor="middle" fontWeight="bold">
                  P={frameP} kN
                </Text>
              </>
            );
          })()
        )}
        {/* 寸法: 高さ h（L= と同スタイル。ラベルを寸法線から十分離して被り防止） */}
        <Line x1={dimHLineX} y1={yBeam} x2={dimHLineX} y2={yBottom} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
        <Line x1={dimHLineX - DIM_TICK / 2} y1={yBeam} x2={dimHLineX + DIM_TICK / 2} y2={yBeam} stroke="#333" strokeWidth={1} />
        <Line x1={dimHLineX - DIM_TICK / 2} y1={yBottom} x2={dimHLineX + DIM_TICK / 2} y2={yBottom} stroke="#333" strokeWidth={1} />
        <Text x={dimHLineX - 34} y={(yBeam + yBottom) / 2 + 5} fill="#333" fontSize={12} textAnchor="end">
          h={frameH}{" "}m
        </Text>
        {/* 寸法: スパン L（支点より下に配置して被り防止） */}
        <Line x1={xLeft} y1={yBottom + DIM_L_VERTICAL} x2={xRight} y2={yBottom + DIM_L_VERTICAL} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
        <Line x1={xLeft} y1={yBottom + DIM_L_VERTICAL - DIM_TICK / 2} x2={xLeft} y2={yBottom + DIM_L_VERTICAL + DIM_TICK / 2} stroke="#333" strokeWidth={1} />
        <Line x1={xRight} y1={yBottom + DIM_L_VERTICAL - DIM_TICK / 2} x2={xRight} y2={yBottom + DIM_L_VERTICAL + DIM_TICK / 2} stroke="#333" strokeWidth={1} />
        <Text x={xCenter} y={yBottom + DIM_L_VERTICAL + 16} fill="#333" fontSize={12} textAnchor="middle">
          L = {frameL} m
        </Text>
      </Svg>
    </View>
  );
}
