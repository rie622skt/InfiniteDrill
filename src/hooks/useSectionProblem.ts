import type { BeamProblem, Difficulty, ProblemCategory, ProblemTarget } from "../types";

/** 値が整数（または浮動小数点誤差の範囲で整数）なら "="、そうでなければ "≒" を返す。解説の表記用。 */
function eqOrApprox(value: number): "=" | "≒" {
  return Math.abs(value - Math.round(value)) < 1e-9 ? "=" : "≒";
}

function isInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-9;
}

// 断面寸法の候補（問題バリエーション拡張用）
// - 10 mm 刻みを基本に、実務でよく出るオーダーのサイズを網羅
// - 後段の SECTION_PAIRS で「Z, I が整数になる組み合わせ」のみ採用する
const B_VALUES_MM = [80, 100, 120, 140, 150, 160, 180, 200] as const;
const H_VALUES_MM = [160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360] as const;

/** Z = b*h²/6 と I = b*h³/12 がともに整数になる (b,h) のみ使用（割り切れない汚い数字を防ぐ） */
const SECTION_PAIRS: readonly [number, number][] = (() => {
  const pairs: [number, number][] = [];
  for (const b of B_VALUES_MM) {
    for (const h of H_VALUES_MM) {
      const bh2 = b * h * h;
      const bh3 = b * h * h * h;
      if (bh2 % 6 === 0 && bh3 % 12 === 0) pairs.push([b, h]);
    }
  }
  return pairs;
})();

/** 中空長方形（外寸 B×H、内寸 b×h）で I, Z が整数になる組み合わせ。I = (B*H³ - b*h³)/12, Z = 2*I/H */
const HOLLOW_SECTION_QUADS: readonly [number, number, number, number][] = (() => {
  const quads: [number, number, number, number][] = [];
  const OUTER_B = [120, 160, 200] as const;
  const OUTER_H = [200, 240, 280] as const;
  for (const B of OUTER_B) {
    for (const H of OUTER_H) {
      for (let b = 40; b <= B - 40; b += 20) {
        for (let h = 80; h <= H - 40; h += 20) {
          if (b >= B || h >= H) continue;
          const BH3 = B * H * H * H;
          const bh3 = b * h * h * h;
          const num = BH3 - bh3;
          if (num <= 0 || num % 12 !== 0) continue;
          const I = num / 12;
          const Z = (2 * I) / H;
          if (Number.isInteger(Z) && I > 0) {
            quads.push([B, H, b, h]);
          }
        }
      }
    }
  }
  return quads.length > 0 ? quads : [[200, 200, 100, 100]]; // fallback 1組
})();

/** 梁スパン・荷重の共通定数（SHEAR_STRESS_* で使用するため先行宣言） */
const SIMPLE_L_VALUES_M = [4, 6, 8] as const;
const CANTILEVER_L_VALUES_M = [3, 4, 5] as const;
const P_VALUES_KN = [10, 20, 24, 30, 40, 48, 60] as const;

/** H形断面（b, h, tf, tw）で I と Z がともに整数になる組み合わせ（SHEAR_STRESS_H で使用するため先行宣言） */
const H_SHAPE_QUADS: readonly [number, number, number, number][] = (() => {
  const quads: [number, number, number, number][] = [];
  const B = [100, 120, 150, 200] as const;
  const H = [150, 200, 220, 240, 260, 280, 300] as const;
  const Tf = [8, 10, 12, 14] as const;
  const Tw = [6, 8, 10, 12] as const;
  for (const b of B) {
    for (const h of H) {
      for (const tf of Tf) {
        if (h <= 2 * tf + 20) continue;
        for (const tw of Tw) {
          if (tw >= b - 10) continue;
          const hw = h - 2 * tf;
          const bh3 = b * h * h * h;
          const inner = (b - tw) * hw * hw * hw;
          const num = bh3 - inner;
          if (num <= 0 || num % 12 !== 0) continue;
          const I = num / 12;
          const Z = (2 * I) / h;
          if (I > 0 && Number.isInteger(Z)) quads.push([b, h, tf, tw]);
        }
      }
    }
  }
  return quads.length > 0 ? quads : [[200, 240, 12, 8]];
})();

/** 短柱・偏心荷重（最大圧縮応力度 σ_c）の候補セット。
 * Z, A, σ_c がきれいな整数になる組み合わせのみ採用する。
 */
const SHORT_COLUMN_MAX_COMP_CANDIDATES: readonly {
  bmm: number;
  hmm: number;
  PkN: number;
  emm: number;
  A: number;
  Z: number;
  sigmaC: number;
}[] = (() => {
  const out: {
    bmm: number;
    hmm: number;
    PkN: number;
    emm: number;
    A: number;
    Z: number;
    sigmaC: number;
  }[] = [];
  const P_VALUES_KN = [100, 150, 200, 250, 300] as const;
  const E_VALUES_MM = [10, 20, 30, 40, 60] as const;

  for (const [b, h] of SECTION_PAIRS) {
    const A = b * h;
    // 偏心は幅 b 方向（横方向）とし、そのときの曲げは「b を2乗する」軸まわり。
    // よって Z は Z = h×b²/6 とする。
    const Z = (h * b * b) / 6;
    for (const PkN of P_VALUES_KN) {
      const N_N = PkN * 1000;
      const sigmaAxial = N_N / A;
      for (const emm of E_VALUES_MM) {
        const sigmaBend = (N_N * emm) / Z;
        const sigmaCExact = sigmaAxial + sigmaBend;
        if (!Number.isFinite(sigmaCExact) || sigmaCExact <= 0) continue;
        if (!isInteger(sigmaCExact)) continue;
        const sigmaC = Math.round(sigmaCExact);
        out.push({ bmm: b, hmm: h, PkN, emm, A, Z, sigmaC });
      }
    }
  }
  return out;
})();

/** せん断応力度 τ_max（長方形断面）の候補。τ_max = 3Q/(2A) = 1.5×Q/A。Q [kN], A [mm²], τ [N/mm²]。
 * 単純梁中央集中: Q = P/2。片持ち: Q = P。
 */
const SHEAR_STRESS_RECT_CANDIDATES: readonly {
  L: number;
  P: number;
  a: number;
  bSpan: number;
  Q: number;
  useCantilever: boolean;
  bmm: number;
  hmm: number;
  A: number;
  tau: number;
}[] = (() => {
  const out: {
    L: number;
    P: number;
    a: number;
    bSpan: number;
    Q: number;
    useCantilever: boolean;
    bmm: number;
    hmm: number;
    A: number;
    tau: number;
  }[] = [];
  for (const [bmm, hmm] of SECTION_PAIRS) {
    const A = bmm * hmm;
    // 片持ち: Q = P
    for (const L of CANTILEVER_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Q = P;
        const tauExact = (1.5 * Q * 1000) / A;
        if (!Number.isFinite(tauExact) || tauExact <= 0) continue;
        if (!isInteger(tauExact)) continue;
        out.push({
          L,
          P,
          a: L,
          bSpan: 0,
          Q,
          useCantilever: true,
          bmm,
          hmm,
          A,
          tau: Math.round(tauExact),
        });
      }
    }
    // 単純梁中央集中: Q = P/2 at support
    for (const L of SIMPLE_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Q = P / 2;
        const tauExact = (1.5 * Q * 1000) / A;
        if (!Number.isFinite(tauExact) || tauExact <= 0) continue;
        if (!isInteger(tauExact)) continue;
        out.push({
          L,
          P,
          a: L / 2,
          bSpan: L / 2,
          Q,
          useCantilever: false,
          bmm,
          hmm,
          A,
          tau: Math.round(tauExact),
        });
      }
    }
  }
  return out;
})();

/** せん断応力度 τ（H形・ウェブ負担）の候補。τ = Q/(t_w×h_w)。Q [kN], t_w, h_w [mm], τ [N/mm²]。
 * せん断力はウェブのみで負担すると仮定。
 */
