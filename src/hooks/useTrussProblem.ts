import type {
  BeamProblem,
  Difficulty,
  ProblemCategory,
  TrussPattern,
} from "../types";

const P_VALUES_KN = [20, 24, 30, 40] as const;
const L_VALUES_M = [3, 4, 5] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 山形トラス（45°）: 底辺の軸力は N = (P/2) cot(θ) = P/2（引張）。符号は引張+・圧縮-。 */
export function generateTrussCalculation(difficulty: Difficulty): BeamProblem {
  const P = pickRandom(P_VALUES_KN);
  const L = pickRandom(L_VALUES_M);
  const answer = P / 2;

  const wrongCandidates: number[] = [
    0,
    -answer,
    P,
    -P,
    P / 4,
    -P / 4,
    (P * 3) / 4,
  ].filter((v) => Math.abs(v - answer) > 0.01);
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const explanation = [
    "山形トラスで頂点に荷重 P が作用するとき、左右の支点反力はそれぞれ P/2 です。",
    "底辺（水平部材）の軸力は、節点の水平力のつり合いから求めます。",
    "斜材の傾きが 45°（縦1：横1）なので、鉛直成分と水平成分の力は同じ大きさになります。",
    "斜材が 45° のとき、斜材の水平成分が底辺と釣り合うため、底辺の軸力 N = (P/2) cot(45°) = P/2 となります。",
    "底辺は引張なので N_A = +" + answer + " kN です。",
    "※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。",
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "truss-calculation" as ProblemCategory,
    trussPattern: "simple-triangle" as TrussPattern,
    targetMember: "A",
    trussP: P,
    trussL: L,
    P: 0,
    a: 0,
    b: 0,
  };
}

/** ゼロメンバー（T字節点）: 直線上に2部材、その節点に1部材が交接。外力なしならその1部材の軸力は0。 */
function generateTrussZeroT(): BeamProblem {
  const P = pickRandom(P_VALUES_KN);
  const L = pickRandom(L_VALUES_M);
  const answer = 0;

  const wrongCandidates: number[] = [P / 2, -P / 2, P, -P, P / 4, -P / 4];
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const explanation = [
    "荷重のない節点に3本の部材が接続し、そのうち2本が同一直線上にあるとき、残りの1本の軸力は 0 になります（ゼロメンバーの定理）。",
    "図のT字節点（上弦中央）では、左水平材と右水平材が同一直線上にあり、部材A（T字の縦棒＝上弦中央から下に向かう1本）は同一直線上にない方の1本なので N_A = 0 kN です。",
    "※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。",
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "truss-zero" as ProblemCategory,
    trussPattern: "zero-member-t" as TrussPattern,
    targetMember: "A",
    trussP: P,
    trussL: L,
    P: 0,
    a: 0,
    b: 0,
  };
}

/** ゼロメンバー: L字節点またはT字節点のいずれかを50%で出題。荷重のない節点で同一直線上に2部材があるとき、残り1本の軸力は0。 */
export function generateTrussZero(difficulty: Difficulty): BeamProblem {
  if (Math.random() < 0.5) return generateTrussZeroT();

  const P = pickRandom(P_VALUES_KN);
  const L = pickRandom(L_VALUES_M);
  const answer = 0;

  const wrongCandidates: number[] = [P / 2, -P / 2, P, -P, P / 4, -P / 4];
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const explanation = [
    "荷重のない節点に3本の部材が接続し、そのうち2本が同一直線上にあるとき、残りの1本の軸力は 0 になります（ゼロメンバーの定理）。",
    "図のL字節点では、左斜材と右上への部材が同一直線上にあり、部材A（L字節点→右下）は同一直線上にない方の1本なので N_A = 0 kN です。",
    "※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。",
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "truss-zero" as ProblemCategory,
    trussPattern: "zero-member" as TrussPattern,
    targetMember: "A",
    trussP: P,
    trussL: L,
    P: 0,
    a: 0,
    b: 0,
  };
}

/**
 * 片持ちトラス: 2スパン・高さL、先端にP。第1パネルで切断し、切断面以右に P のみ。
 * 上弦A: モーメント中心＝中央下節点。荷重までの距離 L → M = P×L → N_A = +P（引張）。
 * 下弦B: モーメント中心＝左上支点（壁）。荷重までの距離 2L → M = P×2L → N_B = -2P（圧縮）。
 */
