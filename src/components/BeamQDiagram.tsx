import React from "react";
import { View } from "react-native";
import Svg, { Line, Polygon, Text } from "react-native-svg";
import type { BeamProblem } from "../types";

const PIXELS_PER_METER = 30;
const MARGIN_H = 40;
const CHART_HEIGHT = 56;
const ZERO_Y = 28;
const MAX_Q_HEIGHT = 24;

/** 梁問題かどうか（Q図を描ける対象） */
function isBeamProblemForQ(p: BeamProblem): boolean {
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

/** 問題からせん断力のサンプル点 { x [m], Q [kN] } を取得。左側上向きを正。 */
function getQSamplePoints(problem: BeamProblem): { x: number; Q: number }[] {
  const points: { x: number; Q: number }[] = [];
  const n = 24;

  if (problem.type === "concentrated" && problem.structure === "simple") {
    const { L, a, b, P } = problem;
    const Va = (P * b) / L;
    const Vb = (P * a) / L;
    // 単純梁・集中荷重では、せん断力 Q は
    // 左支点〜荷重点: Q = V_A（一定）
    // 荷重点〜右支点: Q = -V_B（一定）
    // となるため、厳密に「水平→垂直→水平」の折れ線だけを返す。
    points.push({ x: 0, Q: Va });
    if (a > 0 && a < L) {
      points.push({ x: a, Q: Va });
      points.push({ x: a, Q: -Vb });
    }
    points.push({ x: L, Q: -Vb });
    return points;
  }

  if (problem.type === "distributed" && problem.structure === "simple") {
    const { L, w } = problem;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      points.push({ x, Q: (w * L) / 2 - w * x });
    }
    return points;
  }

  if (problem.type === "concentrated" && problem.structure === "cantilever") {
    const { L, a, P } = problem;
    // 片持ち梁・集中荷重では、せん断力 Q は
    //  0 ≦ x < a: Q = P（一定）
    //  a ≦ x ≦ L: Q = 0
    // となる。集中荷重点で垂直に落ちるステップ関数になるよう、
    // 端点と荷重点だけを明示的に返す。
    points.push({ x: 0, Q: P });
    if (a > 0 && a < L) {
      points.push({ x: a, Q: P });
      points.push({ x: a, Q: 0 });
    } else {
      // 荷重が自由端（a = L）の場合
      points.push({ x: L, Q: P });
      points.push({ x: L, Q: 0 });
    }
    return points;
  }

  if (problem.type === "distributed" && problem.structure === "cantilever") {
    const { L, w } = problem;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      points.push({ x, Q: w * (L - x) });
    }
    return points;
  }

  if (problem.type === "concentrated" && problem.structure === "overhang" && problem.overhangLength != null) {
    const { L, P, a, overhangLength: c } = problem;
    const total = L + c;
    if (a >= L) {
      // 自由端荷重（a = L + c）のときの反力:
      // V_A = -P c / L（下向き）, V_B = P(L + c)/L（上向き）
      const Va = -(P * c) / L;
      const Vb = (P * (L + c)) / L;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * total;
        // せん断力: スパン内は Q = V_A（負）、張り出し部は Q = V_A + V_B = P（正）
        const Q = x < L ? Va : Va + Vb;
        points.push({ x, Q });
      }
    } else {
      // 荷重がスパン内 (0 < a < L) の張り出し梁:
      // 反力は単純梁と同じ: V_A = P(L−a)/L, V_B = Pa/L（上向き）
      // せん断力は
      //  0 ≦ x < a:   Q = V_A
      //  a ≦ x < L:   Q = V_A − P
      //  L ≦ x ≦ L+c: Q = 0
      const Va = (P * (L - a)) / L;
      // const Vb = (P * a) / L; // 釣り合いより V_A + V_B = P → V_A − P + V_B = 0

      points.push({ x: 0, Q: Va });
      if (a > 0 && a < L) {
        points.push({ x: a, Q: Va });
        points.push({ x: a, Q: Va - P });
      }
      points.push({ x: L, Q: Va - P });
      points.push({ x: L, Q: 0 });
    }
    return points;
  }

  if (problem.type === "distributed" && problem.structure === "overhang" && problem.overhangLength != null) {
    const { L, w, overhangLength: c } = problem;
    const total = L + c;
    const Va = (w * (L * L - c * c)) / (2 * L);
    const Vb = (w * (L + c) * (L + c)) / (2 * L);
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * total;
      // 張り出し梁の等分布では、
      //  0 ≦ x < L:      Q(x) = V_A − w x
      //  L ≦ x ≦ L + c: Q(x) = V_A + V_B − w x
      // となる。x=L でのジャンプ量は V_B。
      const Q = x < L ? Va - w * x : Va + Vb - w * x;
      points.push({ x, Q });
    }
    return points;
  }

  return [];
}

type Props = {
  problem: BeamProblem;
};

/** せん断力図（解説用）。梁の下に Q の分布を折れ線で表示。正は上向き（左側が上向き）。 */
export function BeamQDiagram({ problem }: Props) {
  if (!isBeamProblemForQ(problem)) return null;

  const points = getQSamplePoints(problem);
  if (points.length === 0) return null;

  const totalLength =
    problem.structure === "overhang" && problem.overhangLength != null
      ? problem.L + problem.overhangLength
      : problem.L;
  const beamWidth = totalLength * PIXELS_PER_METER;
  const svgWidth = beamWidth + 2 * MARGIN_H;
  const svgHeight = CHART_HEIGHT + 20;
  const xLeft = MARGIN_H;

  const maxAbsQ = Math.max(...points.map((p) => Math.abs(p.Q)), 1);
  const scaleQ = MAX_Q_HEIGHT / maxAbsQ;
  const yForQ = (Q: number) => ZERO_Y - Q * scaleQ;

  const polyPoints = points
    .map(({ x, Q }) => {
      const px = xLeft + (x / totalLength) * beamWidth;
      const py = yForQ(Q);
      return `${px},${py}`;
    })
    .join(" ");

  const zeroXLeft = xLeft;
  const zeroXRight = xLeft + beamWidth;

  return (
    <View style={{ alignItems: "center", marginTop: 4 }}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <Text x={xLeft - 6} y={ZERO_Y + 4} fill="#666" fontSize={10} textAnchor="end">
          Q
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
          fill="rgba(76, 175, 80, 0.12)"
          stroke="#4caf50"
          strokeWidth={1.5}
        />
        {points.slice(1).map((_, i) => (
          <Line
            key={i}
            x1={xLeft + (points[i].x / totalLength) * beamWidth}
            y1={yForQ(points[i].Q)}
            x2={xLeft + (points[i + 1].x / totalLength) * beamWidth}
            y2={yForQ(points[i + 1].Q)}
            stroke="#4caf50"
            strokeWidth={1.5}
          />
        ))}
        <Line
          x1={xLeft}
          y1={ZERO_Y}
          x2={xLeft + (points[0].x / totalLength) * beamWidth}
          y2={yForQ(points[0].Q)}
          stroke="#4caf50"
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}