const SHEAR_STRESS_H_CANDIDATES: readonly {
  L: number;
  P: number;
  a: number;
  bSpan: number;
  Q: number;
  useCantilever: boolean;
  bmm: number;
  hmm: number;
  tf: number;
  tw: number;
  hw: number;
  tau: number;
}[] = (() => {
  const out: {
    L: number;
    P: number;
    a: number;
    bSpan: number;
    Q: number;
    useCantilever: boolean;
    bmm: number;
    hmm: number;
    tf: number;
    tw: number;
    hw: number;
    tau: number;
  }[] = [];
  for (const [bmm, hmm, tf, tw] of H_SHAPE_QUADS) {
    const hw = hmm - 2 * tf;
    const areaWeb = tw * hw;
    // 片持ち: Q = P
    for (const L of CANTILEVER_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Q = P;
        const tauExact = (Q * 1000) / areaWeb;
        if (!Number.isFinite(tauExact) || tauExact <= 0) continue;
        if (!isInteger(tauExact)) continue;
        out.push({
          L,
          P,
          a: L,
          bSpan: 0,
          Q,
          useCantilever: true,
          bmm,
          hmm,
          tf,
          tw,
          hw,
          tau: Math.round(tauExact),
        });
      }
    }
    // 単純梁中央集中: Q = P/2
    for (const L of SIMPLE_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Q = P / 2;
        const tauExact = (Q * 1000) / areaWeb;
        if (!Number.isFinite(tauExact) || tauExact <= 0) continue;
        if (!isInteger(tauExact)) continue;
        out.push({
          L,
          P,
          a: L / 2,
          bSpan: L / 2,
          Q,
          useCantilever: false,
          bmm,
          hmm,
          tf,
          tw,
          hw,
          tau: Math.round(tauExact),
        });
      }
    }
  }
  return out;
})();

/** 短柱・偏心荷重（引張が生じない限界偏心 e_max = Z/A）の候補セット。
 * 図の偏心方向（幅 b 方向）に合わせ、b/6 が整数になる組み合わせのみ採用する。
 */
const SHORT_COLUMN_CORE_CANDIDATES: readonly {
  bmm: number;
  hmm: number;
}[] = (() => {
  const out: { bmm: number; hmm: number }[] = [];
  for (const [b, h] of SECTION_PAIRS) {
    if (b % 6 !== 0) continue;
    out.push({ bmm: b, hmm: h });
  }
  return out;
})();

