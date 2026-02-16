import React from "react";
import { View } from "react-native";
import Svg, { Line, Polygon, Text, TSpan } from "react-native-svg";
import type { BeamProblem } from "../types";

const PIXELS_PER_METER = 30;
const MARGIN_H = 40;

const P_LABEL_Y = 20;
const BEAM_Y = 80;
const SUPPORT_H = 20;
const SUPPORT_BOTTOM_Y = BEAM_Y + SUPPORT_H;
const ROLLER_LINE_Y = SUPPORT_BOTTOM_Y + 4;
const REACTION_LABEL_Y = SUPPORT_BOTTOM_Y + 14;
const DIM_AB_Y = 130;
const DIM_L_Y = 160;
const DIM_L_Y_DISTRIBUTED = 130;
const DIM_TICK = 6;
const DIM_LABEL_OFFSET = 14;

// 等分布荷重の comb（上端線）の Y 座標
// スマホでも w ラベルが見切れないよう少し下げる
const DISTRIBUTED_COMB_TOP_Y = 28;
const DISTRIBUTED_ARROW_SPACING = 20;
const DISTRIBUTED_ARROW_HEAD = 4;

const FIXED_WALL_WIDTH = 16;
const HATCH_SPACING = 4;
// 固定端ハッチングは梁の高さ付近に収める
const HATCH_TOP = BEAM_Y - 8;
const HATCH_BOTTOM = SUPPORT_BOTTOM_Y;

type BeamDiagramProps = {
  problem: BeamProblem;
};

