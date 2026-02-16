import type {
  BeamProblem,
  BucklingSupportType,
  BucklingTarget,
  Difficulty,
  ProblemCategory,
} from "../types";

/** 支持条件ごとの座屈長さ係数 γ（l_k = γ × L） */
const GAMMA: Record<BucklingSupportType, number> = {
  "pinned-pinned": 1.0,
  "fixed-fixed": 0.5,
  "fixed-pinned": 0.7,
  "fixed-free": 2.0,
};

const SUPPORT_TYPES: BucklingSupportType[] = [
  "pinned-pinned",
  "fixed-fixed",
  "fixed-pinned",
  "fixed-free",
];

/** 比率問題で出題する支持。fixed-pinned は 1/γ² ≈ 2.04（roundToTwoDecimals）。 */
const SUPPORT_TYPES_FOR_RATIO: BucklingSupportType[] = [
  "pinned-pinned", // 1/1 = 1
  "fixed-fixed",   // 1/0.25 = 4
  "fixed-free",    // 1/4 = 0.25
  "fixed-pinned",  // 1/0.49 ≈ 2.04（建築士試験で頻出）
];

const L_VALUES_M = [2, 3, 4, 5] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 小数第1位に丸めて浮動小数点の汚い表示を防ぐ */
function roundToOneDecimal(x: number): number {
  return Math.round(x * 10) / 10;
}

/** 座屈荷重比率 1/γ² 用。0.25 を小数第1位で丸めると 0.3 になるため、小数第2位まで保持する */
function roundToTwoDecimals(x: number): number {
  return Math.round(x * 100) / 100;
}

/** 座屈長さ l_k = γ×L の問題（初級） */
export function generateBucklingLength(difficulty: Difficulty): BeamProblem {
  const supportType = pickRandom(SUPPORT_TYPES);
  const L = pickRandom(L_VALUES_M);
  const gamma = GAMMA[supportType];
  const answer = roundToOneDecimal(gamma * L);

  const wrongCandidates: number[] = [];
  SUPPORT_TYPES.forEach((st) => {
    if (st === supportType) return;
    const wrong = roundToOneDecimal(GAMMA[st] * L);
    if (wrong > 0 && Math.abs(wrong - answer) > 0.01) {
      wrongCandidates.push(wrong);
    }
  });
  wrongCandidates.push(
    roundToOneDecimal(0.5 * L),
    roundToOneDecimal(1.0 * L),
    roundToOneDecimal(2.0 * L),
    L
  );
  const uniq = Array.from(new Set(wrongCandidates)).filter(
    (v) => v > 0 && Math.abs(v - answer) > 0.01
  );

  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const supportLabel =
    supportType === "pinned-pinned"
      ? "両端ピン"
      : supportType === "fixed-fixed"
        ? "両端固定"
        : supportType === "fixed-pinned"
          ? "一端固定・他端ピン"
          : "一端固定・他端自由";

  const explanation = [
    "座屈長さ l_k は支持条件によって、柱の長さ L の係数 γ を用いて l_k = γ×L で表されます。",
    `${supportLabel}の場合、座屈長さ係数は γ = ${gamma} です。`,
    supportType === "fixed-free"
      ? "一端固定・他端自由では、座屈長さは元の長さの2倍（l_k = 2L）となります。"
      : supportType === "fixed-fixed"
        ? "両端固定では、座屈長さは元の長さの1/2（l_k = 0.5L）となります。"
        : supportType === "fixed-pinned"
          ? "一端固定・他端ピンでは、γ = 0.7 となり、l_k = 0.7L となります。"
          : "両端ピンの場合、l_k = L となります。",
    `したがって l_k = ${gamma} × ${L} = ${answer} m です。`,
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "buckling" as ProblemCategory,
    bucklingSupportType: supportType,
    bucklingTarget: "lk" as BucklingTarget,
    P: 0,
    a: 0,
    b: 0,
  };
}

/**
 * 意味のある誤答のみ使用（0.3 などの捨て枠を出さない）:
 * 0.25＝片持ち混同/分母取り違え、0.5＝係数γそのまま、1＝基準値取り違え、2＝一端固定・他端ピン混同
 */
const MEANINGFUL_RATIO_TRAPS = [0.25, 0.5, 1, 2] as const;

/** 座屈荷重の比率「両端ピン柱の何倍か」の問題（中級）。正解は 1/γ²。fixed-free は 0.25 のため小数第2位まで保持（丸めると 0.3 になるバグを防ぐ） */
export function generateBucklingLoad(difficulty: Difficulty): BeamProblem {
  const supportType = pickRandom(SUPPORT_TYPES_FOR_RATIO);
  const L = pickRandom(L_VALUES_M);
  const gamma = GAMMA[supportType];
  // 浮動小数点誤差で 0.49 が 0.489999... になるのを防ぐため、
  // 先に γ² を小数第2位で丸めてから 1/γ² を計算する。
  const gammaSquared = roundToTwoDecimals(gamma * gamma);
  const answer = roundToTwoDecimals(1 / gammaSquared);

  const isValidWrong = (v: number) => v > 0 && Math.abs(v - answer) > 0.01;
  const meaningfulValid = MEANINGFUL_RATIO_TRAPS.filter(isValidWrong);

  const otherCandidates: number[] = [];
  SUPPORT_TYPES_FOR_RATIO.forEach((st) => {
    if (st === supportType) return;
    const v = roundToTwoDecimals(1 / (GAMMA[st] * GAMMA[st]));
    if (isValidWrong(v)) otherCandidates.push(v);
  });
  const rest = Array.from(new Set(otherCandidates)).filter(
    (v) => !meaningfulValid.includes(v)
  );

  let chosenWrong: number[];
  if (meaningfulValid.length >= 3) {
    const shuffled = [...meaningfulValid];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    chosenWrong = shuffled.slice(0, 3);
  } else {
    chosenWrong = [...meaningfulValid];
    while (chosenWrong.length < 3 && rest.length > 0) {
      const idx = Math.floor(Math.random() * rest.length);
      const v = rest.splice(idx, 1)[0];
      if (!chosenWrong.includes(v)) chosenWrong.push(v);
    }
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const supportLabel =
    supportType === "pinned-pinned"
      ? "両端ピン"
      : supportType === "fixed-fixed"
        ? "両端固定"
        : supportType === "fixed-pinned"
          ? "一端固定・他端ピン"
          : "一端固定・他端自由";

  const explanation = [
    "弾性座屈荷重はオイラーの公式 P_k = π²EI / l_k² で与えられます。",
    "同じ EI・同じ長さ L の柱では、P_k は l_k² に反比例するため、座屈長さ係数 γ を用いると P_k ∝ 1/γ² となります。",
    "両端ピン柱を基準（γ=1）とすると、この柱の座屈荷重は両端ピン柱の 1/γ² 倍です。",
    `${supportLabel}では γ = ${gamma} なので、1/γ² = 1/${gammaSquared} = ${answer} 倍です。`,
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "buckling" as ProblemCategory,
    bucklingSupportType: supportType,
    bucklingTarget: "P_ratio" as BucklingTarget,
    P: 0,
    a: 0,
    b: 0,
  };
}