/** T形断面（上フランジ＋中央ウェブ）用の寸法 (b, h, tf, tw)。図心 y_g と図心軸まわり I がきれいな整数になるよう手動で選定。 */
const T_SHAPE_QUADS: readonly [number, number, number, number][] = [
  // b [mm], h [mm], tf [mm], tw [mm]
  [180, 200, 20, 20],
  [60, 80, 20, 20],
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToInteger(value: number): number {
  return Math.round(value);
}

function isValidWrong(value: number, answer: number): boolean {
  return value > 0 && Math.abs(value - answer) > 1e-6;
}

function isValidWrongAllowNegative(value: number, answer: number): boolean {
  return Math.abs(value - answer) > 1;
}

function pickWrongChoicesAllowNegative(
  candidates: number[],
  answer: number,
  count: number
): number[] {
  const uniq = Array.from(new Set(candidates)).filter((v) =>
    isValidWrongAllowNegative(v, answer)
  );
  const result: number[] = [];
  while (result.length < count && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    result.push(uniq.splice(idx, 1)[0]);
  }
  return result;
}

function pickWrongChoices(
  candidates: number[],
  answer: number,
  count: number
): number[] {
  const uniq = Array.from(new Set(candidates)).filter((v) =>
    isValidWrong(v, answer)
  );
  const result: number[] = [];
  while (result.length < count && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    const v = uniq.splice(idx, 1)[0];
    result.push(v);
  }
  return result;
}

/** L形（横並び2長方形 b1×h + b2×h）で図心 x_g が整数になる組み合わせ。x_g = (b1²/2 + b2*(b1+b2/2))/(b1+b2) */
const L_SHAPE_CENTROID_TRIPLES: readonly [number, number, number][] = [
  [80, 120, 50],
  [100, 100, 60],
  [60, 180, 40],
  [120, 80, 50],
];

/** L形で図心軸（x_g を通る鉛直軸）まわりの I が整数になる (b1, b2, h) のみ。鉛直軸まわりなので I_g = h×b³/12 */
const L_SHAPE_I_CENTROID_TRIPLES: readonly [number, number, number][] = [
  [100, 100, 60], // I_total = 40_000_000
  [60, 180, 40],  // I_total = 46_080_000
];

/** L形断面の図心 x_g [mm] 問題を1問生成 */
function generateCentroidProblem(): BeamProblem {
  const [b1, b2, h] = pickRandom(L_SHAPE_CENTROID_TRIPLES);
  const A1 = b1 * h;
  const A2 = b2 * h;
  const x1 = b1 / 2;
  const x2 = b1 + b2 / 2;
  const x_g = Math.round((A1 * x1 + A2 * x2) / (A1 + A2));

  const wrongCandidates = [
    b1,
    b2,
    b1 + b2,
    Math.round((b1 + b2) / 2),
    x1,
    x2,
    Math.round(x_g * 1.5),
    Math.round(x_g / 2),
  ].filter((v) => v > 0 && v !== x_g && Math.abs(v - x_g) > 1);

  const chosenWrong = pickWrongChoices(wrongCandidates, x_g, 3);
  const choices = [...chosenWrong, x_g].sort((a2, b2) => a2 - b2);

  const x_gExact = (A1 * x1 + A2 * x2) / (A1 + A2);
  const explanation = [
    "L形断面の図心は、各部分の面積とその図心位置から求めます。",
    `左矩形: A1 = b1×h = ${b1}×${h} = ${A1} mm², 図心 x1 = b1/2 = ${x1} mm`,
    `右矩形: A2 = b2×h = ${b2}×${h} = ${A2} mm², 図心 x2 = b1 + b2/2 = ${x2} mm`,
    "全体の図心 x_g = (A1×x1 + A2×x2) / (A1 + A2)",
    `x_g = (${A1}×${x1} + ${A2}×${x2}) / (${A1 + A2}) ${eqOrApprox(x_gExact)} ${x_g} mm`,
  ].join("\n");

  return {
    L: 0,
    structure: "simple",
    type: "concentrated",
    target: "x_g",
    answer: x_g,
    choices,
    explanation,
    sectionShape: "L-shape",
    sectionB1mm: b1,
    sectionB2mm: b2,
    sectionLShapeHmm: h,
    sectionBmm: b1 + b2,
    sectionHmm: h,
    problemCategory: "section-properties" as ProblemCategory,
    P: 0,
    a: 0,
    b: 0,
  };
}

/** L形断面の図心軸（x_g を通る鉛直軸）まわりの断面二次モーメント I [mm⁴]。鉛直軸まわりなので各矩形は I_g = h×b³/12。平行軸の定理使用。 */
function computeLShapeICentroid(b1: number, b2: number, h: number): number {
  const A1 = b1 * h;
  const A2 = b2 * h;
  const x1 = b1 / 2;
  const x2 = b1 + b2 / 2;
  const x_g = (A1 * x1 + A2 * x2) / (A1 + A2);
  const d1 = x_g - x1;
  const d2 = x2 - x_g;
  const I_g1 = (h * b1 * b1 * b1) / 12;
  const I_g2 = (h * b2 * b2 * b2) / 12;
  const I1 = I_g1 + A1 * d1 * d1;
  const I2 = I_g2 + A2 * d2 * d2;
  return I1 + I2;
}

/** L形断面・図心軸まわりの I 問題を1問生成（発展A: 平行軸の定理） */
function generateLShapeICentroidProblem(): BeamProblem {
  const [b1, b2, h] = pickRandom(L_SHAPE_I_CENTROID_TRIPLES);
  const A1 = b1 * h;
  const A2 = b2 * h;
  const x1 = b1 / 2;
  const x2 = b1 + b2 / 2;
  const x_g = (A1 * x1 + A2 * x2) / (A1 + A2);
  const answer = computeLShapeICentroid(b1, b2, h);
  if (!Number.isInteger(answer) || answer <= 0) {
    return generateLShapeICentroidProblem();
  }

  const I_g1 = (h * b1 * b1 * b1) / 12;
  const I_g2 = (h * b2 * b2 * b2) / 12;
  const d1 = x_g - x1;
  const d2 = x2 - x_g;
  const I1 = I_g1 + A1 * d1 * d1;
  const I2 = I_g2 + A2 * d2 * d2;

  const wrongCandidates = [
    Math.round(I_g1 + I_g2),
    Math.round(I1),
    Math.round(I2),
    Math.round(answer / 2),
    Math.round(answer * 2),
    Math.round((h * b1 * b1 * b1 + h * b2 * b2 * b2) / 12),
    Math.round(answer + 1_000_000),
    Math.round(answer - 1_000_000),
  ].filter((v) => v > 0 && isValidWrong(v, answer));

  const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const x_gR = Math.round(x_g);
  const d1_1 = d1.toFixed(1);
  const d2_1 = d2.toFixed(1);
  const I1R = Math.round(I1);
  const I2R = Math.round(I2);
  const explanation = [
    "L形断面の断面二次モーメント I は、左右の矩形に分け、平行軸の定理（I = I_0 + A×d²）を用いて求めます。",
    "① 各部の面積と図心",
    `左矩形: A1 = b1×h = ${b1}×${h} = ${A1} mm², 図心 x1 = b1/2 = ${x1} mm`,
    `右矩形: A2 = b2×h = ${b2}×${h} = ${A2} mm², 図心 x2 = b1 + b2/2 = ${x2} mm`,
    "② 全体の図心位置 x_g",
    `x_g = (A1×x1 + A2×x2) / (A1+A2) = (${A1}×${x1} + ${A2}×${x2}) / (${A1 + A2}) ${eqOrApprox(x_g)} ${x_gR} mm`,
    "③ 各部の自軸まわり断面二次モーメント I_0",
    `左矩形: I_g1 = h×b1³/12 = ${Math.round(I_g1)} mm⁴, 右矩形: I_g2 = h×b2³/12 = ${Math.round(I_g2)} mm⁴`,
    "④ 図心までの距離 d",
    `d1 = x_g − x1 ${eqOrApprox(d1)} ${d1_1} mm, d2 = x2 − x_g ${eqOrApprox(d2)} ${d2_1} mm`,
    "⑤ 全体 I の合成",
    `I1 = I_g1 + A1×d1² = ${Math.round(I_g1)} + ${A1}×${d1_1}² = ${I1R} mm⁴, I2 = I_g2 + A2×d2² = ${Math.round(I_g2)} + ${A2}×${d2_1}² = ${I2R} mm⁴`,
    `図心軸まわりの I = I1 + I2 = ${I1R} + ${I2R} = ${answer} mm⁴`,
  ].join("\n");

  return {
    L: 0,
    structure: "simple",
    type: "concentrated",
    target: "I_centroid" as ProblemTarget,
    answer,
    choices,
    explanation,
    sectionShape: "L-shape",
    sectionB1mm: b1,
    sectionB2mm: b2,
    sectionLShapeHmm: h,
    sectionBmm: b1 + b2,
    sectionHmm: h,
    problemCategory: "section-properties" as ProblemCategory,
    P: 0,
    a: 0,
    b: 0,
  };
}

/** 断面の性質（Z, I）の問題を生成。中級ではT字（y_g, I）を出題、上級では中空・L形・図心軸まわりI等も出題 */
export function generateSectionPropertiesProblem(
  difficulty: Difficulty
): BeamProblem {
  // 中級: T字断面（y_g または I）を約25%で出題。本試験の図心計算の主役。
  if (difficulty === "intermediate" && T_SHAPE_QUADS.length > 0 && Math.random() < 0.25) {
    return generateTShapeSectionProblem();
  }
  if (difficulty === "advanced") {
    const r = Math.random();
    if (r < 0.15) return generateLShapeICentroidProblem();
    if (r < 0.35) return generateCentroidProblem();
    if (HOLLOW_SECTION_QUADS.length > 0 && r < 0.6) return generateHollowSectionProblem();
    if (H_SHAPE_QUADS.length > 0 && r < 0.8) return generateHShapeSectionProblem();
    if (T_SHAPE_QUADS.length > 0) return generateTShapeSectionProblem();
  }

  const [b, h] = pickRandom(SECTION_PAIRS);

  // 初級は Z が中心、中級以上は Z, I を 50:50 程度
  const isZTarget =
    difficulty === "beginner" ? true : Math.random() < 0.5;

  let target: ProblemTarget;
  let answer: number;
  let wrongCandidates: number[] = [];
  let explanationLines: string[] = [];

  const bh2 = b * h * h;
  const bh3 = b * h * h * h;

  if (isZTarget) {
    target = "Z";
    // Z = b h^2 / 6  [mm^3]（SECTION_PAIRS により整数）
    const exact = bh2 / 6;
    answer = exact;

    explanationLines = [
      "長方形断面の断面係数 Z は Z = b×h²/6 で求めます。",
      `b = ${b} mm, h = ${h} mm より、`,
      `Z = (${b} × ${h}²) / 6`,
      `  = (${b} × ${h * h}) / 6`,
      `  = ${answer} mm³`,
    ];

    wrongCandidates = [
      Math.round((h * b * b) / 6), // b, h 入れ替え
      Math.round(bh2 / 12), // 分母 12 に誤る
      Math.round((h * b * b) / 12),
      exact * 2,
      Math.round(exact / 2),
    ];
  } else {
    target = "I";
    // I = b h^3 / 12 [mm^4]（SECTION_PAIRS により整数）
    const exact = bh3 / 12;
    answer = exact;

    explanationLines = [
      "長方形断面の断面二次モーメント I は I = b×h³/12 で求めます。",
      `b = ${b} mm, h = ${h} mm より、`,
      `I = (${b} × ${h}³) / 12`,
      `  = (${b} × ${h * h * h}) / 12`,
      `  = ${answer} mm⁴`,
    ];

    wrongCandidates = [
      Math.round((h * b * b * b) / 12), // b, h 入れ替え
      Math.round(bh3 / 6), // 分母 6 に誤る
      Math.round((h * b * b * b) / 6),
      exact * 2,
      Math.round(exact / 2),
    ];
  }

  const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  const choices = [...chosenWrong, answer].sort((a, b2) => a - b2);

  const problem: BeamProblem = {
    L: 0,
    structure: "simple",
    type: "concentrated",
    target,
    answer,
    choices,
    explanation: explanationLines.join("\n"),
    hideDimensionB: undefined,
    sectionBmm: b,
    sectionHmm: h,
    problemCategory: "section-properties" as ProblemCategory,
    P: 0,
    a: 0,
    b: 0,
  };

  return problem;
}

/** 中空長方形（ロの字）の I, Z 問題を生成。I = (B*H³ - b*h³)/12, Z = 2*I/H */
function generateHollowSectionProblem(): BeamProblem {
  const [B, H, b, h] = pickRandom(HOLLOW_SECTION_QUADS);
  const BH3 = B * H * H * H;
  const bh3 = b * h * h * h;
  const I = (BH3 - bh3) / 12;
  const Z = (2 * I) / H;

  const isZTarget = Math.random() < 0.5;
  const target: ProblemTarget = isZTarget ? "Z" : "I";
  const answer = isZTarget ? Z : I;

  let explanationLines: string[];
  let wrongCandidates: number[];

  if (isZTarget) {
    explanationLines = [
      "中空長方形断面は、外側の長方形から内側の長方形を引いた断面です。",
      "まず I = (B×H³ − b×h³) / 12 で断面二次モーメントを求め、",
      "Z = I / (H/2) = 2×I / H で断面係数を求めます。",
      `I = (${B}×${H}³ − ${b}×${h}³) / 12 = (${BH3} − ${bh3}) / 12 = ${I} mm⁴`,
      `Z = 2×I / H = 2×${I} / ${H} = ${Z} mm³`,
    ];
    wrongCandidates = [
      Math.round((B * H * H - b * h * h) / 6), // 長方形のZと混同
      Math.round(I / H),
      Math.round(Z * 2),
      Math.round(Z / 2),
    ];
  } else {
    explanationLines = [
      "中空長方形断面の断面二次モーメントは、外側から内側を引いて求めます。",
      "I = (B×H³ − b×h³) / 12",
      `= (${B} × ${H}³ − ${b} × ${h}³) / 12`,
      `= (${BH3} − ${bh3}) / 12`,
      `= ${I} mm⁴`,
    ];
    wrongCandidates = [
      Math.round((B * H * H * H - b * h * h) / 12), // h³とh²の混同
      Math.round((BH3 - bh3) / 6),
      Math.round(I * 2),
      Math.round(I / 2),
      Math.round((B * H * H * H - B * h * h * h) / 12), // 中空部の幅を外幅Bのままにしてしまうケアレスミス (BH³−Bh³)/12
    ];
  }

  const chosenWrong = pickWrongChoices(
    wrongCandidates.filter((v) => isValidWrong(v, answer)),
    answer,
    3
  );
  const choices = [...chosenWrong, answer].sort((a2, b2) => a2 - b2);

  return {
    L: 0,
    structure: "simple",
    type: "concentrated",
    target,
    answer,
    choices,
    explanation: explanationLines.join("\n"),
    hideDimensionB: undefined,
    sectionBmm: B,
    sectionHmm: H,
    sectionShape: "hollow-rect",
    sectionBInner: b,
    sectionHInner: h,
    problemCategory: "section-properties" as ProblemCategory,
    P: 0,
    a: 0,
    b: 0,
  };
}

/** H形断面の I または Z 問題を生成。H_SHAPE_QUADS で I と Z が整数になる組み合わせのみ使用（丸めなし・本試験スタイル） */
function generateHShapeSectionProblem(): BeamProblem {
  const [b, h, tf, tw] = pickRandom(H_SHAPE_QUADS);
  const hw = h - 2 * tf;
  const bh3 = b * h * h * h;
  const inner = (b - tw) * hw * hw * hw;
  const I = (bh3 - inner) / 12;
  const Z = (2 * I) / h;

  const isZTarget = Math.random() < 0.5;
  const target: ProblemTarget = isZTarget ? "Z" : "I";
  const answer = isZTarget ? Z : I;

  let explanationLines: string[];
  let wrongCandidates: number[];

  if (isZTarget) {
    explanationLines = [
      "H形断面は、フランジとウェブからなります。",
      "まず I = (b×h³ − (b−tw)×(h−2×tf)³) / 12 で断面二次モーメントを求め、",
      "Z = I / (h/2) = 2×I / h で断面係数を求めます。",
      `I = (${b}×${h}³ − ${b - tw}×${hw}³) / 12 = ${I} mm⁴`,
      `Z = 2×I / h = 2×${I} / ${h} = ${Z} mm³`,
    ];
    const rawWrong = [
      (b * h * h - (b - tw) * hw * hw) / 6,
      I / h,
      Z * 2,
      Z / 2,
      Z + 100,
      Z - 100,
      Z + 200,
    ];
    wrongCandidates = rawWrong.filter((v) => Number.isInteger(v) && v > 0);
  } else {
    explanationLines = [
      "H形断面の断面二次モーメントは、外枠からウェブ部分の穴を引いて求めます。",
      "I = (b×h³ − (b−tw)×(h−2×tf)³) / 12",
      `= (${b} × ${h}³ − ${b - tw} × ${hw}³) / 12`,
      `= ${I} mm⁴`,
    ];
    wrongCandidates = [
      Math.round((b * h * h * h - (b - tw) * hw * hw) / 12),
      Math.round((bh3 - inner) / 6),
      Math.round(I * 2),
      Math.round(I / 2),
    ];
  }

  const chosenWrong = pickWrongChoices(
    wrongCandidates.filter((v) => isValidWrong(v, answer)),
    answer,
    3
  );
  const choices = [...chosenWrong, answer].sort((a2, b2) => a2 - b2);

  return {
    L: 0,
    structure: "simple",
    type: "concentrated",
    target,
    answer,
    choices,
    explanation: explanationLines.join("\n"),
    hideDimensionB: undefined,
    sectionBmm: b,
    sectionHmm: h,
    sectionShape: "H-shape",
    sectionTfMm: tf,
    sectionTwMm: tw,
    problemCategory: "section-properties" as ProblemCategory,
    P: 0,
    a: 0,
    b: 0,
  };
}

/** T形断面（上フランジ＋中央ウェブ）の図心 y_g または図心軸まわり I を求める問題を生成。 */
function generateTShapeSectionProblem(): BeamProblem {
  const [b, h, tf, tw] = pickRandom(T_SHAPE_QUADS);
  const hw = h - tf;
  const Af = b * tf;
  const Aw = tw * hw;
  const A = Af + Aw;
  const yF = tf / 2;
  const yW = tf + hw / 2;
  const y_g = (Af * yF + Aw * yW) / A;
  const y_g_rounded = roundToInteger(y_g);

  const I_f = (b * tf * tf * tf) / 12;
  const I_w = (tw * hw * hw * hw) / 12;
  const dF = y_g - yF;
  const dW = yW - y_g;
  const I_total = I_f + Af * dF * dF + I_w + Aw * dW * dW;
  const I_rounded = Math.round(I_total);

  const askCentroid = Math.random() < 0.5;

  if (askCentroid) {
    const answer = y_g_rounded;
    const wrongCandidates = [
      h / 2,
      tf / 2,
      tf + hw / 2,
      Math.round(answer * 0.5),
      Math.round(answer * 1.5),
      Math.round(h - answer),
    ].filter((v) => v > 0 && isValidWrong(v, answer));
    const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
    const choices = [...chosenWrong, answer].sort((a, b2) => a - b2);

    const explanationLines = [
      "T形断面の図心位置 y_g は、フランジとウェブを2つの長方形に分けて面積と図心位置から求めます。",
      `フランジ: 幅 B = ${b} mm, 厚さ t_f = ${tf} mm → 面積 A_f = B×t_f = ${Af} mm², 図心 y_f = t_f/2 = ${yF} mm`,
      `ウェブ: 厚さ t_w = ${tw} mm, 高さ h_w = h − t_f = ${hw} mm → 面積 A_w = t_w×h_w = ${Aw} mm², 図心 y_w = t_f + h_w/2 = ${yW} mm`,
      "図心位置は y_g = (A_f×y_f + A_w×y_w) / (A_f + A_w) で求めます。",
      `y_g = (${Af}×${yF} + ${Aw}×${yW}) / (${A}) ${eqOrApprox(y_g)} ${answer} mm`,
    ];

    return {
      L: 0,
      structure: "simple",
      type: "concentrated",
      target: "y_g" as ProblemTarget,
      answer,
      choices,
      explanation: explanationLines.join("\n"),
      sectionBmm: b,
      sectionHmm: h,
      sectionShape: "T-shape",
      sectionTfMm: tf,
      sectionTwMm: tw,
      problemCategory: "section-properties" as ProblemCategory,
      P: 0,
      a: 0,
      b: 0,
    };
  } else {
    const answer = I_rounded;
    const wrongCandidates = [
      Math.round(I_f + I_w),
      Math.round(I_total / 2),
      Math.round(I_total * 2),
      Math.round(I_total * 1.5),
    ].filter((v) => v > 0 && isValidWrong(v, answer));
    const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
    const choices = [...chosenWrong, answer].sort((a, b2) => a - b2);

    const I_fR = Math.round(I_f);
    const I_wR = Math.round(I_w);
    const dF1 = dF.toFixed(1);
    const dW1 = dW.toFixed(1);
    const termF = Math.round(I_f + Af * dF * dF);
    const termW = Math.round(I_w + Aw * dW * dW);
    const dF2 = Math.round(dF * dF);
    const dW2 = Math.round(dW * dW);
    const explanationLines = [
      "T形断面の断面二次モーメント I は、フランジとウェブに分け、平行軸の定理（I = I_0 + A×d²）を用いて求めます。",
      "① 各部の面積と図心（上端基準）",
      `フランジ: 面積 A_f = b×t_f = ${b}×${tf} = ${Af} mm², 図心 y_f = t_f/2 = ${tf}/2 = ${yF} mm`,
      `ウェブ: 面積 A_w = t_w×h_w = t_w×(h−t_f) = ${tw}×${hw} = ${Aw} mm², 図心 y_w = t_f + h_w/2 = ${tf} + ${hw}/2 = ${yW} mm`,
      "② 全体の図心位置 y_g",
      `y_g = (A_f×y_f + A_w×y_w) / (A_f + A_w) = (${Af}×${yF} + ${Aw}×${yW}) / ${A} ${eqOrApprox(y_g)} ${y_g_rounded} mm`,
      "③ 各部の自軸まわり断面二次モーメント I_0",
      `フランジ: I_f = b×t_f³/12 = ${b}×${tf}³/12 ${eqOrApprox(I_f)} ${I_fR} mm⁴`,
      `ウェブ: I_w = t_w×h_w³/12 = ${tw}×${hw}³/12 ${eqOrApprox(I_w)} ${I_wR} mm⁴`,
      "④ 全体図心までの距離 d",
      `フランジ: d_f = y_g − y_f ${eqOrApprox(dF)} ${dF1} mm`,
      `ウェブ: d_w = y_w − y_g ${eqOrApprox(dW)} ${dW1} mm`,
      "⑤ 全体 I の合成",
      `I = (I_f + A_f×d_f²) + (I_w + A_w×d_w²) = (${I_fR} + ${Af}×${dF2}) + (${I_wR} + ${Aw}×${dW2}) = ${termF} + ${termW} ${eqOrApprox(I_total)} ${answer} mm⁴`,
    ];

    return {
      L: 0,
      structure: "simple",
      type: "concentrated",
      target: "I",
      answer,
      choices,
      explanation: explanationLines.join("\n"),
      sectionBmm: b,
      sectionHmm: h,
      sectionShape: "T-shape",
      sectionTfMm: tf,
      sectionTwMm: tw,
      problemCategory: "section-properties" as ProblemCategory,
      P: 0,
      a: 0,
      b: 0,
    };
  }
}

/** 曲げ応力度問題で使える (L,P,M_max,useCantilever,bmm,hmm) の候補。
 * 条件: σ = M_max×10^6/Z が整数（割り切れる）、片持ちは L≠2。 */
function collectBendingStressCandidates(): {
  L: number;
  P: number;
  a: number;
  bSpan: number;
  Mmax: number;
  useCantilever: boolean;
  bmm: number;
  hmm: number;
  Z: number;
  sigma: number;
}[] {
  const out: {
    L: number;
    P: number;
    a: number;
    bSpan: number;
    Mmax: number;
    useCantilever: boolean;
    bmm: number;
    hmm: number;
    Z: number;
    sigma: number;
  }[] = [];

  for (const [bmm, hmm] of SECTION_PAIRS) {
    const Z = (bmm * hmm * hmm) / 6;

    // 片持ち: M_max = P×L, L in [3,4,5]
    for (const L of CANTILEVER_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Mmax = P * L;
        const M_nmm = Mmax * 1_000_000;
        if (M_nmm % Z !== 0) continue;
        const sigma = M_nmm / Z;
        out.push({
          L,
          P,
          a: L,
          bSpan: 0,
          Mmax,
          useCantilever: true,
          bmm,
          hmm,
          Z,
          sigma,
        });
      }
    }

    // 単純梁中央集中: M_max = P×L/4
    for (const L of SIMPLE_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Mmax = (P * L) / 4;
        const M_nmm = Mmax * 1_000_000;
        if (M_nmm % Z !== 0) continue;
        const sigma = M_nmm / Z;
        out.push({
          L,
          P,
          a: L / 2,
          bSpan: L / 2,
          Mmax,
          useCantilever: false,
          bmm,
          hmm,
          Z,
          sigma,
        });
      }
    }
  }

  return out;
}