/** 片持ち梁: 左端固定（縦線 + ハッチング）、右端自由 */
function FixedEndWall({ xLeft }: { xLeft: number }) {
  const hatchLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let y = HATCH_TOP; y <= HATCH_BOTTOM; y += HATCH_SPACING) {
    hatchLines.push({ x1: xLeft - FIXED_WALL_WIDTH, y1: y, x2: xLeft, y2: y + 8 });
  }
  return (
    <>
      <Line x1={xLeft} y1={HATCH_TOP} x2={xLeft} y2={SUPPORT_BOTTOM_Y} stroke="#333" strokeWidth={2} />
      {hatchLines.map((line, i) => (
        <Line
          key={`hatch-${i}`}
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

function ConcentratedDiagram({
  L,
  a,
  b,
  P,
  xLeft,
  xRight,
  beamWidth,
  hideDimensionB,
}: {
  L: number;
  a: number;
  b: number;
  P: number;
  xLeft: number;
  xRight: number;
  beamWidth: number;
  hideDimensionB?: boolean;
}) {
  const ratio =
    L > 0 && Number.isFinite(Number(a)) ? Math.max(0, Math.min(1, Number(a) / L)) : 0;
  const xLoad = xLeft + beamWidth * ratio;
  const pinPoints = `${xLeft},${BEAM_Y} ${xLeft - 8},${SUPPORT_BOTTOM_Y} ${xLeft + 8},${SUPPORT_BOTTOM_Y}`;
  const rollerPoints = `${xRight},${BEAM_Y} ${xRight - 8},${SUPPORT_BOTTOM_Y} ${xRight + 8},${SUPPORT_BOTTOM_Y}`;
  const arrowHeadSize = 6;
  const arrowHeadPoints = `${xLoad - arrowHeadSize},${BEAM_Y - arrowHeadSize} ${xLoad},${BEAM_Y} ${xLoad + arrowHeadSize},${BEAM_Y - arrowHeadSize}`;
  const dimAbTickY1 = DIM_AB_Y - DIM_TICK / 2;
  const dimAbTickY2 = DIM_AB_Y + DIM_TICK / 2;
  const dimLTickY1 = DIM_L_Y - DIM_TICK / 2;
  const dimLTickY2 = DIM_L_Y + DIM_TICK / 2;

  return (
    <>
      <Line x1={xLeft} y1={BEAM_Y} x2={xRight} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon points={pinPoints} fill="#555" stroke="#333" strokeWidth={1} />
      <Polygon points={rollerPoints} fill="#555" stroke="#333" strokeWidth={1} />
      <Line
        x1={xRight - 12}
        y1={ROLLER_LINE_Y}
        x2={xRight + 12}
        y2={ROLLER_LINE_Y}
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={xLoad} y1={P_LABEL_Y} x2={xLoad} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon points={arrowHeadPoints} fill="#333" stroke="#333" strokeWidth={1} />
      <Text
        x={xLoad}
        y={P_LABEL_Y - 6}
        fill="#333"
        fontSize={12}
        textAnchor="middle"
        fontWeight="bold"
      >
        {P} kN
      </Text>
      {/* a, b dimension */}
      <Line x1={xLeft} y1={DIM_AB_Y} x2={xRight} y2={DIM_AB_Y} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimAbTickY1} x2={xLeft} y2={dimAbTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xLoad} y1={dimAbTickY1} x2={xLoad} y2={dimAbTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xLoad) / 2} y={DIM_AB_Y + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        a = {a} m
      </Text>
      {!hideDimensionB && (
        <>
          <Line x1={xRight} y1={dimAbTickY1} x2={xRight} y2={dimAbTickY2} stroke="#333" strokeWidth={1} />
          <Text
            x={(xLoad + xRight) / 2}
            y={DIM_AB_Y + DIM_LABEL_OFFSET}
            fill="#333"
            fontSize={12}
            textAnchor="middle"
          >
            b = {b} m
          </Text>
        </>
      )}
      {/* L dimension */}
      <Line x1={xLeft} y1={DIM_L_Y} x2={xRight} y2={DIM_L_Y} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimLTickY1} x2={xLeft} y2={dimLTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xRight} y1={dimLTickY1} x2={xRight} y2={dimLTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xRight) / 2} y={DIM_L_Y + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        L = {L} m
      </Text>
    </>
  );
}

/** 張り出し梁: 支点A(0)-支点B(L)-張り出し(c)。荷重 P は支点Aから a [m] の位置（a=L+c で自由端、a<L でスパン内） */
function OverhangConcentratedDiagram({
  L,
  c,
  a,
  P,
  xLeft,
  xRight,
  beamWidth,
}: {
  L: number;
  c: number;
  a: number;
  P: number;
  xLeft: number;
  xRight: number;
  beamWidth: number;
}) {
  const total = L + c;
  const xB = xLeft + (L / total) * beamWidth;
  const ratio = total > 0 ? Math.max(0, Math.min(1, a / total)) : 1;
  const xLoad = xLeft + ratio * beamWidth;
  const pinPoints = `${xLeft},${BEAM_Y} ${xLeft - 8},${SUPPORT_BOTTOM_Y} ${xLeft + 8},${SUPPORT_BOTTOM_Y}`;
  const rollerPoints = `${xB},${BEAM_Y} ${xB - 8},${SUPPORT_BOTTOM_Y} ${xB + 8},${SUPPORT_BOTTOM_Y}`;
  const arrowHeadSize = 6;
  const arrowHeadPoints = `${xLoad - arrowHeadSize},${BEAM_Y - arrowHeadSize} ${xLoad},${BEAM_Y} ${xLoad + arrowHeadSize},${BEAM_Y - arrowHeadSize}`;
  const dimY = DIM_AB_Y;
  const dimTickY1 = dimY - DIM_TICK / 2;
  const dimTickY2 = dimY + DIM_TICK / 2;
  const dimLY = DIM_L_Y;
  const dimLTickY1 = dimLY - DIM_TICK / 2;
  const dimLTickY2 = dimLY + DIM_TICK / 2;

  return (
    <>
      <Line x1={xLeft} y1={BEAM_Y} x2={xRight} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon points={pinPoints} fill="#555" stroke="#333" strokeWidth={1} />
      <Polygon points={rollerPoints} fill="#555" stroke="#333" strokeWidth={1} />
      <Line
        x1={xB - 12}
        y1={ROLLER_LINE_Y}
        x2={xB + 12}
        y2={ROLLER_LINE_Y}
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={xLoad} y1={P_LABEL_Y} x2={xLoad} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon points={arrowHeadPoints} fill="#333" stroke="#333" strokeWidth={1} />
      <Text
        x={xLoad}
        y={P_LABEL_Y - 6}
        fill="#333"
        fontSize={12}
        textAnchor="middle"
        fontWeight="bold"
      >
        {P} kN
      </Text>
      {/* L 寸法（支点間） */}
      <Line x1={xLeft} y1={dimLY} x2={xB} y2={dimLY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimLTickY1} x2={xLeft} y2={dimLTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xB} y1={dimLTickY1} x2={xB} y2={dimLTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xB) / 2} y={dimLY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        L = {L} m
      </Text>
      {/* c 寸法（張り出し） */}
      <Line x1={xB} y1={dimY} x2={xRight} y2={dimY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xB} y1={dimTickY1} x2={xB} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xRight} y1={dimTickY1} x2={xRight} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xB + xRight) / 2} y={dimY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        c = {c} m
      </Text>
      {/* a 寸法（支点Aから荷重まで。スパン内のとき表示） */}
      {a < L && (() => {
        const dimAY = 58;
        const daTick1 = dimAY - DIM_TICK / 2;
        const daTick2 = dimAY + DIM_TICK / 2;
        return (
          <>
            <Line x1={xLeft} y1={dimAY} x2={xLoad} y2={dimAY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
            <Line x1={xLeft} y1={daTick1} x2={xLeft} y2={daTick2} stroke="#333" strokeWidth={1} />
            <Line x1={xLoad} y1={daTick1} x2={xLoad} y2={daTick2} stroke="#333" strokeWidth={1} />
            <Text x={(xLeft + xLoad) / 2} y={dimAY + DIM_LABEL_OFFSET} fill="#333" fontSize={11} textAnchor="middle">
              a = {a} m
            </Text>
          </>
        );
      })()}
    </>
  );
}

function CantileverConcentratedDiagram({
  L,
  a,
  P,
  xLeft,
  xRight,
  beamWidth,
}: {
  L: number;
  a: number;
  P: number;
  xLeft: number;
  xRight: number;
  beamWidth: number;
}) {
  // 固定端(xLeft)から荷重までの距離 a を梁長 L で割った比。L=0 や a 未定義時は自由端に描画
  const ratio =
    L > 0 && Number.isFinite(Number(a)) ? Math.max(0, Math.min(1, Number(a) / L)) : 1;
  const xLoad = xLeft + beamWidth * ratio;
  const arrowHeadSize = 6;
  const arrowHeadPoints = `${xLoad - arrowHeadSize},${BEAM_Y - arrowHeadSize} ${xLoad},${BEAM_Y} ${xLoad + arrowHeadSize},${BEAM_Y - arrowHeadSize}`;
  const dimAY = DIM_AB_Y;
  const dimATickY1 = dimAY - DIM_TICK / 2;
  const dimATickY2 = dimAY + DIM_TICK / 2;
  const dimLY = DIM_L_Y;
  const dimLTickY1 = dimLY - DIM_TICK / 2;
  const dimLTickY2 = dimLY + DIM_TICK / 2;

  return (
    <>
      <FixedEndWall xLeft={xLeft} />
      <Line x1={xLeft} y1={BEAM_Y} x2={xRight} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Line x1={xLoad} y1={P_LABEL_Y} x2={xLoad} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon points={arrowHeadPoints} fill="#333" stroke="#333" strokeWidth={1} />
      <Text x={xLoad} y={P_LABEL_Y - 6} fill="#333" fontSize={12} textAnchor="middle" fontWeight="bold">
        {P} kN
      </Text>
      {/* a 寸法（固定端から荷重まで） */}
      <Line x1={xLeft} y1={dimAY} x2={xLoad} y2={dimAY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimATickY1} x2={xLeft} y2={dimATickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xLoad} y1={dimATickY1} x2={xLoad} y2={dimATickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xLoad) / 2} y={dimAY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        a = {a} m
      </Text>
      {/* L 寸法 */}
      <Line x1={xLeft} y1={dimLY} x2={xRight} y2={dimLY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimLTickY1} x2={xLeft} y2={dimLTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xRight} y1={dimLTickY1} x2={xRight} y2={dimLTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xRight) / 2} y={dimLY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        L = {L} m
      </Text>
    </>
  );
}

function CantileverDistributedDiagram({
  L,
  w,
  xLeft,
  xRight,
}: {
  L: number;
  w: number;
  xLeft: number;
  xRight: number;
}) {
  const dimY = DIM_L_Y_DISTRIBUTED;
  const dimTickY1 = dimY - DIM_TICK / 2;
  const dimTickY2 = dimY + DIM_TICK / 2;
  const arrowPositions: number[] = [];
  for (let x = xLeft; x <= xRight; x += DISTRIBUTED_ARROW_SPACING) {
    arrowPositions.push(x);
  }
  if (arrowPositions.length > 0 && arrowPositions[arrowPositions.length - 1] < xRight - 2) {
    arrowPositions.push(xRight);
  }

  return (
    <>
      <FixedEndWall xLeft={xLeft} />
      <Line x1={xLeft} y1={BEAM_Y} x2={xRight} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Line x1={xLeft} y1={DISTRIBUTED_COMB_TOP_Y} x2={xRight} y2={DISTRIBUTED_COMB_TOP_Y} stroke="#333" strokeWidth={1} />
      {arrowPositions.map((x, index) => {
        const headY = BEAM_Y - DISTRIBUTED_ARROW_HEAD;
        const headL = `${x - DISTRIBUTED_ARROW_HEAD},${headY} ${x},${BEAM_Y} ${x + DISTRIBUTED_ARROW_HEAD},${headY}`;
        return (
          <React.Fragment key={`cant-dist-${index}`}>
            <Line x1={x} y1={DISTRIBUTED_COMB_TOP_Y} x2={x} y2={BEAM_Y} stroke="#333" strokeWidth={1.5} />
            <Polygon points={headL} fill="#333" stroke="#333" strokeWidth={1} />
          </React.Fragment>
        );
      })}
      <Text
        x={(xLeft + xRight) / 2}
        y={DISTRIBUTED_COMB_TOP_Y - 8}
        fill="#333"
        fontSize={12}
        textAnchor="middle"
        fontWeight="bold"
      >
        <TSpan>{`w = ${w}`}</TSpan>
        <TSpan dx={4} fontSize={10}>
          kN/m
        </TSpan>
      </Text>
      <Line x1={xLeft} y1={dimY} x2={xRight} y2={dimY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimTickY1} x2={xLeft} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xRight} y1={dimTickY1} x2={xRight} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xRight) / 2} y={dimY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        L = {L} m
      </Text>
    </>
  );
}

