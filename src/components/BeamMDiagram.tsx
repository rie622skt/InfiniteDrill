import React from "react";
import { View } from "react-native";
import Svg, { Line, Polygon, Text } from "react-native-svg";
import type { BeamProblem } from "../types";

const PIXELS_PER_METER = 30;
const MARGIN_H = 40;
const CHART_HEIGHT = 56;
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

export type BMDVariant =
  | "correct"
  | "reversed"
  | "straight_as_curve"
  | "curve_as_straight"
  | "peak_at_center"
  | "peak_at_support";

/** 正しいM分布のサンプル点を取得（getMSamplePointsの結果を加工しない） */
function getCorrectMSamplePoints(problem: BeamProblem): { x: number; M: number }[] {
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

    // a >= L: 自由端荷重パターン（支点A(0)–支点B(L)–張り出しc, 荷重は x = L + c）
    // 反力: V_A = -P c / L, V_B = P(L + c) / L
    if (a >= L) {
      const Va = -(P * c) / L;
      const Vb = (P * (L + c)) / L;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * total;
        let M: number;
        if (x <= L) {
          // スパン内: M(x) = V_A × x（上端引張 → M < 0）
          M = Va * x;
        } else {
          // 張り出し部: M(x) = V_A×x + V_B×(x − L)
          M = Va * x + Vb * (x - L);
        }
        points.push({ x, M });
      }
    } else {
      // a < L: 荷重がスパン内にある張り出し梁（単純梁部分の式を流用）
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

/** バリアントに応じて誤ったM分布を返す（BMD形状選択問題用） */
function applyBMDVariant(
  points: { x: number; M: number }[],
  problem: BeamProblem,
  variant: BMDVariant
): { x: number; M: number }[] {
  if (variant === "correct") return points;

  const n = points.length;
  const L = points[n - 1]?.x ?? problem.L;
  const totalLength =
    problem.structure === "overhang" && problem.overhangLength != null
      ? problem.L + problem.overhangLength
      : problem.L;

  if (variant === "reversed") {
    return points.map(({ x, M }) => ({ x, M: -M }));
  }

  if (variant === "straight_as_curve") {
    if (points.length < 2) return points;
    const m0 = points[0]!.M;
    const mL = points[n - 1]!.M;
    return points.map(({ x }) => ({
      x,
      M: m0 + (mL - m0) * (x / L),
    }));
  }

  if (variant === "curve_as_straight") {
    if (problem.type !== "concentrated" || points.length < 2) return points;
    const maxM = Math.max(...points.map((p) => p.M));
    const peakX = points.find((p) => p.M >= maxM - 0.01)?.x ?? L / 2;
    return points.map(({ x }) => {
      const t = x / L;
      const tPeak = peakX / L;
      const parabola = 4 * maxM * (t * (1 - t)) / (4 * tPeak * (1 - tPeak) || 1);
      return { x, M: Math.max(0, parabola) };
    });
  }

  if (variant === "peak_at_center") {
    if (problem.type !== "concentrated" || points.length < 2) return points;
    const maxM = Math.max(...points.map((p) => Math.abs(p.M)));
    const mid = L / 2;
    return points.map(({ x }) => ({
      x,
      M: maxM * (1 - Math.abs(x - mid) / (L / 2)),
    }));
  }

  if (variant === "peak_at_support") {
    if (problem.structure === "cantilever") {
      const maxM = Math.max(...points.map((p) => Math.abs(p.M)));
      return points.map(({ x }) => ({ x, M: maxM * (1 - x / L) }));
    }
    if (problem.structure === "simple") {
      const maxM = Math.max(...points.map((p) => Math.abs(p.M)));
      return points.map(({ x }) => ({ x, M: maxM * (1 - x / L) }));
    }
  }

  return points;
}

/** 問題とバリアントから曲げモーメントのサンプル点を取得 */
export function getMSamplePointsWithVariant(
  problem: BeamProblem,
  variant: BMDVariant
): { x: number; M: number }[] {
  const correct = getCorrectMSamplePoints(problem);
  return applyBMDVariant(correct, problem, variant);
}

/** 問題から曲げモーメントのサンプル点を取得（後方互換） */
function getMSamplePoints(problem: BeamProblem): { x: number; M: number }[] {
  return getCorrectMSamplePoints(problem);
}

type Props = {
  problem: BeamProblem;
};

/** BMD形状選択問題用。1つのバリアントを描画（コンパクト版） */
export function BMDChoiceOption({
  problem,
  variant,
  compact,
}: {
  problem: BeamProblem;
  variant: BMDVariant;
  compact?: boolean;
}) {
  const points = getMSamplePointsWithVariant(problem, variant);
  if (points.length === 0) return null;

  const totalLength =
    problem.structure === "overhang" && problem.overhangLength != null
      ? problem.L + problem.overhangLength
      : problem.L;
  const scale = compact ? 20 : PIXELS_PER_METER;
  const beamWidth = totalLength * scale;
  const marginH = compact ? 20 : MARGIN_H;
  const chartH = compact ? 40 : CHART_HEIGHT;
  const svgWidth = beamWidth + 2 * marginH;
  const svgHeight = chartH + 8;
  const xLeft = marginH;
  const zeroY = chartH / 2;

  const maxAbsM = Math.max(...points.map((p) => Math.abs(p.M)), 1);
  const scaleM = Math.min(20 / maxAbsM, (chartH / 2 - 4) / maxAbsM);

  const polyPoints = points
    .map(({ x, M }) => {
      const px = xLeft + (x / totalLength) * beamWidth;
      const py = zeroY + M * scaleM;
      return `${px},${py}`;
    })
    .join(" ");

  const zeroXLeft = xLeft;
  const zeroXRight = xLeft + beamWidth;

  return (
    <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      <Line x1={zeroXLeft} y1={zeroY} x2={zeroXRight} y2={zeroY} stroke="#999" strokeWidth={1} strokeDasharray="3,2" />
      <Polygon
        points={`${zeroXLeft},${zeroY} ${polyPoints} ${zeroXRight},${zeroY}`}
        fill="rgba(25, 118, 210, 0.2)"
        stroke="#1976d2"
        strokeWidth={1}
      />
    </Svg>
  );
}

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
  const chartHeight = CHART_HEIGHT;
  const TOP_MARGIN = 8;
  const BOTTOM_MARGIN = 8;
  const svgHeight = chartHeight + 12;
  const xLeft = MARGIN_H;

  const maxAbsM = Math.max(...points.map((p) => Math.abs(p.M)), 1);
  const maxPositive = Math.max(...points.map((p) => Math.max(p.M, 0)), 0);
  const maxNegativeAbs = Math.max(...points.map((p) => Math.max(-p.M, 0)), 0);
  const hasPositive = maxPositive > 0;
  const hasNegative = maxNegativeAbs > 0;

  let zeroY = chartHeight / 2;
  if (!hasNegative) {
    // 全て M >= 0（図は下側のみ）→ ベースラインを上寄せ
    zeroY = TOP_MARGIN;
  } else if (!hasPositive) {
    // 全て M <= 0（図は上側のみ）→ ベースラインを下寄せ
    zeroY = chartHeight - BOTTOM_MARGIN;
  }

  const availBottom = chartHeight - BOTTOM_MARGIN - zeroY;
  const availTop = zeroY - TOP_MARGIN;
  const scaleCandidates: number[] = [];
  if (maxPositive > 0 && availBottom > 0) {
    scaleCandidates.push(availBottom / maxPositive);
  }
  if (maxNegativeAbs > 0 && availTop > 0) {
    scaleCandidates.push(availTop / maxNegativeAbs);
  }
  // 安全弁として従来の MAX_M_HEIGHT ベースのスケールも候補に入れる
  scaleCandidates.push(MAX_M_HEIGHT / maxAbsM);
  const scaleM = Math.min(...scaleCandidates.filter((v) => Number.isFinite(v) && v > 0));

  const polyPoints = points
    .map(({ x, M }) => {
      const px = xLeft + (x / totalLength) * beamWidth;
      const py = zeroY + M * scaleM;
      return `${px},${py}`;
    })
    .join(" ");

  const zeroXLeft = xLeft;
  const zeroXRight = xLeft + beamWidth;

  return (
    <View style={{ alignItems: "center", marginTop: 8 }}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <Text x={xLeft - 6} y={zeroY + 4} fill="#666" fontSize={10} textAnchor="end">
          M
        </Text>
        <Line
          x1={zeroXLeft}
          y1={zeroY}
          x2={zeroXRight}
          y2={zeroY}
          stroke="#999"
          strokeWidth={1}
          strokeDasharray="4,2"
        />
        <Polygon
          points={`${zeroXLeft},${zeroY} ${polyPoints} ${zeroXRight},${zeroY}`}
          fill="rgba(25, 118, 210, 0.15)"
          stroke="#1976d2"
          strokeWidth={1.5}
        />
        <Line
          x1={zeroXLeft}
          y1={zeroY}
          x2={zeroXLeft + (points[0].x / totalLength) * beamWidth}
          y2={zeroY + points[0].M * scaleM}
          stroke="#1976d2"
          strokeWidth={1.5}
        />
        {points.slice(1).map((_, i) => (
          <Line
            key={i}
            x1={xLeft + (points[i].x / totalLength) * beamWidth}
            y1={zeroY + points[i].M * scaleM}
            x2={xLeft + (points[i + 1].x / totalLength) * beamWidth}
            y2={zeroY + points[i + 1].M * scaleM}
            stroke="#1976d2"
            strokeWidth={1.5}
          />
        ))}
      </Svg>
    </View>
  );
}