let _bendingStressCandidates: ReturnType<typeof collectBendingStressCandidates> | null = null;

function getBendingStressCandidates(): NonNullable<typeof _bendingStressCandidates> {
  if (_bendingStressCandidates === null) {
    _bendingStressCandidates = collectBendingStressCandidates();
  }
  return _bendingStressCandidates;
}

/** 複合応力度 σ = N/A + M/Z が整数になる候補。（N [kN], A [mm²], M [kN·m], Z [mm³]） */
function collectCombinedStressCandidates(): {
  N_kN: number;
  L: number;
  P: number;
  a: number;
  bSpan: number;
  Mmax: number;
  useCantilever: boolean;
  bmm: number;
  hmm: number;
  A: number;
  Z: number;
  sigma: number;
}[] {
  const out: ReturnType<typeof collectCombinedStressCandidates> = [];
  const bending = getBendingStressCandidates();
  for (const c of bending) {
    const { Mmax, bmm, hmm, Z } = c;
    const A = bmm * hmm;
    // N*1000/A が整数になる N [kN]: N = A*k/1000, k 整数 → N は 0.1 刻みで取りうる
    for (let k = 1; k <= 20; k++) {
      const N_kN = (A * k) / 1000;
      const sigmaAxial = (N_kN * 1000) / A; // = k
      const sigmaBend = (Mmax * 1_000_000) / Z;
      const sigma = sigmaAxial + sigmaBend;
      if (!Number.isInteger(sigma) || sigma <= 0) continue;
      const roundedN = Math.round(N_kN * 10) / 10;
      if (Math.abs(roundedN - N_kN) > 0.01) continue; // きれいな小数に丸められるものだけ
      out.push({
        N_kN: roundedN,
        L: c.L,
        P: c.P,
        a: c.a,
        bSpan: c.bSpan,
        Mmax: c.Mmax,
        useCantilever: c.useCantilever,
        bmm: c.bmm,
        hmm: c.hmm,
        A,
        Z,
        sigma,
      });
    }
  }
  return out;
}

