import React from "react";
import { View } from "react-native";
import Svg, { Line, Polygon, Text } from "react-native-svg";
import type { BeamProblem } from "../types";

const PIXELS_PER_METER = 30;
const MARGIN_H = 40;
const CHART_HEIGHT = 56;
const ZERO_Y = 12;
const MAX_M_HEIGHT = 44;

/** 梁問題かどうか（解説で M図・Q図を表示する対象）。BeamMDiagram/BeamQDiagram と同一条件。 */
export function isBeamProblemWithDiagram(p: BeamProblem): boolean {
  if (p.problemCategory != null) {
    if (
      p.problemCategory === "section-properties" ||
      p.problemCategory === "bending-stress" ||
      p.problemCategory === "buckling" ||
      p.problemCategory === "truss-zero" ||
      p.problemCategory === "truss-calculation" ||
      p.problemCategory === "frame" ||
      p.problemCategory === "deflection"
    ) {
      return false;
    }
  }
  return p.structure === "simple" || p.structure === "cantilever" || p.structure === "overhang";
}

/** 梁問題かどうか（M図を描ける対象） */
function isBeamProblemForM(p: BeamProblem): boolean {
  return isBeamProblemWithDiagram(p);
}

/** 問題から曲げモーメントのサンプル点 { x [m], M [kN·m] } を取得。引張側を正（下側引張＝正）で統一。 */
function getMSamplePoints(problem: BeamProblem): { x: number; M: number }[] {
  const points: { x: number; M: number }[] = [];
  const n = 24;

  if (problem.type === "concentrated" && problem.structure === "simple") {
    const { L, a, b, P } = problem;
    const Va = (P * b) / L;
    const Vb = (P * a) / L;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      const M = x <= a ? Va * x : Va * x - P * (x - a);
      points.push({ x, M });
    }
    return points;
  }

  if (problem.type === "distributed" && problem.structure === "simple") {
    const { L, w } = problem;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      points.push({ x, M: (w * x * (L - x)) / 2 });
    }
    return points;
  }

  if (problem.type === "concentrated" && problem.structure === "cantilever") {
    const { L, a, P } = problem;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      const M = x <= a ? P * (a - x) : 0;
      points.push({ x, M });
    }
    return points;
  }

  if (problem.type === "distributed" && problem.structure === "cantilever") {
    const { L, w } = problem;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      points.push({ x, M: (w * (L - x) * (L - x)) / 2 });
    }
    return points;
  }

  if (problem.type === "concentrated" && problem.structure === "overhang" && problem.overhangLength != null) {
    const { L, P, a, overhangLength: c } = problem;
    const total = L + c;
    if (a >= L) {
      const Va = (P * c) / L;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * total;
        const M = x <= L ? Va * x : P * (total - x);
        points.push({ x, M });
      }
    } else {
      const Va = (P * (L - a)) / L;
      const Vb = (P * a) / L;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * total;
        let M: number;
        if (x <= a) M = Va * x;
        else if (x <= L) M = Va * x - P * (x - a);
        else M = 0;
        points.push({ x, M });
      }
    }
    return points;
  }

  if (problem.type === "distributed" && problem.structure === "overhang" && problem.overhangLength != null) {
    const { L, w, overhangLength: c } = problem;
    const total = L + c;
    const Va = (w * (L * L - c * c)) / (2 * L);
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * total;
      const M = x <= L ? Va * x - (w * x * x) / 2 : -(w * (total - x) * (total - x)) / 2;
      points.push({ x, M });
    }
    return points;
  }

  return [];
}

type Props = {
  problem: BeamProblem;
};

/** 曲げモーメント図（解説用）。梁の下に M の分布を折れ線で表示。引張側を正。 */
export function BeamMDiagram({ problem }: Props) {
  if (!isBeamProblemForM(problem)) return null;

  const points = getMSamplePoints(problem);
  if (points.length === 0) return null;

  const totalLength =
    problem.structure === "overhang" && problem.overhangLength != null
      ? problem.L + problem.overhangLength
      : problem.L;
  const beamWidth = totalLength * PIXELS_PER_METER;
  const svgWidth = beamWidth + 2 * MARGIN_H;
  const svgHeight = ZERO_Y + MAX_M_HEIGHT + 20;
  const xLeft = MARGIN_H;

  const maxAbsM = Math.max(...points.map((p) => Math.abs(p.M)), 1);
  const scaleM = MAX_M_HEIGHT / maxAbsM;

  const polyPoints = points
    .map(({ x, M }) => {
      const px = xLeft + (x / totalLength) * beamWidth;
      const py = ZERO_Y + M * scaleM;
      return `${px},${py}`;
    })
    .join(" ");

  const zeroXLeft = xLeft;
  const zeroXRight = xLeft + beamWidth;

  return (
    <View style={{ alignItems: "center", marginTop: 8 }}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <Text x={xLeft - 6} y={ZERO_Y + 4} fill="#666" fontSize={10} textAnchor="end">
          M
        </Text>
        <Line
          x1={zeroXLeft}
          y1={ZERO_Y}
          x2={zeroXRight}
          y2={ZERO_Y}
          stroke="#999"
          strokeWidth={1}
          strokeDasharray="4,2"
        />
        <Polygon
          points={`${zeroXLeft},${ZERO_Y} ${polyPoints} ${zeroXRight},${ZERO_Y}`}
          fill="rgba(25, 118, 210, 0.15)"
          stroke="#1976d2"
          strokeWidth={1.5}
        />
        <Line
          x1={zeroXLeft}
          y1={ZERO_Y}
          x2={zeroXLeft + (points[0].x / totalLength) * beamWidth}
          y2={ZERO_Y + points[0].M * scaleM}
          stroke="#1976d2"
          strokeWidth={1.5}
        />
        {points.slice(1).map((_, i) => (
          <Line
            key={i}
            x1={xLeft + (points[i].x / totalLength) * beamWidth}
            y1={ZERO_Y + points[i].M * scaleM}
            x2={xLeft + (points[i + 1].x / totalLength) * beamWidth}
            y2={ZERO_Y + points[i + 1].M * scaleM}
            stroke="#1976d2"
            strokeWidth={1.5}
          />
        ))}
        <Text x={svgWidth / 2} y={svgHeight - 4} fill="#666" fontSize={10} textAnchor="middle">
          曲げモーメント図 M
        </Text>
      </Svg>
    </View>
  );
}
