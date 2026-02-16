import type { BeamProblem, ProblemCategory, ProblemTarget } from "../types";

/** 3ヒンジ門形ラーメン: スパン L、軒高 h、梁中央に P。柱頭曲げモーメント M = P*L/4（整数になる組み合わせのみ） */
const FRAME_TRIPLES: readonly [number, number, number][] = (() => {
  const triples: [number, number, number][] = [];
  const L_VALS = [4, 6, 8] as const;
  const H_VALS = [2, 3, 4] as const;
  const P_VALS = [20, 24, 30, 40] as const;
  for (const L of L_VALS) {
    for (const h of H_VALS) {
      for (const P of P_VALS) {
        const M = (P * L) / 4;
        if (Number.isInteger(M) && M > 0) triples.push([L, h, P]);
      }
    }
  }
  return triples.length > 0 ? triples : [[4, 3, 24]];
})();

/** 3ヒンジ門形ラーメン: 梁上等分布 w。左柱頭曲げ M = w*L²/8（整数になる [L, h, w] のみ） */
const FRAME_DISTRIBUTED_TRIPLES: readonly [number, number, number][] = (() => {
  const triples: [number, number, number][] = [];
  const L_VALS = [4, 6, 8] as const;
  const H_VALS = [2, 3, 4] as const;
  const W_VALS = [4, 6, 8, 10, 12, 16] as const;
  for (const L of L_VALS) {
    for (const h of H_VALS) {
      for (const w of W_VALS) {
        const M = (w * L * L) / 8;
        if (Number.isInteger(M) && M > 0) triples.push([L, h, w]);
      }
    }
  }
  return triples.length > 0 ? triples : [[4, 3, 8]];
})();

/** 3ヒンジ門形ラーメン: 左柱に水平荷重 P。左柱頭曲げ M = P×h（整数になる [L, h, P] のみ） */
const FRAME_HORIZONTAL_TRIPLES: readonly [number, number, number][] = (() => {
  const triples: [number, number, number][] = [];
  const L_VALS = [4, 6, 8] as const;
  const H_VALS = [2, 3, 4] as const;
  const P_VALS = [20, 24, 30, 40] as const;
  for (const L of L_VALS) {
    for (const h of H_VALS) {
      for (const P of P_VALS) {
        const M = P * h;
        if (Number.isInteger(M) && M > 0) triples.push([L, h, P]);
      }
    }
  }
  return triples.length > 0 ? triples : [[4, 3, 24]];
})();

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 静定ラーメン（3ヒンジ門形）・梁中央集中荷重 P の1問を生成。
 * 左柱頭曲げ M = P*L/4。正解は TRIPLES で整数のみ。誤答は「式として整数になるもの」だけを候補にする（丸めない）。
 */
function generateFrameProblemConcentrated(): BeamProblem {
  const [L, h, P] = pickRandom(FRAME_TRIPLES);
  const answer = (P * L) / 4;

  const rawWrong = [
    (P * L) / 2,
    (P * h) / 2,
    P * L,
    P * h,
    (P * L) / 8,
    answer + 10,
    answer - 10,
    answer + 6,
    answer - 6,
    answer + 12,
    answer - 12,
  ];
  const wrongCandidates = rawWrong.filter(
    (v) => Number.isInteger(v) && v > 0 && Math.abs(v - answer) > 0.5
  );
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const explanation = [
    "3ヒンジラーメン（門形で梁中央にヒンジ）で、梁中央に集中荷重 P が作用する場合、対称より鉛直反力は V_A = V_B = P/2 です。",
    "左柱脚まわりのモーメントのつり合いから、水平反力 H を用いて H×h = (P/2)×(L/2) より H = P×L/(4h) です。",
    "左柱頭（柱と梁の接合部）の曲げモーメントの大きさは M = H×h = P×L/4 となります。",
    `M = ${P}×${L}/4 = ${answer} kN·m`,
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "frame_M_left" as ProblemTarget,
    answer,
    choices,
    explanation,
    problemCategory: "frame" as ProblemCategory,
    frameL: L,
    frameH: h,
    frameP: P,
    P: 0,
    a: 0,
    b: 0,
  };
}

/**
 * 静定ラーメン（3ヒンジ門形）・梁上等分布荷重 w の1問を生成。
 * 左柱頭曲げ M = w*L²/8。正解は TRIPLES で整数のみ。
 * 誤答は「w,L,h から計算して整数になる式」だけを候補にする（丸めない）。(w*L²)/4,(w*L²)/2, w*L² は常に整数。
 */