let _combinedStressCandidates: ReturnType<typeof collectCombinedStressCandidates> | null = null;

function getCombinedStressCandidates(): NonNullable<typeof _combinedStressCandidates> {
  if (_combinedStressCandidates === null) {
    _combinedStressCandidates = collectCombinedStressCandidates();
  }
  return _combinedStressCandidates;
}

/** 複合応力度問題を1問生成（引張側または圧縮側を50%で出題） */
function generateCombinedStressProblem(): BeamProblem {
  const candidates = getCombinedStressCandidates();
  if (candidates.length === 0) return generateBendingStressProblemFallback();

  const c = pickRandom(candidates);
  const { N_kN, L, P, a, bSpan, Mmax, useCantilever, bmm, hmm, A, Z, sigma } = c;
  const sigmaAxial = Math.round((N_kN * 1000) / A);
  const sigmaBend = (Mmax * 1_000_000) / Z;
  const sigmaComp = sigmaAxial - sigmaBend;
  const isCompression = Math.random() < 0.5;
  const answer = isCompression ? sigmaComp : sigma;

  const wrongCandidates = [
    sigmaBend,
    sigmaAxial,
    sigma,
    sigmaComp,
    Math.round(sigma * 2),
    Math.round(sigma / 2),
    Math.round(sigmaComp * 2),
    -sigmaBend,
  ].filter((v) => v !== answer && Math.abs(v - answer) > 1);

  const chosenWrong = pickWrongChoicesAllowNegative(wrongCandidates, answer, 3);
  const choices = [...chosenWrong, answer].sort((a2, b2) => a2 - b2);

  const N_N = N_kN * 1000;
  const M_Nmm = Mmax * 1_000_000;
  const explanationLines: string[] = isCompression
    ? [
        "複合応力度は σ = N/A ± M/Z で求めます。圧縮側縁では σ = N/A − M/Z です。",
        "① 軸力による応力度",
        `N = ${N_kN} kN = ${N_kN} × 10^3 = ${N_N} N`,
        `A = b×h = ${bmm}×${hmm} = ${A} mm²`,
        `σ_軸 = N/A = ${N_N} / ${A} = ${sigmaAxial} N/mm²`,
        "",
        "② 曲げによる応力度",
        `M_max = ${Mmax} kN·m = ${Mmax} × 10^6 = ${M_Nmm} N·mm`,
        `Z = ${Z} mm³`,
        `σ_曲げ = M/Z = ${M_Nmm} / ${Z} = ${sigmaBend} N/mm²`,
        "",
        "③ 応力度の重ね合わせ",
        `圧縮側縁: σ = σ_軸 − σ_曲げ = ${sigmaAxial} − ${sigmaBend} = ${sigmaComp} N/mm²`,
      ]
    : [
        "複合応力度は σ = N/A ± M/Z で求めます。引張側縁では σ = N/A + M/Z です。",
        "① 軸力による応力度",
        `N = ${N_kN} kN = ${N_kN} × 10^3 = ${N_N} N`,
        `A = b×h = ${bmm}×${hmm} = ${A} mm²`,
        `σ_軸 = N/A = ${N_N} / ${A} = ${sigmaAxial} N/mm²`,
        "",
        "② 曲げによる応力度",
        `M_max = ${Mmax} kN·m = ${Mmax} × 10^6 = ${M_Nmm} N·mm`,
        `Z = ${Z} mm³`,
        `σ_曲げ = M/Z = ${M_Nmm} / ${Z} = ${sigmaBend} N/mm²`,
        "",
        "③ 応力度の重ね合わせ",
        `引張側縁: σ = σ_軸 + σ_曲げ = ${sigmaAxial} + ${sigmaBend} = ${sigma} N/mm²`,
      ];

  return {
    L,
    structure: useCantilever ? "cantilever" : "simple",
    type: "concentrated",
    target: "sigma",
    answer,
    choices,
    explanation: explanationLines.join("\n"),
    hideDimensionB: false,
    sectionBmm: bmm,
    sectionHmm: hmm,
    problemCategory: "bending-stress" as ProblemCategory,
    axialForceKN: N_kN,
    sigmaCompressionSide: isCompression,
    P,
    a,
    b: bSpan,
  };
}

