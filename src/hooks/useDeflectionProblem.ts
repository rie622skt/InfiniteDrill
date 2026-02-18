import type { BeamProblem, Difficulty, ProblemCategory } from "../types";

/** たわみ倍率問題のパターン: 単純梁中央 / 片持ち先端 */
type DeflectionStructure = "simple" | "cantilever";

/** 何を変化させるか: L（スパン）, EI（曲げ剛性）, P（荷重） */
type DeflectionVariable = "L" | "EI" | "P";

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * たわみの倍率問題を1問生成（発展B）。
 * 単純梁中央 δ = PL³/(48EI)、片持ち先端 δ = PL³/(3EI) より、
 * δ ∝ L³, δ ∝ 1/EI, δ ∝ P。よって「Lを2倍にするとδは8倍」「EIを2倍にするとδは0.5倍」「Pを2倍にするとδは2倍」。
 */
/** δ = P×L³/(k×EI)。単純梁中央 k=48、片持ち先端 k=3 */
function deflectionCoeff(s: DeflectionStructure): number {
  return s === "simple" ? 48 : 3;
}

const DEFLECTION_COMPARISON_CASES: readonly {
  structureA: DeflectionStructure;
  structureB: DeflectionStructure;
  L_A: number;
  L_B: number;
  P_A: number;
  P_B: number;
  answer: number;
}[] = [
  { structureA: "simple", structureB: "cantilever", L_A: 4, L_B: 4, P_A: 1, P_B: 1, answer: 1 / 16 },
  { structureA: "simple", structureB: "cantilever", L_A: 2, L_B: 1, P_A: 1, P_B: 1, answer: 0.5 },
  { structureA: "simple", structureB: "cantilever", L_A: 2, L_B: 1, P_A: 2, P_B: 1, answer: 1 },
  { structureA: "simple", structureB: "cantilever", L_A: 4, L_B: 2, P_A: 4, P_B: 1, answer: 2 },
  { structureA: "simple", structureB: "cantilever", L_A: 4, L_B: 2, P_A: 1, P_B: 1, answer: 0.5 },
  { structureA: "cantilever", structureB: "simple", L_A: 4, L_B: 4, P_A: 1, P_B: 1, answer: 16 },
  { structureA: "cantilever", structureB: "simple", L_A: 1, L_B: 2, P_A: 1, P_B: 1, answer: 2 },
  { structureA: "cantilever", structureB: "simple", L_A: 1, L_B: 2, P_A: 1, P_B: 2, answer: 1 },
  { structureA: "cantilever", structureB: "simple", L_A: 2, L_B: 4, P_A: 1, P_B: 4, answer: 0.5 },
];

function roundToFour(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function generateDeflectionComparisonProblem(): BeamProblem {
  const c = pickRandom(DEFLECTION_COMPARISON_CASES);
  const kA = deflectionCoeff(c.structureA);
  const kB = deflectionCoeff(c.structureB);
  const deltaA = (c.P_A * c.L_A ** 3) / kA;
  const deltaB = (c.P_B * c.L_B ** 3) / kB;
  const answer = roundToFour(deltaA / deltaB);
  const wrongCandidates = [
    roundToFour(deltaB / deltaA),
    roundToFour((c.P_A / c.P_B) * (c.L_A / c.L_B)),
    roundToFour((c.L_A / c.L_B) ** 3),
    answer * 2,
    answer / 2,
    answer * 4,
    answer / 4,
    1,
  ].filter((v) => v > 0 && Math.abs(v - answer) > 0.001);
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);
  const labelA = c.structureA === "simple" ? "単純梁（中央集中荷重 P_A）" : "片持ち梁（先端集中荷重 P_A）";
  const labelB = c.structureB === "simple" ? "単純梁（中央集中荷重 P_B）" : "片持ち梁（先端集中荷重 P_B）";
  const numA = c.P_A * c.L_A ** 3;
  const numB = c.P_B * c.L_B ** 3;
  const denA = c.structureA === "simple" ? 48 : 3;
  const denB = c.structureB === "simple" ? 48 : 3;
  const explanation = [
    "梁A・梁Bそれぞれのたわみ公式から δ_A, δ_B を求め、比 δ_A/δ_B を計算します。",
    `梁A（${labelA}）: δ_A = P_A×L_A³/(${denA}EI)`,
    `梁B（${labelB}）: δ_B = P_B×L_B³/(${denB}EI)`,
    `δ_A = ${c.P_A}×${c.L_A}³/(${denA}EI) = ${numA}/(${denA}EI), δ_B = ${c.P_B}×${c.L_B}³/(${denB}EI) = ${numB}/(${denB}EI)`,
    `δ_A/δ_B = (${numA}/${denA}) / (${numB}/${denB}) = ${answer}`,
  ].join("\n");
  return {
    type: "concentrated",
    structure: c.structureA,
    L: c.L_A,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "deflection" as ProblemCategory,
    customQuestion: "梁Aのたわみ δ_A と梁Bのたわみ δ_B の比 δ_A/δ_B を求めよ。",
    P: c.P_A,
    a: c.structureA === "simple" ? c.L_A / 2 : c.L_A,
    b: c.structureA === "simple" ? c.L_A / 2 : 0,
    deflectionComparison: {
      structureA: c.structureA,
      structureB: c.structureB,
      L_A: c.L_A,
      L_B: c.L_B,
      P_A: c.P_A,
      P_B: c.P_B,
    },
  };
}