function generateFrameProblemDistributed(): BeamProblem {
  const [L, h, w] = pickRandom(FRAME_DISTRIBUTED_TRIPLES);
  const answer = (w * L * L) / 8;

  const rawWrong = [
    (w * L * L) / 4,
    (w * L * L) / 2,
    w * L * L,
    answer + 10,
    answer - 10,
    answer + 8,
    answer - 8,
    answer + 6,
    answer - 6,
    answer + 12,
    answer - 12,
  ];
  if (Number.isInteger((w * L * h) / 4)) {
    rawWrong.push((w * L * h) / 4);
  }
  const wrongCandidates = rawWrong.filter(
    (v) => Number.isInteger(v) && v > 0 && Math.abs(v - answer) > 0.5
  );
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const explanation = [
    "3ヒンジラーメンで梁上に等分布荷重 w が作用する場合、対称より鉛直反力は V_A = V_B = w×L/2 です。",
    "左柱脚まわりのモーメントのつり合い（左半スパンの等分布の合力 w×L/2 が L/4 の位置に作用）から、H×h = (w×L/2)×(L/2) − (w×L/2)×(L/4) = w×L²/8 です。",
    "左柱頭の曲げモーメントの大きさは M = H×h = w×L²/8 となります。",
    `M = ${w}×${L}²/8 = ${answer} kN·m`,
  ].join("\n");

  return {
    type: "distributed",
    structure: "simple",
    L,
    target: "frame_M_left" as ProblemTarget,
    answer,
    choices,
    explanation,
    problemCategory: "frame" as ProblemCategory,
    frameL: L,
    frameH: h,
    frameW: w,
    w,
  };
}

/**
 * 静定ラーメン（3ヒンジ門形）・左柱頭に水平荷重 P の1問を生成（発展C）。
 * 正解: 左柱頭曲げ M = (P×h)/2。3ヒンジラーメンでは水平反力が左右で P/2 ずつ負担するため、左柱頭 M = H_A×h = (P/2)×h。
 * 誤答トラップ: P×h（片持ち柱と混同）、P、係数取り違え。
 */
function generateFrameProblemHorizontal(): BeamProblem {
  const [L, h, P] = pickRandom(FRAME_HORIZONTAL_TRIPLES);
  const answer = (P * h) / 2; // H_A = P/2, M = H_A×h = P×h/2

  const rawWrong = [
    P * h, // 片持ち柱と混同した場合の最高の罠
    P, // 荷重 P をそのまま選んでしまう層向け
    (P * L) / 4, // 鉛直荷重の式と混同
    P * L,
    P + h,
    (P * L) / 2,
    answer + 10,
    answer - 10,
    answer + 6,
    answer - 6,
    answer + 12,
    answer - 12,
  ];
  const wrongCandidates = rawWrong.filter(
    (v) => Number.isInteger(v) && v > 0 && Math.abs(v - answer) > 0.5
  );
  const uniq = Array.from(new Set(wrongCandidates));
  const chosenWrong: number[] = [];
  while (chosenWrong.length < 3 && uniq.length > 0) {
    const idx = Math.floor(Math.random() * uniq.length);
    chosenWrong.push(uniq.splice(idx, 1)[0]);
  }
  const choices = [...chosenWrong, answer].sort((a, b) => a - b);

  const explanation = [
    "3ヒンジラーメンの柱頭に水平荷重 P が作用すると、全体のモーメントの釣り合いから、左右の支点に上向き・下向きの鉛直反力が発生します。",
    "この状態から中央ヒンジ回りのモーメントつり合いを解くと、水平反力は必ず左右の支点で半分ずつ（H_A = H_B = P/2）負担するという性質が導かれます。",
    "したがって、左柱頭の曲げモーメント M は、左柱脚の水平反力 H_A = P/2 が柱頭までの距離 h に作用するため、M = H_A×h = (P/2)×h となります。",
    `M = (${P}/2)×${h} = ${answer} kN·m`,
  ].join("\n");

  return {
    type: "concentrated",
    structure: "simple",
    L,
    target: "frame_M_left" as ProblemTarget,
    answer,
    choices,
    explanation,
    problemCategory: "frame" as ProblemCategory,
    frameL: L,
    frameH: h,
    frameHorizontalP: P,
    P: 0,
    a: 0,
    b: 0,
  };
}

/**
 * 静定ラーメン（3ヒンジ門形）問題を1問生成する。
 * 梁中央集中 P / 梁上等分布 w / 左柱水平 P を約 1/3 ずつ出題する。
 */
export function generateFrameProblem(): BeamProblem {
  const r = Math.random();
  if (r < 1 / 3) return generateFrameProblemHorizontal();
  if (r < 2 / 3) return generateFrameProblemConcentrated();
  return generateFrameProblemDistributed();
}