/** 短柱の偏心荷重（最大圧縮応力度 σ_c）問題を1問生成 */
function generateShortColumnMaxCompressionProblem(): BeamProblem | null {
  if (SHORT_COLUMN_MAX_COMP_CANDIDATES.length === 0) return null;
  const c = SHORT_COLUMN_MAX_COMP_CANDIDATES[Math.floor(Math.random() * SHORT_COLUMN_MAX_COMP_CANDIDATES.length)];
  const { bmm, hmm, PkN, emm, A, Z, sigmaC } = c;

  const P_N = PkN * 1000;
  const sigmaAxial = P_N / A;
  const sigmaBend = (P_N * emm) / Z;
  const sigmaAxialR = Math.round(sigmaAxial);
  const sigmaBendR = Math.round(sigmaBend);

  const wrongCandidatesRaw = [
    sigmaAxialR, // 軸力のみ
    sigmaBendR, // 曲げのみ
    sigmaAxialR - sigmaBendR, // 最小圧縮（または引張）側
    sigmaC * 2,
    Math.round(sigmaC / 2),
  ];
  const wrongCandidates = wrongCandidatesRaw.filter((v) => v > 0);
  const chosenWrong = pickWrongChoicesAllowNegative(wrongCandidates, sigmaC, 3);
  let choices = [...chosenWrong, sigmaC];
  if (choices.length < 4) {
    const fallbackPool = [
      sigmaC + 1,
      sigmaC - 1,
      sigmaC + 2,
      sigmaC - 2,
      sigmaC + 3,
      sigmaC - 3,
    ].filter((v) => v > 0 && Math.abs(v - sigmaC) > 1);
    for (const v of fallbackPool) {
      if (choices.length >= 4) break;
      if (!choices.includes(v)) choices.push(v);
    }
  }
  choices = Array.from(new Set(choices)).sort((a, b) => a - b);

  const explanationLines = [
    "短柱に偏心荷重 P が作用するとき、断面の応力度は σ = N/A ± M/Z で表されます。",
    "最大圧縮応力度は、軸力による圧縮と曲げ圧縮が同じ側に重なる点で生じます（σ_c = N/A + M/Z）。",
    "① 断面積 A と断面係数 Z",
    `A = b×h = ${bmm}×${hmm} = ${A} mm²`,
    `Z = h×b²/6 = ${hmm}×${bmm}²/6 = ${Z} mm³`,
    "",
    "② 軸力による応力度",
    `N = P = ${P_N} N`,
    `σ_軸 = N/A = ${P_N} / ${A} = ${sigmaAxialR} N/mm²`,
    "",
    "③ 曲げによる応力度",
    `M = P×e = ${P_N}×${emm} = ${P_N * emm} N·mm`,
    `σ_曲げ = M/Z = ${P_N * emm} / ${Z} = ${sigmaBendR} N/mm²`,
    "",
    "④ 最大圧縮応力度",
    `σ_c = σ_軸 + σ_曲げ = ${sigmaAxialR} + ${sigmaBendR} = ${sigmaC} N/mm²`,
  ];

  const L_dummy = 1;

  return {
    type: "concentrated",
    structure: "simple",
    L: L_dummy,
    P: PkN,
    a: L_dummy / 2,
    b: L_dummy / 2,
    target: "sigma",
    answer: sigmaC,
    choices,
    explanation: explanationLines.join("\n"),
    problemCategory: "bending-stress" as ProblemCategory,
    sectionBmm: bmm,
    sectionHmm: hmm,
    sectionShape: "rectangle",
    shortColumnMode: "eccentric-max-compression",
    eccentricEMm: emm,
    customQuestion:
      "図の短柱に偏心荷重 P が作用するとき、断面に生じる最大の圧縮応力度 σ_c [N/mm²] を求めよ。ただし圧縮を正とする。",
  };
}

/** 短柱の偏心荷重（引張が生じない限界偏心距離 e）問題を1問生成 */
function generateShortColumnCoreLimitProblem(): BeamProblem | null {
  if (SHORT_COLUMN_CORE_CANDIDATES.length === 0) return null;
  const c =
    SHORT_COLUMN_CORE_CANDIDATES[Math.floor(Math.random() * SHORT_COLUMN_CORE_CANDIDATES.length)];
  const { bmm, hmm } = c;

  const A = bmm * hmm;
  // 偏心は幅 b 方向（横方向）とし、そのときの曲げは「b を2乗する」軸まわり。
  // よって Z は Z = h×b²/6 で、Z/A = b/6 となる。
  const Z = (hmm * bmm * bmm) / 6;
  const eMax = Z / A; // = b/6（長方形断面）

  const wrongCandidatesRaw = [bmm / 4, bmm / 8, bmm / 3, bmm / 2, bmm / 10, (2 * bmm) / 3];
  const wrongCandidates = wrongCandidatesRaw
    .filter((v) => v > 0 && Math.abs(v - eMax) > 1e-6)
    .map((v) => Math.round(v));
  const uniqWrong = Array.from(new Set(wrongCandidates)).filter(
    (v) => Math.abs(v - eMax) > 1e-6
  );
  let choices: number[] = [...uniqWrong.slice(0, 3), Math.round(eMax)];
  choices = Array.from(new Set(choices));
  if (choices.length < 4) {
    const base = Math.round(eMax);
    const fallbackPool = [base + 5, base - 5, base + 10, base - 10].filter(
      (v) => v > 0 && v !== base
    );
    for (const v of fallbackPool) {
      if (choices.length >= 4) break;
      if (!choices.includes(v)) choices.push(v);
    }
  }
  choices = choices.sort((a, b) => a - b);

  const explanationLines = [
    "短柱に偏心荷重 P が作用するとき、断面の応力度は σ = N/A ± M/Z で表されます。",
    "引張応力度が生じない条件は、圧縮側で σ = N/A − M/Z ≥ 0 となることです。",
    "① 断面積 A と断面係数 Z",
    `A = b×h = ${bmm}×${hmm} = ${A} mm²`,
    `Z = h×b²/6 = ${hmm}×${bmm}²/6 = ${Z} mm³`,
    "",
    "② 引張が生じない条件",
    "σ = N/A − M/Z ≥ 0",
    "N/A − (N×e)/Z ≥ 0",
    "N/A ≥ (N×e)/Z",
    "e ≤ Z/A",
    "",
    "③ 長方形断面では Z/A = (h×b²/6) / (b×h) = b/6 となるので、",
    `e_max = Z/A = b/6 = ${bmm}/6 = ${eMax} mm`,
  ];

  const L_dummy = 1;
  const PkN = 100;

  return {
    type: "concentrated",
    structure: "simple",
    L: L_dummy,
    P: PkN,
    a: L_dummy / 2,
    b: L_dummy / 2,
    target: "eccentric_e",
    answer: Math.round(eMax),
    choices,
    explanation: explanationLines.join("\n"),
    problemCategory: "bending-stress" as ProblemCategory,
    sectionBmm: bmm,
    sectionHmm: hmm,
    sectionShape: "rectangle",
    shortColumnMode: "no-tension-limit",
    customQuestion:
      "図の短柱において、断面に引張応力度が生じないための最大の偏心距離 e [mm] を求めよ。",
  };
}