export function generateDeflectionProblem(difficulty?: Difficulty): BeamProblem {
  const eff = difficulty ?? "intermediate";
  if (eff === "intermediate" || eff === "advanced") {
    if (Math.random() < 0.5) return generateDeflectionComparisonProblem();
  }
  const structure = pickRandom(["simple", "cantilever"] as const) as DeflectionStructure;
  const variable = pickRandom(["L", "EI", "P"] as const) as DeflectionVariable;
  const mult = 2; // 「2倍にすると」に固定（答えがきれいな整数・0.5になるため）

  let answer: number;
  let wrongCandidates: number[];

  if (variable === "L") {
    answer = 8; // δ ∝ L³ → 2³ = 8
    wrongCandidates = [2, 4, 16, 1, 6, 3];
  } else if (variable === "EI") {
    answer = 0.5; // δ ∝ 1/EI → 1/2
    wrongCandidates = [1, 2, 0.25, 4, 8, 0.125];
  } else {
    answer = 2; // δ ∝ P
    wrongCandidates = [1, 4, 0.5, 8, 0.25];
  }

  const uniq = Array.from(new Set(wrongCandidates)).filter(
    (v) => v > 0 && Math.abs(v - answer) > 0.01
  );
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const structureLabel =
    structure === "simple"
      ? "単純梁の中央に集中荷重 P が作用するとき、中央たわみは δ = PL³/(48EI) で与えられます。"
      : "片持ち梁の先端に集中荷重 P が作用するとき、先端たわみは δ = PL³/(3EI) で与えられます。";
  const explanation = [
    structureLabel,
    "いずれも δ は L³ に比例し、1/EI に比例し、P に比例します。",
    variable === "L"
      ? `したがって L を ${mult} 倍にすると、δ は ${mult}³ = ${answer} 倍になります。`
      : variable === "EI"
        ? `したがって EI を ${mult} 倍にすると、δ は 1/${mult} = ${answer} 倍になります。`
        : `したがって P を ${mult} 倍にすると、δ は ${mult} 倍になります。`,
  ].join("\n");

  const beamLabel = structure === "simple" ? "単純梁の中央" : "片持ち梁の先端";
  const customQuestion =
    variable === "L"
      ? `${beamLabel}たわみ δ について、スパン L を ${mult} 倍にしたとき、たわみは何倍になるか。`
      : variable === "EI"
        ? `${beamLabel}たわみ δ について、曲げ剛性 EI を ${mult} 倍にしたとき、たわみは何倍になるか。`
        : `${beamLabel}たわみ δ について、荷重 P を ${mult} 倍にしたとき、たわみは何倍になるか。`;

  // 描画用のダミー値（比率問題は P,L,EI の比例関係のみ問うため、図は「イメージ」として正しい形で描く）
  // 単純梁: 中央荷重 P=10kN, L=4m, a=2m, b=2m。片持ち: 先端荷重 P=10kN, L=4m, a=4m, b=0m
  const L = 4;
  const P = 10;
  const a = structure === "simple" ? 2 : 4;
  const b = structure === "simple" ? 2 : 0;

  return {
    type: "concentrated",
    structure,
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "deflection" as ProblemCategory,
    customQuestion,
    P,
    a,
    b,
  };
}