export function generateTrussCantilever(difficulty: Difficulty): BeamProblem {
  const P = pickRandom(P_VALUES_KN);
  const L = pickRandom(L_VALUES_M);
  const targetMember = pickRandom(["A", "B"] as const);
  const answer = targetMember === "A" ? P : -2 * P;

  const wrongCandidates: number[] = [
    0,
    P / 2,
    -P / 2,
    P,
    -P,
    P * 2,
    -P * 2,
    P / 4,
    -P / 4,
  ].filter((v) => Math.abs(v - answer) > 0.01);
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const memberLabel = targetMember === "A" ? "上弦（第1スパン）" : "下弦（第1スパン）";
  const signLabel = targetMember === "A" ? "引張" : "圧縮";
  const explanation =
    targetMember === "A"
      ? [
          "片持ちトラスで先端に荷重 P が作用するとき、第1パネルで切断し切断面以右の自由体を考えます。",
          "上弦材（部材A）を求めるには、モーメントの中心を「中央下節点」（斜材と下弦の交点）に取ります。荷重 P までの距離は L なので M = P×L。上弦の軸力の大きさは N = M/h = P×L/L = P、引張なので N_A = +P kN です。",
          "部材A（" + memberLabel + "）は" + signLabel + "なので N = " + answer + " kN です。",
          "※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。",
        ].join("\n")
      : [
          "片持ちトラスで先端に荷重 P が作用するとき、第1パネルで切断し切断面以右の自由体を考えます。",
          "下弦材（部材B）を求めるには、モーメントの中心を「左上支点（壁）」に取ります。荷重 P までの距離は 2L なので M = P×2L。下弦の軸力の大きさは N = M/h = P×2L/L = 2P、圧縮なので N_B = -2P kN です。",
          "部材B（" + memberLabel + "）は" + signLabel + "なので N = " + answer + " kN です。",
          "※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。",
        ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "truss-calculation" as ProblemCategory,
    trussPattern: "cantilever-truss" as TrussPattern,
    targetMember,
    trussP: P,
    trussL: L,
    P: 0,
    a: 0,
    b: 0,
  };
}

/**
 * プラットトラス（静定・2スパン・3:4:5）: 左右端垂直材あり、下弦中央にP。
 * 節点6・部材9で 2n-3=9 の静定。A=左斜材(引張 +5P/6), B=上弦(圧縮 -2P/3),
 * C=下弦左(0), D=中央垂直材(0)。※荷重Pは中央下節点にあり、左右斜材の鉛直成分でPを受け持つため中央垂直材は0。
 */
const P_VALUES_PRATT_L4 = [24, 30, 36] as const;
const P_VALUES_PRATT_L8 = [24, 30, 36, 48] as const;
type PrattMember = "A" | "B" | "C" | "D";

function getPrattAnswer(member: PrattMember, P: number): number {
  switch (member) {
    case "A":
      return (5 * P) / 6; // 左斜材 引張
    case "B":
      return -(2 * P) / 3; // 上弦 圧縮
    case "C":
      return 0; // 下弦左 ゼロ（左支点の水平成分なし）
    case "D":
      return 0; // 中央垂直材 ゼロ（中央下節点で左右斜材の鉛直成分がPを打ち消すため）
  }
}

function getPrattWrongCandidates(member: PrattMember, P: number, answer: number): number[] {
  const a = (5 * P) / 6;
  const b = (2 * P) / 3;
  const halfP = P / 2;
  const base = [
    0,
    -answer,
    answer,
    P,
    -P,
    a,
    -a,
    b,
    -b,
    halfP,
    -halfP,
    answer / 2,
    answer * 2,
  ].filter((v) => Math.abs(v - answer) > 0.01);
  return Array.from(new Set(base));
}

export function generateTrussPratt(difficulty: Difficulty): BeamProblem {
  const useL8 = Math.random() < 0.5;
  const L = useL8 ? 8 : 4;
  const P = useL8
    ? P_VALUES_PRATT_L8[Math.floor(Math.random() * P_VALUES_PRATT_L8.length)]
    : P_VALUES_PRATT_L4[Math.floor(Math.random() * P_VALUES_PRATT_L4.length)];

  const targetMember = (["A", "B", "C", "D"] as const)[
    Math.floor(Math.random() * 4)
  ] as PrattMember;
  const answer = getPrattAnswer(targetMember, P);

  const wrongCandidates = getPrattWrongCandidates(targetMember, P, answer);
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && wrongCandidates.length > 0) {
    const idx = Math.floor(Math.random() * wrongCandidates.length);
    chosenWrong.push(wrongCandidates.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const memberLabel =
    targetMember === "A"
      ? "左斜材"
      : targetMember === "B"
        ? "上弦（左スパン）"
        : targetMember === "C"
          ? "下弦（左スパン）"
          : "中央垂直材";
  const hLabel = L === 4 ? "h = 3 m、スパン 2L = 8 m" : "h = 6 m、スパン 2L = 16 m";
  const explanation = [
    "プラットトラス（左右端に垂直材あり・静定）で下弦中央に荷重 P、支点反力はそれぞれ P/2 です。",
    `図は ${hLabel} の 3:4:5 です。`,
    targetMember === "A" &&
      "左支点の鉛直反力 P/2 が左端垂直材を経て左上節点に。左斜材の鉛直成分と釣り合い N_A×(3/5)=P/2 より N_A=(5P)/6（引張）。",
    targetMember === "B" &&
      "左上節点の水平つり合いで、上弦は左斜材の水平成分と釣り合うので N_B = -(2P)/3（圧縮）。",
    targetMember === "C" &&
      "左下節点には鉛直反力と左端垂直材のみが接続し、下弦左は水平方向のみなので N_C = 0。",
    targetMember === "D" &&
      "中央下節点に荷重Pが作用。左右の斜材（各々鉛直成分 P/2 で上向き）がPを受け持つため、中央垂直材の軸力は N_D = 0（ゼロメンバー）。",
    `部材${targetMember}（${memberLabel}）は N = ${answer} kN です。`,
    "※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "M_max",
    answer,
    choices,
    explanation,
    problemCategory: "truss-calculation" as ProblemCategory,
    trussPattern: "pratt-truss" as TrussPattern,
    targetMember,
    trussP: P,
    trussL: L,
    P: 0,
    a: 0,
    b: 0,
  };
}