/** せん断応力度 τ_max（長方形断面）問題を1問生成。τ_max = 3Q/(2A) = 1.5×Q/A */
function generateShearStressRectProblem(): BeamProblem | null {
  if (SHEAR_STRESS_RECT_CANDIDATES.length === 0) return null;
  const c = pickRandom(SHEAR_STRESS_RECT_CANDIDATES);
  const { L, P, a, bSpan, Q, useCantilever, bmm, hmm, A, tau } = c;

  const tauAvg = (Q * 1000) / A;
  const wrongCandidates = [
    tauAvg,
    Math.round(tauAvg),
    tau * 2,
    Math.round(tau / 2),
    Math.round((Q * 1000) / A),
  ].filter((v) => v > 0 && Math.abs(v - tau) > 1e-6);
  const chosenWrong = pickWrongChoices(wrongCandidates, tau, 3);
  let choices = [...chosenWrong, tau];
  if (choices.length < 4) {
    const fallback = [tau + 1, tau - 1, tau + 2, tau - 2].filter(
      (v) => v > 0 && !choices.includes(v)
    );
    for (const v of fallback) {
      if (choices.length >= 4) break;
      choices.push(v);
    }
  }
  choices = Array.from(new Set(choices)).sort((a, b) => a - b);

  const explanationLines = [
    "長方形断面の最大せん断応力度は、平均せん断応力度の1.5倍になります。",
    "τ_max = (3/2) × (Q/A) = 1.5 × (Q/A)",
    "① 断面積 A",
    `A = b×h = ${bmm}×${hmm} = ${A} mm²`,
    "",
    "② せん断力 Q（図の梁から）",
    useCantilever
      ? `片持ち梁の固定端付近では Q = P = ${P} kN = ${P * 1000} N`
      : `単純梁中央集中荷重では支点付近のせん断力は Q = P/2 = ${P}/2 = ${Q} kN = ${Q * 1000} N`,
    "",
    "③ 最大せん断応力度",
    `τ_max = 1.5 × (Q/A) = 1.5 × (${Q * 1000} / ${A}) = ${tau} N/mm²`,
  ];

  return {
    type: "concentrated",
    structure: useCantilever ? "cantilever" : "simple",
    L,
    P,
    a,
    b: bSpan,
    target: "tau",
    answer: tau,
    choices,
    explanation: explanationLines.join("\n"),
    problemCategory: "bending-stress" as ProblemCategory,
    sectionBmm: bmm,
    sectionHmm: hmm,
    sectionShape: "rectangle",
    customQuestion:
      "図の梁・断面において、断面に生じる最大せん断応力度 τ_max [N/mm²] を求めよ。",
  };
}

/** せん断応力度 τ（H形・ウェブ負担）問題を1問生成。τ = Q/(t_w×h_w) */
function generateShearStressHProblem(): BeamProblem | null {
  if (SHEAR_STRESS_H_CANDIDATES.length === 0) return null;
  const c = pickRandom(SHEAR_STRESS_H_CANDIDATES);
  const { L, P, a, bSpan, Q, useCantilever, bmm, hmm, tf, tw, hw, tau } = c;

  const areaWeb = tw * hw;
  const wrongCandidates = [
    Math.round((Q * 1000) / (bmm * hmm)),
    Math.round((Q * 1000) / (bmm * hw)),
    tau * 2,
    Math.round(tau / 2),
  ].filter((v) => v > 0 && Math.abs(v - tau) > 1e-6);
  const chosenWrong = pickWrongChoices(wrongCandidates, tau, 3);
  let choices = [...chosenWrong, tau];
  if (choices.length < 4) {
    const fallback = [tau + 1, tau - 1, tau + 2, tau - 2].filter(
      (v) => v > 0 && !choices.includes(v)
    );
    for (const v of fallback) {
      if (choices.length >= 4) break;
      choices.push(v);
    }
  }
  choices = Array.from(new Set(choices)).sort((a, b) => a - b);

  const explanationLines = [
    "H形断面では、せん断力はウェブ（縦の板）のみで負担すると仮定します。",
    "τ = Q / (t_w × h_w)",
    "① ウェブの有効断面積",
    `h_w = h − 2×t_f = ${hmm} − 2×${tf} = ${hw} mm`,
    `t_w × h_w = ${tw} × ${hw} = ${areaWeb} mm²`,
    "",
    "② せん断力 Q",
    useCantilever
      ? `片持ち梁では Q = P = ${P} kN = ${P * 1000} N`
      : `単純梁中央集中荷重では Q = P/2 = ${Q} kN = ${Q * 1000} N`,
    "",
    "③ せん断応力度",
    `τ = Q / (t_w × h_w) = ${Q * 1000} / ${areaWeb} = ${tau} N/mm²`,
  ];

  return {
    type: "concentrated",
    structure: useCantilever ? "cantilever" : "simple",
    L,
    P,
    a,
    b: bSpan,
    target: "tau",
    answer: tau,
    choices,
    explanation: explanationLines.join("\n"),
    problemCategory: "bending-stress" as ProblemCategory,
    sectionBmm: bmm,
    sectionHmm: hmm,
    sectionShape: "H-shape",
    sectionTfMm: tf,
    sectionTwMm: tw,
    customQuestion:
      "図のH形断面梁において、せん断力をウェブのみで負担すると仮定したとき、ウェブに生じるせん断応力度 τ [N/mm²] を求めよ。",
  };
}

/** 単純梁 or 片持ち梁の集中荷重から曲げ応力度 σ を求める問題を生成。
 * 上級では複合応力度 σ = N/A + M/Z を出題する場合あり。 */