/** 張り出し梁・等分布: 支点A–B 間 L、張り出し c。全長に w。 */
function OverhangDistributedDiagram({
  L,
  c,
  w,
  xLeft,
  xRight,
  beamWidth,
}: {
  L: number;
  c: number;
  w: number;
  xLeft: number;
  xRight: number;
  beamWidth: number;
}) {
  const totalLength = L + c;
  const xB = xLeft + (L / totalLength) * beamWidth;
  const dimY = DIM_L_Y_DISTRIBUTED;
  const dimTickY1 = dimY - DIM_TICK / 2;
  const dimTickY2 = dimY + DIM_TICK / 2;

  const arrowPositions: number[] = [];
  for (let x = xLeft; x <= xRight; x += DISTRIBUTED_ARROW_SPACING) {
    arrowPositions.push(x);
  }
  if (arrowPositions.length > 0 && arrowPositions[arrowPositions.length - 1] < xRight - 2) {
    arrowPositions.push(xRight);
  }

  return (
    <>
      <Line x1={xLeft} y1={BEAM_Y} x2={xRight} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${xLeft},${BEAM_Y} ${xLeft - 8},${SUPPORT_BOTTOM_Y} ${xLeft + 8},${SUPPORT_BOTTOM_Y}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Polygon
        points={`${xB},${BEAM_Y} ${xB - 8},${SUPPORT_BOTTOM_Y} ${xB + 8},${SUPPORT_BOTTOM_Y}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={xB - 12}
        y1={ROLLER_LINE_Y}
        x2={xB + 12}
        y2={ROLLER_LINE_Y}
        stroke="#333"
        strokeWidth={1}
      />
      <Line x1={xLeft} y1={DISTRIBUTED_COMB_TOP_Y} x2={xRight} y2={DISTRIBUTED_COMB_TOP_Y} stroke="#333" strokeWidth={1} />
      {arrowPositions.map((x, index) => {
        const headY = BEAM_Y - DISTRIBUTED_ARROW_HEAD;
        const headL = `${x - DISTRIBUTED_ARROW_HEAD},${headY} ${x},${BEAM_Y} ${x + DISTRIBUTED_ARROW_HEAD},${headY}`;
        return (
          <React.Fragment key={`oh-dist-${index}`}>
            <Line x1={x} y1={DISTRIBUTED_COMB_TOP_Y} x2={x} y2={BEAM_Y} stroke="#333" strokeWidth={1.5} />
            <Polygon points={headL} fill="#333" stroke="#333" strokeWidth={1} />
          </React.Fragment>
        );
      })}
      <Text
        x={(xLeft + xRight) / 2}
        y={DISTRIBUTED_COMB_TOP_Y - 8}
        fill="#333"
        fontSize={12}
        textAnchor="middle"
        fontWeight="bold"
      >
        <TSpan>{`w = ${w}`}</TSpan>
        <TSpan dx={4} fontSize={10}>
          kN/m
        </TSpan>
      </Text>
      <Line x1={xLeft} y1={dimY} x2={xB} y2={dimY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimTickY1} x2={xLeft} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xB} y1={dimTickY1} x2={xB} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xB) / 2} y={dimY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        L = {L} m
      </Text>
      <Line x1={xB} y1={dimY} x2={xRight} y2={dimY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xB} y1={dimTickY1} x2={xB} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xRight} y1={dimTickY1} x2={xRight} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xB + xRight) / 2} y={dimY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        c = {c} m
      </Text>
    </>
  );
}

function DistributedDiagram({
  L,
  w,
  xLeft,
  xRight,
}: {
  L: number;
  w: number;
  xLeft: number;
  xRight: number;
}) {
  const dimY = DIM_L_Y_DISTRIBUTED;
  const dimTickY1 = dimY - DIM_TICK / 2;
  const dimTickY2 = dimY + DIM_TICK / 2;

  const arrowPositions: number[] = [];
  for (let x = xLeft; x <= xRight; x += DISTRIBUTED_ARROW_SPACING) {
    arrowPositions.push(x);
  }
  if (arrowPositions.length > 0 && arrowPositions[arrowPositions.length - 1] < xRight - 2) {
    arrowPositions.push(xRight);
  }

  return (
    <>
      <Line x1={xLeft} y1={BEAM_Y} x2={xRight} y2={BEAM_Y} stroke="#333" strokeWidth={2} />
      <Polygon
        points={`${xLeft},${BEAM_Y} ${xLeft - 8},${SUPPORT_BOTTOM_Y} ${xLeft + 8},${SUPPORT_BOTTOM_Y}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Polygon
        points={`${xRight},${BEAM_Y} ${xRight - 8},${SUPPORT_BOTTOM_Y} ${xRight + 8},${SUPPORT_BOTTOM_Y}`}
        fill="#555"
        stroke="#333"
        strokeWidth={1}
      />
      <Line
        x1={xRight - 12}
        y1={ROLLER_LINE_Y}
        x2={xRight + 12}
        y2={ROLLER_LINE_Y}
        stroke="#333"
        strokeWidth={1}
      />
      {/* 等分布: 上端を結ぶ水平線 */}
      <Line
        x1={xLeft}
        y1={DISTRIBUTED_COMB_TOP_Y}
        x2={xRight}
        y2={DISTRIBUTED_COMB_TOP_Y}
        stroke="#333"
        strokeWidth={1}
      />
      {/* 等間隔の下向き矢印 (comb) */}
      {arrowPositions.map((x, index) => {
        const yTop = DISTRIBUTED_COMB_TOP_Y;
        const yBottom = BEAM_Y;
        const headY = yBottom - DISTRIBUTED_ARROW_HEAD;
        const headL = `${x - DISTRIBUTED_ARROW_HEAD},${headY} ${x},${yBottom} ${x + DISTRIBUTED_ARROW_HEAD},${headY}`;
        return (
          <React.Fragment key={`dist-arrow-${index}`}>
            <Line x1={x} y1={yTop} x2={x} y2={yBottom} stroke="#333" strokeWidth={1.5} />
            <Polygon points={headL} fill="#333" stroke="#333" strokeWidth={1} />
          </React.Fragment>
        );
      })}
      <Text
        x={(xLeft + xRight) / 2}
        y={DISTRIBUTED_COMB_TOP_Y - 8}
        fill="#333"
        fontSize={12}
        textAnchor="middle"
        fontWeight="bold"
      >
        <TSpan>{`w = ${w}`}</TSpan>
        <TSpan dx={4} fontSize={10}>
          kN/m
        </TSpan>
      </Text>
      {/* L 寸法のみ */}
      <Line x1={xLeft} y1={dimY} x2={xRight} y2={dimY} stroke="#333" strokeWidth={1} strokeDasharray="4,2" />
      <Line x1={xLeft} y1={dimTickY1} x2={xLeft} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Line x1={xRight} y1={dimTickY1} x2={xRight} y2={dimTickY2} stroke="#333" strokeWidth={1} />
      <Text x={(xLeft + xRight) / 2} y={dimY + DIM_LABEL_OFFSET} fill="#333" fontSize={12} textAnchor="middle">
        L = {L} m
      </Text>
    </>
  );
}

export function BeamDiagram({ problem }: BeamDiagramProps) {
  const isOverhang =
    problem.structure === "overhang" && problem.overhangLength != null;
  const totalLength = isOverhang
    ? problem.L + problem.overhangLength!
    : problem.L;
  const beamWidth = totalLength * PIXELS_PER_METER;
  const svgWidth = beamWidth + 2 * MARGIN_H;
  const xLeft = MARGIN_H;
  const xRight = MARGIN_H + beamWidth;

  const isSimple = problem.structure === "simple";
  const isOverhangStructure = problem.structure === "overhang";
  const needsTwoRows = problem.type === "concentrated";
  const svgHeight = needsTwoRows
    ? DIM_L_Y + DIM_LABEL_OFFSET + 14
    : DIM_L_Y_DISTRIBUTED + DIM_LABEL_OFFSET + 14;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {isOverhangStructure && problem.type === "concentrated" ? (
          <OverhangConcentratedDiagram
            L={problem.L}
            c={problem.overhangLength!}
            a={problem.a}
            P={problem.P}
            xLeft={xLeft}
            xRight={xRight}
            beamWidth={beamWidth}
          />
        ) : isOverhangStructure && problem.type === "distributed" && problem.overhangLength != null ? (
          <OverhangDistributedDiagram
            L={problem.L}
            c={problem.overhangLength}
            w={problem.w}
            xLeft={xLeft}
            xRight={xRight}
            beamWidth={beamWidth}
          />
        ) : problem.structure === "cantilever" ? (
          problem.type === "concentrated" ? (
            <CantileverConcentratedDiagram
              L={problem.L}
              a={problem.a}
              P={problem.P}
              xLeft={xLeft}
              xRight={xRight}
              beamWidth={beamWidth}
            />
          ) : (
            <CantileverDistributedDiagram
              L={problem.L}
              w={problem.w}
              xLeft={xLeft}
              xRight={xRight}
            />
          )
        ) : problem.type === "concentrated" ? (
          <ConcentratedDiagram
            L={problem.L}
            a={problem.a}
            b={problem.b}
            P={problem.P}
            xLeft={xLeft}
            xRight={xRight}
            beamWidth={beamWidth}
            hideDimensionB={problem.hideDimensionB}
          />
        ) : (
          <DistributedDiagram
            L={problem.L}
            w={problem.w}
            xLeft={xLeft}
            xRight={xRight}
          />
        )}
        {problem.target === "Va" && (
          <Text
            x={xLeft}
            y={REACTION_LABEL_Y}
            fill="#1976d2"
            fontSize={11}
            textAnchor="middle"
            fontWeight="bold"
          >
            V_A = ?
          </Text>
        )}
        {(isSimple || isOverhangStructure) && problem.target === "Vb" && (
          <Text
            x={isOverhangStructure ? xLeft + (problem.L / totalLength) * beamWidth : xRight}
            y={REACTION_LABEL_Y}
            fill="#1976d2"
            fontSize={11}
            textAnchor="middle"
            fontWeight="bold"
          >
            V_B = ?
          </Text>
        )}
      </Svg>
    </View>
  );
}