export function generateBendingStressProblem(
  difficulty: Difficulty
): BeamProblem {
  if (difficulty === "beginner") {
    return generateSectionPropertiesProblem("intermediate");
  }

  // 中級・上級で複合応力度・短柱・せん断応力度を出題
  const combinedRate = difficulty === "advanced" ? 0.35 : 0.25;
  const shortColumnRate = difficulty === "advanced" ? 0.25 : 0.2;
  const shearStressRate = difficulty === "advanced" ? 0.2 : 0.15;
  if (
    (difficulty === "intermediate" || difficulty === "advanced") &&
    Math.random() < combinedRate &&
    getCombinedStressCandidates().length > 0
  ) {
    return generateCombinedStressProblem();
  }

  if (difficulty === "intermediate" || difficulty === "advanced") {
    const r = Math.random();
    if (r < shearStressRate) {
      const tauGens: (() => BeamProblem | null)[] = [
        generateShearStressRectProblem,
        generateShearStressHProblem,
      ];
      const shuffled = [...tauGens].sort(() => Math.random() - 0.5);
      for (const gen of shuffled) {
        const p = gen();
        if (p != null) return p;
      }
    }
    if (r < shearStressRate + shortColumnRate) {
      const generators: (() => BeamProblem | null)[] = [
        generateShortColumnMaxCompressionProblem,
        generateShortColumnCoreLimitProblem,
      ];
      const shuffled = [...generators].sort(() => Math.random() - 0.5);
      for (const gen of shuffled) {
        const p = gen();
        if (p != null) return p;
      }
    }
  }

  const candidates = getBendingStressCandidates();
  if (candidates.length === 0) {
    // フォールバック: 従来ロジックで1問だけ生成（通常は到達しない）
    return generateBendingStressProblemFallback();
  }

  const c = pickRandom(candidates);
  const { L, P, a, bSpan, Mmax, useCantilever, bmm, hmm, Z, sigma } = c;
  const answer = sigma;

  const wrongCandidates: number[] = [
    Math.round((Mmax * 1_000_000) / (bmm * hmm * hmm)), // 6 を掛け忘れ
    Math.round((Mmax * 1_000) / Z), // 10^6 を 10^3 と誤る
    Math.round((Mmax * 1_000_000) / ((bmm * hmm * hmm * hmm) / 12)), // I を使う誤り
    sigma * 2,
    Math.round(sigma / 2),
  ];

  // 梁の種別を取り違えたときに出やすい値を追加する（死に枠を減らす）
  if (!useCantilever) {
    // 単純梁なのに等分布荷重と混同して M = P L / 8 と考えた場合
    const M_PL_over_8 = (P * L) / 8;
    const sigma_PL_over_8 = Math.round(
      (M_PL_over_8 * 1_000_000) / Z
    );
    // 単純梁なのに片持ちと混同して M = P L と考えた場合
    const M_PL = P * L;
    const sigma_PL = Math.round((M_PL * 1_000_000) / Z);
    wrongCandidates.push(sigma_PL_over_8, sigma_PL);
  } else {
    // 片持ち梁なのに単純梁中央集中と混同して M = P L / 4 と考えた場合
    const M_PL_over_4 = (P * L) / 4;
    const sigma_PL_over_4 = Math.round(
      (M_PL_over_4 * 1_000_000) / Z
    );
    wrongCandidates.push(sigma_PL_over_4);
  }

  // あまりに桁外れ（正解の数百分の一など）の値は死に枠になりやすいので除外する
  const magnitudeFiltered = wrongCandidates.filter((v) => {
    if (v <= 0) return false;
    if (Math.abs(v - answer) < 1e-6) return false;
    // 正解の 1/4～4 倍の範囲に絞る（本試験の選択肢の感覚に合わせる）
    return v >= answer / 4 && v <= answer * 4;
  });

  const baseForPicking =
    magnitudeFiltered.length >= 3 ? magnitudeFiltered : wrongCandidates;

  const chosenWrong = pickWrongChoices(baseForPicking, answer, 3);
  const choices = [...chosenWrong, answer].sort((a2, b2) => a2 - b2);

  const explanationLines: string[] = [];
  if (useCantilever) {
    explanationLines.push(
      "まず片持ち梁の集中荷重による最大曲げモーメント M_max を求めます。",
      "片持ち梁では固定端のモーメントは M_max = P×a となるので、",
      `M_max = ${P} × ${a} = ${Mmax} kN·m`
    );
  } else {
    explanationLines.push(
      "まず単純梁の中央集中荷重の最大曲げモーメント M_max を求めます。",
      "中央集中荷重では M_max = P×L/4 となるので、",
      `M_max = ${P} × ${L} / 4 = ${Mmax} kN·m`
    );
  }

  explanationLines.push(
    "",
    "次に長方形断面の断面係数 Z を求めます（Z = b×h²/6）。",
    `b = ${bmm} mm, h = ${hmm} mm より、`,
    `Z = (${bmm} × ${hmm}²) / 6 = ${bmm * hmm * hmm} / 6 = ${Z} mm³`,
    "",
    "曲げ応力度 σ は σ = M/Z で求めます。M を N·mm に変換すると、",
    `M_max = ${Mmax} kN·m = ${Mmax} × 10^6 N·mm`,
    `σ = M_max / Z = (${Mmax} × 10^6) / ${Z} = ${answer} N/mm²`
  );

  const explanation = explanationLines.join("\n");

  return {
    L,
    structure: useCantilever ? "cantilever" : "simple",
    type: "concentrated",
    target: "sigma",
    answer,
    choices,
    explanation,
    hideDimensionB: false,
    sectionBmm: bmm,
    sectionHmm: hmm,
    problemCategory: "bending-stress" as ProblemCategory,
    P,
    a,
    b: bSpan,
  };
}

/** 候補が0件のときのフォールバック（通常は使わない） */
function generateBendingStressProblemFallback(): BeamProblem {
  const useCantilever = Math.random() < 0.5;
  const L = useCantilever
    ? pickRandom(CANTILEVER_L_VALUES_M)
    : pickRandom(SIMPLE_L_VALUES_M);
  const P = pickRandom(P_VALUES_KN);
  const a = useCantilever ? L : L / 2;
  const bSpan = L - a;
  const Mmax = useCantilever ? P * L : (P * L) / 4;
  const [bmm, hmm] = pickRandom(SECTION_PAIRS);
  const Z = (bmm * hmm * hmm) / 6;
  const sigmaExact = (Mmax * 1_000_000) / Z;
  const answer = roundToInteger(sigmaExact);

  const wrongCandidates: number[] = [
    roundToInteger((Mmax * 1_000_000) / (bmm * hmm * hmm)),
    roundToInteger((Mmax * 1_000) / Z),
    roundToInteger((Mmax * 1_000_000) / ((bmm * hmm * hmm * hmm) / 12)),
    roundToInteger(sigmaExact * 2),
    roundToInteger(sigmaExact / 2),
  ];
  const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  const choices = [...chosenWrong, answer].sort((a2, b2) => a2 - b2);

  const explanationLines: string[] = [];
  if (useCantilever) {
    explanationLines.push(
      "まず片持ち梁の集中荷重による最大曲げモーメント M_max を求めます。",
      "片持ち梁では固定端のモーメントは M_max = P×a となるので、",
      `M_max = ${P} × ${a} = ${Mmax.toFixed(1)} kN·m`
    );
  } else {
    explanationLines.push(
      "まず単純梁の中央集中荷重の最大曲げモーメント M_max を求めます。",
      "中央集中荷重では M_max = P×L/4 となるので、",
      `M_max = ${P} × ${L} / 4 = ${Mmax.toFixed(1)} kN·m`
    );
  }
  explanationLines.push(
    "",
    "次に長方形断面の断面係数 Z を求めます（Z = b×h²/6）。",
    `b = ${bmm} mm, h = ${hmm} mm より、`,
    `Z = (${bmm} × ${hmm}²) / 6 = ${bmm * hmm * hmm} / 6 = ${Z} mm³`,
    "",
    "曲げ応力度 σ は σ = M/Z で求めます。M を N·mm に変換すると、",
    `M_max = ${Mmax.toFixed(1)} kN·m = ${Mmax.toFixed(1)} × 10^6 N·mm`,
    `σ = M_max / Z = ${answer} N/mm²`
  );

  return {
    L,
    structure: useCantilever ? "cantilever" : "simple",
    type: "concentrated",
    target: "sigma",
    answer,
    choices,
    explanation: explanationLines.join("\n"),
    hideDimensionB: false,
    sectionBmm: bmm,
    sectionHmm: hmm,
    problemCategory: "bending-stress" as ProblemCategory,
    P,
    a,
    b: bSpan,
  };
}

