import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AnswerLog,
  BeamProblem,
  BeamProblemConcentrated,
  BeamProblemDistributed,
  DiagnosticCategoryStats,
  DiagnosticReport,
  Difficulty,
  ProblemCategory,
  ProblemTarget,
} from "../types";
import { generateBucklingLength, generateBucklingLoad } from "./useBucklingProblem";
import { generateBendingStressProblem, generateSectionPropertiesProblem } from "./useSectionProblem";
import { generateFrameProblem } from "./useFrameProblem";
import {
  generateTrussCalculation,
  generateTrussCantilever,
  generateTrussPratt,
  generateTrussZero,
} from "./useTrussProblem";
import { generateDeflectionProblem } from "./useDeflectionProblem";

const L_VALUES = [4, 6, 8, 10] as const;
/** 単純梁・等分布では L=4 を禁止（反力 V=2w とモーメント M=2w が一致するため） */
const L_SIMPLE_DISTRIBUTED = [6, 8, 10] as const;
const L_CANTILEVER = [2, 3, 4, 5] as const;
/** 片持ち・等分布では L=2 を禁止（反力 V=2w とモーメント M=2w が一致するため） */
const L_CANTILEVER_DISTRIBUTED = [3, 4, 5] as const;
const P_VALUES = [10, 20, 24, 30, 40, 48, 50, 60, 72, 80, 90, 100] as const;
const W_VALUES = [10, 20, 30, 40, 50] as const;
export const ANSWER_TOLERANCE = 0.01;

const CANTILEVER_PROBABILITY = 0.25;

/**
 * 難易度ロードマップ
 * ----------------------------------------
 * 【初級】中央/自由端荷重、Z のみ、l_k、山形トラスのみ。
 * 【中級】偏心・b 隠し、I、座屈荷重比率、トラス全種。等分布で M_x/Q_x の出題あり。
 * 【上級】中級に加え以下を実装済み:
 *   - 梁: 張り出し梁×集中（V_A, V_B, |M_B|）。等分布は中級と同様に M_x/Q_x。
 *   - 断面: 中空長方形（ロの字）の I, Z を約50%で出題。
 *   - 曲げ応力度: 複合応力度 σ = N/A + M/Z を約50%で出題。
 * 【総合】初級30%・中級50%・上級20% でランダム（実装済み）。
 *
 * 今後の候補: ラーメン固定脚パターン、M図/Q図表示の拡張。静定ラーメン（3ヒンジ・集中P／梁上等分布w）は実装済み。
 */

/** 単純梁: target を 30% で Va/Vb、70% で M_max に設定 */
function pickTargetSimple(): ProblemTarget {
  const r = Math.random();
  if (r < 0.15) return "Va";
  if (r < 0.3) return "Vb";
  return "M_max";
}

/** 片持ち梁: M_max または Va のみ */
function pickTargetCantilever(): "M_max" | "Va" {
  return Math.random() < 0.5 ? "M_max" : "Va";
}

/** 片持ち梁・集中荷重の a 候補（固定端からの距離）。先端多め。 */
const A_CANTILEVER_BY_L: Record<number, number[]> = {
  2: [2],
  3: [2, 3],
  4: [2, 4],
  5: [2, 3, 4, 5],
};

/** L ごとの a の候補（左支点からの距離）。中央 a=b も含む。 */
const A_BY_L: Record<number, number[]> = {
  4: [2],
  6: [2, 3, 4],
  8: [2, 4, 6],
  10: [2, 4, 5, 6, 8],
};

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 小数第1位までで「きれいに」表せるかを判定（基礎〜中級の出題用） */
function isNiceOneDecimal(value: number): boolean {
  const rounded = roundToOneDecimal(value);
  return Math.abs(value - rounded) < 1e-6;
}

/** 集中荷重・M_max の誤答候補 */
function getConcentratedMWrong(
  L: number,
  P: number,
  a: number,
  b: number,
  answer: number
): number[] {
  const r = roundToOneDecimal;
  return [
    r((P * a * b) / 1),
    r((P * a) / L),
    r((P * b) / L),
    r((P * L) / 4),
    r((P * L) / 2),
    r((P * L) / 8),
    r(P * a),
    r(P * b),
    r(answer + 5),
    r(answer - 5),
    r(answer + 10),
    r(answer - 10),
    r(answer + 20),
    r(answer - 20),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 集中荷重・Va の誤答候補（Vb, P/2, M_max など） */
function getConcentratedVaWrong(
  L: number,
  P: number,
  a: number,
  b: number,
  answer: number
): number[] {
  const r = roundToOneDecimal;
  const Va = r((P * b) / L);
  const Vb = r((P * a) / L);
  const M = r((P * a * b) / L);
  return [
    Vb,
    r(P / 2),
    M,
    r(P),
    r(answer + 5),
    r(answer - 5),
    r(answer + 10),
    r(answer - 10),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 集中荷重・Vb の誤答候補 */
function getConcentratedVbWrong(
  L: number,
  P: number,
  a: number,
  b: number,
  answer: number
): number[] {
  const r = roundToOneDecimal;
  const Va = r((P * b) / L);
  const Vb = r((P * a) / L);
  const M = r((P * a * b) / L);
  return [
    Va,
    r(P / 2),
    M,
    r(P),
    r(answer + 5),
    r(answer - 5),
    r(answer + 10),
    r(answer - 10),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 等分布・M_max の誤答候補 */
function getDistributedMWrong(L: number, w: number, answer: number): number[] {
  const r = roundToOneDecimal;
  return [
    r((w * L * L) / 4),
    r((w * L * L) / 2),
    r((w * L) / 8),
    r(answer + 10),
    r(answer - 10),
    r(answer + 20),
    r(answer - 20),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 等分布・Va/Vb の誤答候補（全荷重 wL、モーメント混同など） */
function getDistributedVWrong(L: number, w: number, answer: number): number[] {
  const r = roundToOneDecimal;
  const wL = w * L;
  const M = r((w * L * L) / 8);
  return [
    r(wL),
    M,
    r(wL / 4),
    r(answer + 5),
    r(answer - 5),
    r(answer + 10),
    r(answer - 10),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 等分布・位置 x の曲げモーメント M(x)=w*x*(L-x)/2 の誤答候補 */
function getDistributedMxWrong(L: number, w: number, x: number, answer: number): number[] {
  const r = roundToOneDecimal;
  return [
    r((w * L * L) / 8),
    r((w * L * L) / 4),
    r((w * L) / 2),
    r(w * x),
    r(w * (L - x)),
    r(answer + 10),
    r(answer - 10),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 等分布・位置 x のせん断力 Q(x)=w*L/2-w*x の誤答候補（符号含む） */
function getDistributedQxWrong(L: number, w: number, x: number, answer: number): number[] {
  const r = roundToOneDecimal;
  const wL = w * L;
  const Mx = r((w * x * (L - x)) / 2);
  return [
    r(wL / 2),
    r(-wL / 2),
    Mx,
    r(w * x),
    r(answer + 5),
    r(answer - 5),
    -answer,
  ].filter((v) => v !== 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 片持ち等分布・位置 x の曲げモーメント |M(x)|=w*(L-x)²/2 の誤答候補 */
function getCantileverDistributedMxWrong(L: number, w: number, x: number, answer: number): number[] {
  const r = roundToOneDecimal;
  return [
    r((w * L * L) / 2),
    r((w * L * L) / 8),
    r(w * (L - x)),
    r(w * L),
    r(answer + 10),
    r(answer - 10),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

/** 片持ち等分布・位置 x のせん断力 Q(x)=w*(L-x) の誤答候補 */
function getCantileverDistributedQxWrong(L: number, w: number, x: number, answer: number): number[] {
  const r = roundToOneDecimal;
  const Mx = r((w * (L - x) * (L - x)) / 2);
  return [
    r(w * L),
    r((w * L) / 2),
    Mx,
    r(w * x),
    r(answer + 5),
    r(answer - 5),
  ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
}

function isValidWrong(value: number, answer: number): boolean {
  return value > 0 && Math.abs(value - answer) > ANSWER_TOLERANCE;
}

/** せん断力 Q_at_x など、正解が負になりうる場合用。v > 0 を要求しない。 */
function isValidWrongAllowNegative(value: number, answer: number): boolean {
  return Math.abs(value - answer) > ANSWER_TOLERANCE;
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

/** 優先誤答を先に使いつつ、3つ選ぶ。優先リストにない候補はランダムで補う。 */
function pickWrongChoicesWithPriority(
  priority: number[],
  otherCandidates: number[],
  answer: number,
  count: number
): number[] {
  const r = roundToOneDecimal;
  const chosenSet = new Set<number>();
  const chosen: number[] = [];

  // 1) 優先誤答リストを先に詰める（順序は優先度順）
  const priorityRounded = priority
    .map(r)
    .filter((v) => isValidWrong(v, answer));
  for (const v of priorityRounded) {
    if (chosen.length >= count) break;
    if (!chosenSet.has(v)) {
      chosenSet.add(v);
      chosen.push(v);
    }
  }

  // 2) それでも足りなければ、その他候補からランダムに補充
  const othersUnique = Array.from(new Set(otherCandidates)).filter(
    (v) => isValidWrong(v, answer) && !chosenSet.has(v)
  );
  while (chosen.length < count && othersUnique.length > 0) {
    const idx = Math.floor(Math.random() * othersUnique.length);
    const v = othersUnique.splice(idx, 1)[0];
    chosenSet.add(v);
    chosen.push(v);
  }

  // 3) まだ足りない場合のみ、fallback 候補（answer±10）を一巡して埋める
  if (chosen.length < count) {
    const fallbackCandidates = [
      r(answer + 10),
      r(answer - 10),
    ].filter((v) => isValidWrong(v, answer) && !chosenSet.has(v));

    for (const v of fallbackCandidates) {
      if (chosen.length >= count) break;
      if (!chosenSet.has(v)) {
        chosenSet.add(v);
        chosen.push(v);
      }
    }
  }

  // それでも足りない場合は、そのまま返す（3つ未満になることはほぼない）
  return chosen;
}

function pickWrongChoices(
  candidates: number[],
  answer: number,
  count: number
): number[] {
  return pickWrongChoicesWithPriority([], candidates, answer, count);
}

function generateConcentrated(difficulty?: Difficulty): BeamProblemConcentrated {
  // 「きれいな」値が出るまで数回リトライ
  for (let attempt = 0; attempt < 10; attempt++) {
  const L = L_VALUES[Math.floor(Math.random() * L_VALUES.length)];
  const aOptions = A_BY_L[L];
  const centerOptions = aOptions.filter((x) => x === L / 2);
  const eccentricOptions = aOptions.filter((x) => x !== L / 2);

  let a: number;
  if (difficulty === "beginner") {
    // 初級: 単純梁の集中荷重は必ず中央（a = L/2）。反力 P/2 の暗記で突破されないよう中級以上で偏心を出す。
    a = L / 2;
  } else if (difficulty === "intermediate" || difficulty === "advanced") {
    // 中級・上級: 必ず偏心 (a ≠ L/2)。Va = Pb/L, Vb = Pa/L, M_max = Pab/L の計算をさせる。
    const ecc = eccentricOptions.length > 0 ? eccentricOptions : centerOptions;
    a = ecc[Math.floor(Math.random() * ecc.length)];
  } else {
    // 従来どおり: 7割偏心, 3割中央
    a =
      eccentricOptions.length > 0 && (centerOptions.length === 0 || Math.random() > 0.3)
        ? eccentricOptions[Math.floor(Math.random() * eccentricOptions.length)]
        : centerOptions[Math.floor(Math.random() * centerOptions.length)];
  }
  const b = L - a;
  const P = P_VALUES[Math.floor(Math.random() * P_VALUES.length)];

  const target = pickTargetSimple();
  const r = roundToOneDecimal;
  let answer: number;
  let explanation: string;
  let wrongCandidates: number[] = [];
  let chosenWrong: number[] = [];

  if (target === "M_max") {
    answer = r((P * a * b) / L);
    const num = P * a * b;
    explanation = [
      "M_max = (P × a × b) / L",
      `= (${P} × ${a} × ${b}) / ${L}`,
      `= ${num} / ${L}`,
      `= ${answer} kN·m`,
    ].join("\n");
    const priority = [
      r((P * L) / 4),
      r((P * b) / L),
      r((P * a) / L),
      r(P),
    ];
    wrongCandidates = getConcentratedMWrong(L, P, a, b, answer);
    chosenWrong = pickWrongChoicesWithPriority(priority, wrongCandidates, answer, 3);
  } else if (target === "Va") {
    answer = r((P * b) / L);
    explanation = [
      "力の釣り合いにより、V_A = P × b / L",
      `= ${P} × ${b} / ${L}`,
      `= ${P * b} / ${L}`,
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = getConcentratedVaWrong(L, P, a, b, answer);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  } else {
    answer = r((P * a) / L);
    explanation = [
      "力の釣り合いにより、V_B = P × a / L",
      `= ${P} × ${a} / ${L}`,
      `= ${P * a} / ${L}`,
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = getConcentratedVbWrong(L, P, a, b, answer);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  }

  // 答えが小数第1位までで表現できる組み合わせのみ採用
  if (isNiceOneDecimal(
    target === "M_max" ? (P * a * b) / L :
    target === "Va" ? (P * b) / L :
    (P * a) / L
  )) {
    const choices = shuffle([answer, ...chosenWrong]);
    const hideDimensionB =
      difficulty === "intermediate" || difficulty === "advanced" ? true : undefined;
    return {
      type: "concentrated",
      structure: "simple",
      L,
      a,
      b,
      P,
      target,
      answer,
      choices,
      explanation,
      hideDimensionB,
    };
  }
  }
  // 10回試しても条件を満たさなければ最後の組をそのまま採用
  const L = L_VALUES[Math.floor(Math.random() * L_VALUES.length)];
  const aOptions = A_BY_L[L];
  const centerOptions = aOptions.filter((x) => x === L / 2);
  const eccentricOptions = aOptions.filter((x) => x !== L / 2);
  const a =
    eccentricOptions.length > 0 && (centerOptions.length === 0 || Math.random() > 0.3)
      ? eccentricOptions[Math.floor(Math.random() * eccentricOptions.length)]
      : centerOptions[Math.floor(Math.random() * centerOptions.length)];
  const b = L - a;
  const P = P_VALUES[Math.floor(Math.random() * P_VALUES.length)];
  const target = pickTargetSimple();
  const r = roundToOneDecimal;
  let answer: number;
  let explanation: string;
  let wrongCandidates: number[] = [];
  let chosenWrong: number[] = [];
  if (target === "M_max") {
    answer = r((P * a * b) / L);
    const num = P * a * b;
    explanation = [
      "M_max = (P × a × b) / L",
      `= (${P} × ${a} × ${b}) / ${L}`,
      `= ${num} / ${L}`,
      `= ${answer} kN·m`,
    ].join("\n");
    const priority = [
      r((P * L) / 4),
      r((P * b) / L),
      r((P * a) / L),
      r(P),
    ];
    wrongCandidates = getConcentratedMWrong(L, P, a, b, answer);
    chosenWrong = pickWrongChoicesWithPriority(priority, wrongCandidates, answer, 3);
  } else if (target === "Va") {
    answer = r((P * b) / L);
    explanation = [
      "力の釣り合いにより、V_A = P × b / L",
      `= ${P} × ${b} / ${L}`,
      `= ${P * b} / ${L}`,
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = getConcentratedVaWrong(L, P, a, b, answer);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  } else {
    answer = r((P * a) / L);
    explanation = [
      "力の釣り合いにより、V_B = P × a / L",
      `= ${P} × ${a} / ${L}`,
      `= ${P * a} / ${L}`,
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = getConcentratedVbWrong(L, P, a, b, answer);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  }
  const choices = shuffle([answer, ...chosenWrong]);
  return {
    type: "concentrated",
    structure: "simple",
    L,
    a,
    b,
    P,
    target,
    answer,
    choices,
    explanation,
  };
}

const X_RATIOS = [1 / 4, 1 / 2, 3 / 4] as const;

/** 単純梁・等分布荷重。中級以上では「支点Aから x m の M_x, Q_x」を出題する場合あり。 */
function generateDistributed(difficulty?: Difficulty): BeamProblemDistributed {
  const useAtX =
    (difficulty === "intermediate" || difficulty === "advanced") && Math.random() < 0.5;

  for (let attempt = 0; attempt < 10; attempt++) {
    const L = L_SIMPLE_DISTRIBUTED[Math.floor(Math.random() * L_SIMPLE_DISTRIBUTED.length)];
    const w = W_VALUES[Math.floor(Math.random() * W_VALUES.length)];
    const r = roundToOneDecimal;

    if (useAtX) {
      const ratio = X_RATIOS[Math.floor(Math.random() * X_RATIOS.length)];
      const x = r(L * ratio);
      const atTarget: "M_at_x" | "Q_at_x" = Math.random() < 0.5 ? "M_at_x" : "Q_at_x";
      if (atTarget === "M_at_x") {
        const raw = (w * x * (L - x)) / 2;
        if (!isNiceOneDecimal(raw)) continue;
        const answer = r(raw);
        const explanation = [
          "M(x) = w × x × (L − x) / 2",
          `= ${w} × ${x} × (${L} − ${x}) / 2`,
          `= ${w * x * (L - x)} / 2`,
          `= ${answer} kN·m`,
        ].join("\n");
        const wrongCandidates = getDistributedMxWrong(L, w, x, answer);
        const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
        const choices = shuffle([answer, ...chosenWrong]);
        return {
          type: "distributed",
          structure: "simple",
          L,
          w,
          target: "M_at_x",
          questionX: x,
          answer,
          choices,
          explanation,
        };
      } else {
        const raw = (w * L) / 2 - w * x;
        if (!isNiceOneDecimal(raw)) continue;
        const answer = r(raw);
        const explanation = [
          "Q(x) = V_A − w × x = w × L / 2 − w × x",
          `= ${w} × ${L} / 2 − ${w} × ${x}`,
          `= ${(w * L) / 2} − ${w * x}`,
          `= ${answer} kN`,
        ].join("\n");
        const wrongCandidates = getDistributedQxWrong(L, w, x, answer);
        const chosenWrong = pickWrongChoicesAllowNegative(wrongCandidates, answer, 3);
        const choices = shuffle([answer, ...chosenWrong]);
        return {
          type: "distributed",
          structure: "simple",
          L,
          w,
          target: "Q_at_x",
          questionX: x,
          answer,
          choices,
          explanation,
        };
      }
    }

    const target = pickTargetSimple();
    let answer: number;
    let explanation: string;
    let wrongCandidates: number[];
    let chosenWrong: number[];

    if (target === "M_max") {
      const raw = (w * L * L) / 8;
      if (!isNiceOneDecimal(raw)) continue;
      answer = r(raw);
      const wL2 = w * L * L;
      explanation = [
        "M_max = (w × L²) / 8",
        `= (${w} × ${L}²) / 8`,
        `= (${w} × ${L * L}) / 8`,
        `= ${wL2} / 8`,
        `= ${answer} kN·m`,
      ].join("\n");
      wrongCandidates = getDistributedMWrong(L, w, answer);
      const priority = [r((w * L * L) / 2), r((w * L * L) / 4), r((w * L) / 2)];
      chosenWrong = pickWrongChoicesWithPriority(priority, wrongCandidates, answer, 3);
    } else {
      const raw = (w * L) / 2;
      if (!isNiceOneDecimal(raw)) continue;
      answer = r(raw);
      explanation = [
        "等分布荷重では全荷重 w×L を左右で等分するため、",
        "V_A = V_B = w × L / 2",
        `= ${w} × ${L} / 2`,
        `= ${w * L} / 2`,
        `= ${answer} kN`,
      ].join("\n");
      wrongCandidates = getDistributedVWrong(L, w, answer);
      chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
    }

    const choices = shuffle([answer, ...chosenWrong]);
    return { type: "distributed", structure: "simple", L, w, target, answer, choices, explanation };
  }

  // fallback: 既存ロジック
  const L = L_SIMPLE_DISTRIBUTED[Math.floor(Math.random() * L_SIMPLE_DISTRIBUTED.length)];
  const w = W_VALUES[Math.floor(Math.random() * W_VALUES.length)];
  const target = pickTargetSimple();
  const r = roundToOneDecimal;
  let answer: number;
  let explanation: string;
  let wrongCandidates: number[];
  let chosenWrong: number[];
  if (target === "M_max") {
    answer = r((w * L * L) / 8);
    const wL2 = w * L * L;
    explanation = [
      "M_max = (w × L²) / 8",
      `= (${w} × ${L}²) / 8`,
      `= (${w} × ${L * L}) / 8`,
      `= ${wL2} / 8`,
      `= ${answer} kN·m`,
    ].join("\n");
    wrongCandidates = getDistributedMWrong(L, w, answer);
    const priority = [r((w * L * L) / 2), r((w * L * L) / 4), r((w * L) / 2)];
    chosenWrong = pickWrongChoicesWithPriority(priority, wrongCandidates, answer, 3);
  } else {
    answer = r((w * L) / 2);
    explanation = [
      "等分布荷重では全荷重 w×L を左右で等分するため、",
      "V_A = V_B = w × L / 2",
      `= ${w} × ${L} / 2`,
      `= ${w * L} / 2`,
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = getDistributedVWrong(L, w, answer);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  }
  const choices = shuffle([answer, ...chosenWrong]);
  return { type: "distributed", structure: "simple", L, w, target, answer, choices, explanation };
}

/** 片持ち梁・集中荷重: M_max = P*a（大きさ）, Va = P。a は固定端（壁）から荷重までの距離。 */
function generateCantileverConcentrated(difficulty?: Difficulty): BeamProblemConcentrated {
  const L = L_CANTILEVER[Math.floor(Math.random() * L_CANTILEVER.length)];
  const aOptions = A_CANTILEVER_BY_L[L];
  let a: number;
  if (difficulty === "beginner") {
    // 初級: 荷重は必ず自由端（a = L）
    a = L;
  } else {
    a = aOptions[Math.floor(Math.random() * aOptions.length)];
  }
  const b = L - a;
  const P = P_VALUES[Math.floor(Math.random() * P_VALUES.length)];

  const target = pickTargetCantilever();
  const r = roundToOneDecimal;
  let answer: number;
  let explanation: string;
  let wrongCandidates: number[];
  let chosenWrong: number[];

  if (target === "M_max") {
    answer = r(P * a);
    explanation = [
      "片持ち梁の固定端モーメントの大きさは、荷重 × 距離で求まります。",
      "|M_max| = P × a",
      `= ${P} × ${a}`,
      `= ${answer} kN·m`,
      "※片持ち梁の曲げモーメントは負値で表されることがありますが、本問では大きさ（絶対値）を問うているため正の値で答えます。",
    ].join("\n");
    wrongCandidates = [
      r(P * L),
      r(P / 2),
      r(P),
      r((P * a) / L),
      r(answer + 5),
      r(answer - 5),
      r(answer + 10),
      r(answer - 10),
    ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  } else {
    answer = r(P);
    explanation = [
      "片持ち梁の固定端の鉛直反力は、荷重と等しくなります。",
      "V_A = P",
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = [
      r(P * L), // モーメント M = P×L と混同した誤答
      r(P / 2), // 単純梁の反力 P/2 と混同した誤答
      r(P * a),
      r((P * a) / L),
      r(answer + 5),
      r(answer - 5),
      r(answer + 10),
    ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
    const priorityVa = [r(P * L), r(P / 2)];
    chosenWrong = pickWrongChoicesWithPriority(priorityVa, wrongCandidates, answer, 3);
  }

  const choices = shuffle([answer, ...chosenWrong]);

  return { type: "concentrated", structure: "cantilever", L, a, b, P, target, answer, choices, explanation };
}

/** 張り出し梁: 支点A-B 間 L、張り出し c。荷重は自由端（a=L+c）またはスパン内（a<L）。スパン内なら単純梁と同じ Va,Vb,M_max。 */
const L_OVERHANG = [4, 6, 8] as const;
const C_OVERHANG_BY_L: Record<number, number[]> = {
  4: [2, 3],
  6: [2, 3, 4],
  8: [2, 3, 4],
};
/** 張り出し梁でスパン内荷重のときの a 候補（支点Aから荷重までの距離） */
const A_OVERHANG_IN_SPAN_BY_L: Record<number, number[]> = {
  4: [2],
  6: [2, 3, 4],
  8: [2, 4, 6],
};

function generateOverhangConcentrated(): BeamProblemConcentrated {
  const L = L_OVERHANG[Math.floor(Math.random() * L_OVERHANG.length)];
  const cOptions = C_OVERHANG_BY_L[L].filter((c) => c < L);
  const c = cOptions[Math.floor(Math.random() * cOptions.length)];
  const P = P_VALUES[Math.floor(Math.random() * P_VALUES.length)];
  const r = roundToOneDecimal;

  const loadInSpan = Math.random() < 0.5 && A_OVERHANG_IN_SPAN_BY_L[L];
  let a: number;
  let Va: number;
  let Vb: number;
  let M_max: number;

  if (loadInSpan && A_OVERHANG_IN_SPAN_BY_L[L]) {
    const aOpts = A_OVERHANG_IN_SPAN_BY_L[L];
    a = aOpts[Math.floor(Math.random() * aOpts.length)];
    const bSpan = L - a;
    Va = (P * bSpan) / L;
    Vb = (P * a) / L;
    M_max = (P * a * bSpan) / L;
  } else {
    a = L + c;
    Va = (P * c) / L;
    Vb = (P * (L + c)) / L;
    M_max = P * c;
  }

  const target: "Va" | "Vb" | "M_max" =
    Math.random() < 1 / 3 ? "Va" : Math.random() < 0.5 ? "Vb" : "M_max";
  const answer =
    target === "Va" ? r(Va) : target === "Vb" ? r(Vb) : r(M_max);
  if (!isNiceOneDecimal(answer)) return generateOverhangConcentrated();

  let explanation: string;
  const wrongCandidates: number[] = [r(Va), r(Vb), r(M_max), r(P), r((P * L) / 4)].filter(
    (v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE
  );
  if (loadInSpan) {
    const bSpan = L - a;
    if (target === "Va") {
      explanation = [
        "張り出し梁で荷重がスパン内のとき、反力は単純梁と同じ式です。支点Bまわり: V_A × L = P × (L − a)",
        "V_A = P × (L − a) / L = P × b / L",
        `= ${P} × ${bSpan} / ${L} = ${answer} kN`,
      ].join("\n");
    } else if (target === "Vb") {
      explanation = [
        "張り出し梁で荷重がスパン内のとき、V_B = P × a / L（支点Aまわりの釣り合い）",
        `V_B = ${P} × ${a} / ${L} = ${answer} kN`,
      ].join("\n");
    } else {
      explanation = [
        "荷重がスパン内のとき、最大曲げモーメントは荷重点で M_max = P × a × b / L（単純梁と同じ）",
        `M_max = ${P} × ${a} × ${bSpan} / ${L} = ${answer} kN·m`,
      ].join("\n");
    }
  } else {
    if (target === "Va") {
      explanation = [
        "張り出し梁で支点Bまわりのモーメントの釣り合い: V_A × L = P × c",
        "V_A = P × c / L",
        `= ${P} × ${c} / ${L} = ${answer} kN`,
      ].join("\n");
    } else if (target === "Vb") {
      explanation = [
        "張り出し梁で支点Aまわりのモーメントの釣り合い: V_B × L = P × (L + c)",
        "V_B = P × (L + c) / L",
        `= ${P} × (${L} + ${c}) / ${L} = ${answer} kN`,
      ].join("\n");
    } else {
      explanation = [
        "支点Bの直下の曲げモーメントの大きさは、張り出し部の荷重による |M_B| = P × c です。",
        `|M_B| = ${P} × ${c} = ${answer} kN·m`,
      ].join("\n");
    }
  }

  const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  const choices = shuffle([answer, ...chosenWrong]);

  return {
    type: "concentrated",
    structure: "overhang",
    L,
    a,
    b: L - a,
    P,
    target,
    answer,
    choices,
    explanation,
    overhangLength: c,
    problemCategory: "overhang-concentrated",
  };
}

/** 張り出し梁・等分布荷重: 全長 L+c に w。Va = w(L²−c²)/(2L), Vb = w(L+c)²/(2L)。M_max はスパン内または支点Bの大きい方。 */
function generateOverhangDistributed(difficulty?: Difficulty): BeamProblemDistributed {
  const useAtX =
    (difficulty === "intermediate" || difficulty === "advanced") && Math.random() < 0.4;

  for (let attempt = 0; attempt < 15; attempt++) {
    const L = L_OVERHANG[Math.floor(Math.random() * L_OVERHANG.length)];
    const cOptions = C_OVERHANG_BY_L[L].filter((c) => c < L);
    if (cOptions.length === 0) continue;
    const c = cOptions[Math.floor(Math.random() * cOptions.length)];
    const w = W_VALUES[Math.floor(Math.random() * W_VALUES.length)];
    const r = roundToOneDecimal;

    const Va = (w * (L * L - c * c)) / (2 * L);
    const Vb = (w * (L + c) * (L + c)) / (2 * L);
    const M_span_max = (Va * Va) / (2 * w);
    const M_B = (w * c * c) / 2;
    const M_max = Math.max(M_span_max, M_B);

    if (useAtX) {
      const ratio = X_RATIOS[Math.floor(Math.random() * X_RATIOS.length)];
      const x = r(L * ratio);
      if (x <= 0 || x >= L) continue;
      const atTarget: "M_at_x" | "Q_at_x" = Math.random() < 0.5 ? "M_at_x" : "Q_at_x";
      if (atTarget === "M_at_x") {
        const raw = Va * x - (w * x * x) / 2;
        if (!isNiceOneDecimal(raw) || raw < 0) continue;
        const answer = r(raw);
        const explanation = [
          "張り出し梁の等分布で、スパン内の曲げモーメントは M(x) = V_A×x − w×x²/2 です。",
          `M(${x}) = ${Va} × ${x} − (${w} × ${x}²) / 2`,
          `= ${Va * x} − ${(w * x * x) / 2}`,
          `= ${answer} kN·m`,
        ].join("\n");
        const wrongCandidates = [
          r(Va * x),
          r((w * x * (L - x)) / 2),
          r(Vb * (L - x)),
          r(answer + 10),
          r(answer - 10),
        ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
        const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
        const choices = shuffle([answer, ...chosenWrong]);
        return {
          type: "distributed",
          structure: "overhang",
          L,
          w,
          target: "M_at_x",
          questionX: x,
          answer,
          choices,
          explanation,
          overhangLength: c,
          problemCategory: "overhang-distributed",
        };
      } else {
        const raw = Va - w * x;
        if (!isNiceOneDecimal(raw)) continue;
        const answer = r(raw);
        const explanation = [
          "スパン内のせん断力は Q(x) = V_A − w×x です。",
          `Q(${x}) = ${Va} − ${w} × ${x}`,
          `= ${answer} kN`,
        ].join("\n");
        const wrongCandidates = [
          r(Va),
          r(w * x),
          r((w * L) / 2 - w * x),
          r(answer + 5),
          r(answer - 5),
        ].filter((v) => Math.abs(v - answer) > ANSWER_TOLERANCE);
        const chosenWrong = pickWrongChoicesAllowNegative(wrongCandidates, answer, 3);
        const choices = shuffle([answer, ...chosenWrong]);
        return {
          type: "distributed",
          structure: "overhang",
          L,
          w,
          target: "Q_at_x",
          questionX: x,
          answer,
          choices,
          explanation,
          overhangLength: c,
          problemCategory: "overhang-distributed",
        };
      }
    }

    const target: "Va" | "Vb" | "M_max" =
      Math.random() < 1 / 3 ? "Va" : Math.random() < 0.5 ? "Vb" : "M_max";
    const answer =
      target === "Va" ? r(Va) : target === "Vb" ? r(Vb) : r(M_max);
    if (!isNiceOneDecimal(answer) || answer <= 0) continue;

    let explanation: string;
    if (target === "Va") {
      explanation = [
        "張り出し梁の等分布では、支点Bまわりのモーメントの釣り合いから V_A×L = w×(L+c)×((L+c)/2 − c) より、",
        "V_A = w×(L²−c²) / (2L)",
        `= ${w}×(${L}²−${c}²) / (2×${L})`,
        `= ${answer} kN`,
      ].join("\n");
    } else if (target === "Vb") {
      explanation = [
        "V_B = w×(L+c)² / (2L)（支点Aまわりのモーメントの釣り合いから）",
        `V_B = ${w}×(${L}+${c})² / (2×${L})`,
        `= ${answer} kN`,
      ].join("\n");
    } else {
      explanation = [
        "最大曲げモーメントは、スパン内の M_span = V_A²/(2w) と支点Bの |M_B| = w×c²/2 の大きい方です。",
        `M_span = ${Va}²/(2×${w}) = ${r(M_span_max)} kN·m, |M_B| = ${w}×${c}²/2 = ${r(M_B)} kN·m`,
        `よって M_max = ${answer} kN·m`,
      ].join("\n");
    }

    const wrongCandidates = [r(Va), r(Vb), r(M_max), r((w * (L + c)) / 2), r((w * L * L) / 8)].filter(
      (v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE
    );
    const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
    const choices = shuffle([answer, ...chosenWrong]);

    return {
      type: "distributed",
      structure: "overhang",
      L,
      w,
      target,
      answer,
      choices,
      explanation,
      overhangLength: c,
      problemCategory: "overhang-distributed",
    };
  }

  const L = L_OVERHANG[0];
  const c = C_OVERHANG_BY_L[L][0];
  const w = W_VALUES[0];
  const r = roundToOneDecimal;
  const Va = (w * (L * L - c * c)) / (2 * L);
  const Vb = (w * (L + c) * (L + c)) / (2 * L);
  const M_B = (w * c * c) / 2;
  const M_span_max = (Va * Va) / (2 * w);
  const M_max = r(Math.max(M_span_max, M_B));
  return {
    type: "distributed",
    structure: "overhang",
    L,
    w,
    target: "M_max",
    answer: M_max,
    choices: shuffle([M_max, r(Va), r(Vb), r(M_B)]),
    explanation: "張り出し梁の等分布で M_max はスパン内と支点Bの大きい方です。",
    overhangLength: c,
    problemCategory: "overhang-distributed",
  };
}

/** 片持ち梁・等分布荷重: M_max = w*L²/2, Va = w*L。中級以上では M_x, Q_x を出題する場合あり。 */
function generateCantileverDistributed(difficulty?: Difficulty): BeamProblemDistributed {
  const useAtX =
    (difficulty === "intermediate" || difficulty === "advanced") && Math.random() < 0.5;

  for (let attempt = 0; attempt < 10; attempt++) {
    const L = L_CANTILEVER_DISTRIBUTED[Math.floor(Math.random() * L_CANTILEVER_DISTRIBUTED.length)];
    const w = W_VALUES[Math.floor(Math.random() * W_VALUES.length)];
    const r = roundToOneDecimal;

    if (useAtX) {
      const ratio = X_RATIOS[Math.floor(Math.random() * X_RATIOS.length)];
      const x = r(L * ratio);
      const atTarget: "M_at_x" | "Q_at_x" = Math.random() < 0.5 ? "M_at_x" : "Q_at_x";
      if (atTarget === "M_at_x") {
        const raw = (w * (L - x) * (L - x)) / 2;
        if (!isNiceOneDecimal(raw)) continue;
        const answer = r(raw);
        const explanation = [
          "固定端から x の位置の曲げモーメントの大きさは |M(x)| = w × (L − x)² / 2 です。",
          "|M(x)| = (w × (L − x)²) / 2",
          `= (${w} × (${L} − ${x})²) / 2`,
          `= ${w * (L - x) * (L - x)} / 2`,
          `= ${answer} kN·m`,
        ].join("\n");
        const wrongCandidates = getCantileverDistributedMxWrong(L, w, x, answer);
        const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
        const choices = shuffle([answer, ...chosenWrong]);
        return {
          type: "distributed",
          structure: "cantilever",
          L,
          w,
          target: "M_at_x",
          questionX: x,
          answer,
          choices,
          explanation,
        };
      } else {
        const raw = w * (L - x);
        if (!isNiceOneDecimal(raw)) continue;
        const answer = r(raw);
        const explanation = [
          "固定端から x の位置のせん断力は、その位置から先の荷重と等しくなります。",
          "Q(x) = w × (L − x)",
          `= ${w} × (${L} − ${x})`,
          `= ${answer} kN`,
        ].join("\n");
        const wrongCandidates = getCantileverDistributedQxWrong(L, w, x, answer);
        const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
        const choices = shuffle([answer, ...chosenWrong]);
        return {
          type: "distributed",
          structure: "cantilever",
          L,
          w,
          target: "Q_at_x",
          questionX: x,
          answer,
          choices,
          explanation,
        };
      }
    }

    const target = pickTargetCantilever();
    let answer: number;
    let explanation: string;
    let wrongCandidates: number[];
    let chosenWrong: number[];

    if (target === "M_max") {
      const raw = (w * L * L) / 2;
      if (!isNiceOneDecimal(raw)) continue;
      answer = r(raw);
      const wL2 = w * L * L;
      explanation = [
        "等分布荷重の片持ち梁の固定端モーメントの大きさは |M| = w×L²/2 です。",
        "|M_max| = (w × L²) / 2",
        `= (${w} × ${L}²) / 2`,
        `= ${wL2} / 2`,
        `= ${answer} kN·m`,
        "※片持ち梁の曲げモーメントは負値で表されることがありますが、本問では大きさ（絶対値）を問うているため正の値で答えます。",
      ].join("\n");
      wrongCandidates = [
        r((w * L * L) / 8),
        r(w * L),
        r((w * L) / 2),
        r(answer + 5),
        r(answer - 5),
        r(answer + 10),
        r(answer - 10),
      ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
      const priority = [r((w * L * L) / 8), r(w * L), r((w * L) / 2)];
      chosenWrong = pickWrongChoicesWithPriority(priority, wrongCandidates, answer, 3);
    } else {
      const raw = w * L;
      if (!isNiceOneDecimal(raw)) continue;
      answer = r(raw);
      explanation = [
        "等分布荷重の片持ち梁では、固定端反力は全荷重と等しくなります。",
        "V_A = w × L",
        `= ${w} × ${L}`,
        `= ${answer} kN`,
      ].join("\n");
      wrongCandidates = [
        r((w * L) / 2),
        r((w * L * L) / 2),
        r((w * L * L) / 8),
        r(answer + 5),
        r(answer - 5),
        r(answer + 10),
      ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
      chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
    }

    const choices = shuffle([answer, ...chosenWrong]);
    return { type: "distributed", structure: "cantilever", L, w, target, answer, choices, explanation };
  }

  // fallback
  const L = L_CANTILEVER_DISTRIBUTED[Math.floor(Math.random() * L_CANTILEVER_DISTRIBUTED.length)];
  const w = W_VALUES[Math.floor(Math.random() * W_VALUES.length)];
  const target = pickTargetCantilever();
  const r = roundToOneDecimal;
  let answer: number;
  let explanation: string;
  let wrongCandidates: number[];
  let chosenWrong: number[];
  if (target === "M_max") {
    answer = r((w * L * L) / 2);
    const wL2 = w * L * L;
    explanation = [
      "等分布荷重の片持ち梁の固定端モーメントの大きさは |M| = w×L²/2 です。",
      "|M_max| = (w × L²) / 2",
      `= (${w} × ${L}²) / 2`,
      `= ${wL2} / 2`,
      `= ${answer} kN·m`,
      "※片持ち梁の曲げモーメントは負値で表されることがありますが、本問では大きさ（絶対値）を問うているため正の値で答えます。",
    ].join("\n");
    wrongCandidates = [
      r((w * L * L) / 8),
      r(w * L),
      r((w * L) / 2),
      r(answer + 5),
      r(answer - 5),
      r(answer + 10),
      r(answer - 10),
    ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
    const priority = [r((w * L * L) / 8), r(w * L), r((w * L) / 2)];
    chosenWrong = pickWrongChoicesWithPriority(priority, wrongCandidates, answer, 3);
  } else {
    answer = r(w * L);
    explanation = [
      "等分布荷重の片持ち梁では、固定端反力は全荷重と等しくなります。",
      "V_A = w × L",
      `= ${w} × ${L}`,
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = [
      r((w * L) / 2),
      r((w * L * L) / 2),
      r((w * L * L) / 8),
      r(answer + 5),
      r(answer - 5),
      r(answer + 10),
    ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
    chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  }
  const choices = shuffle([answer, ...chosenWrong]);
  return { type: "distributed", structure: "cantilever", L, w, target, answer, choices, explanation };
}

/** 問題のカテゴリキーを一意に決める */
function getCategoryFromProblem(problem: BeamProblem): ProblemCategory {
  if (problem.problemCategory) {
    return problem.problemCategory;
  }
  if (problem.structure === "overhang")
    return problem.type === "distributed" ? "overhang-distributed" : "overhang-concentrated";
  const prefix = problem.structure === "cantilever" ? "cantilever" : "simple";
  const type =
    problem.type === "concentrated" ? "concentrated" : "distributed";
  return `${prefix}-${type}` as ProblemCategory;
}

/** 苦手克服など全モードで使うカテゴリ一覧（梁 + 断面 + 座屈 + トラス + 静定ラーメン） */
const ALL_CATEGORIES: ProblemCategory[] = [
  "simple-concentrated",
  "simple-distributed",
  "cantilever-concentrated",
  "cantilever-distributed",
  "overhang-concentrated",
  "overhang-distributed",
  "section-properties",
  "bending-stress",
  "buckling",
  "truss-zero",
  "truss-calculation",
  "frame",
  "deflection",
];

/** 診断モードで使用するカテゴリ（全カテゴリで実力診断） */
const DIAGNOSTIC_CATEGORIES: ProblemCategory[] = [
  "simple-concentrated",
  "simple-distributed",
  "cantilever-concentrated",
  "cantilever-distributed",
  "overhang-concentrated",
  "overhang-distributed",
  "section-properties",
  "bending-stress",
  "buckling",
  "truss-zero",
  "truss-calculation",
  "frame",
  "deflection",
];

/** 診断モードでの出題難易度（全カテゴリで中級を基準に実力判定） */
const DIAGNOSTIC_DIFFICULTY: Difficulty = "intermediate";

type CategoryStats = {
  total: number;
  correct: number;
  accuracy: number;
};

const HISTORY_STORAGE_KEY = "@beam-drill/history";
const DIAGNOSTIC_REPORTS_STORAGE_KEY = "@beam-drill/diagnosticReports";

type Mode = "normal" | "diagnostic";
type QuestionSource = "normal" | "diagnostic";

type SessionProgress = {
  answeredCount: number;
  targetCount: number | null;
  isCompleted: boolean;
};

export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  "simple-concentrated": "単純梁×集中荷重",
  "simple-distributed": "単純梁×等分布荷重",
  "cantilever-concentrated": "片持ち梁×集中荷重",
  "cantilever-distributed": "片持ち梁×等分布荷重",
  "overhang-concentrated": "張り出し梁×集中荷重",
  "overhang-distributed": "張り出し梁×等分布荷重",
  "section-properties": "断面の性質（Z, I）",
  "bending-stress": "曲げ応力度",
  "buckling": "座屈",
  "truss-zero": "トラス（ゼロメンバー）",
  "truss-calculation": "トラス（軸力計算）",
  "frame": "静定ラーメン",
  "deflection": "たわみ・たわみ角",
};

export { ALL_CATEGORIES };

function pickDiagnosticCategory(logs: AnswerLog[]): ProblemCategory {
  const answered = new Set<ProblemCategory>(logs.map((l) => l.category));
  const remaining = DIAGNOSTIC_CATEGORIES.filter((c) => !answered.has(c));
  if (remaining.length > 0) {
    return remaining[Math.floor(Math.random() * remaining.length)];
  }
  return DIAGNOSTIC_CATEGORIES[Math.floor(Math.random() * DIAGNOSTIC_CATEGORIES.length)];
}

function buildDiagnosticReport(
  logs: AnswerLog[],
  sessionId: string
): DiagnosticReport {
  const base: Record<ProblemCategory, DiagnosticCategoryStats> = {
    "simple-concentrated": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "simple-distributed": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "cantilever-concentrated": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "cantilever-distributed": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "overhang-concentrated": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "overhang-distributed": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "section-properties": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "bending-stress": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "buckling": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "truss-zero": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "truss-calculation": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "frame": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
    "deflection": { total: 0, correct: 0, accuracy: 0, avgDurationMs: null },
  };

  const perCategoryDuration: Record<ProblemCategory, { sum: number; count: number }> = {
    "simple-concentrated": { sum: 0, count: 0 },
    "simple-distributed": { sum: 0, count: 0 },
    "cantilever-concentrated": { sum: 0, count: 0 },
    "cantilever-distributed": { sum: 0, count: 0 },
    "overhang-concentrated": { sum: 0, count: 0 },
    "overhang-distributed": { sum: 0, count: 0 },
    "section-properties": { sum: 0, count: 0 },
    "bending-stress": { sum: 0, count: 0 },
    "buckling": { sum: 0, count: 0 },
    "truss-zero": { sum: 0, count: 0 },
    "truss-calculation": { sum: 0, count: 0 },
    "frame": { sum: 0, count: 0 },
    "deflection": { sum: 0, count: 0 },
  };

  let totalDurationSum = 0;
  let totalDurationCount = 0;
  let totalCorrect = 0;

  logs.forEach((log) => {
    const stats = base[log.category];
    stats.total += 1;
    if (log.isCorrect) {
      stats.correct += 1;
      totalCorrect += 1;
    }
    if (typeof log.durationMs === "number") {
      totalDurationSum += log.durationMs;
      totalDurationCount += 1;
      const bucket = perCategoryDuration[log.category];
      bucket.sum += log.durationMs;
      bucket.count += 1;
    }
  });

  (Object.keys(base) as ProblemCategory[]).forEach((key) => {
    const s = base[key];
    s.accuracy = s.total > 0 ? s.correct / s.total : 0;

    const bucket = perCategoryDuration[key];
    if (bucket.count > 0) {
      s.avgDurationMs = bucket.sum / bucket.count;
    } else {
      s.avgDurationMs = null;
    }
  });

  const totalQuestions = logs.length;
  const overallAccuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
  const overallAvgDurationMs =
    totalDurationCount > 0 ? totalDurationSum / totalDurationCount : null;

  const weakCategories = (Object.keys(base) as ProblemCategory[]).filter((key) => {
    const s = base[key];
    return s.total === 0 || s.accuracy < 0.6;
  });

  let recommendation: string;
  if (totalQuestions === 0) {
    recommendation =
      "診断セッションで問題が解かれていません。もう一度診断を実行してください。";
  } else if (weakCategories.length === 0) {
    recommendation =
      "全てのカテゴリで正答率が 60% 以上です。この調子で演習を継続してください。";
  } else {
    const lines: string[] = [];
    const list = weakCategories.map((c) => CATEGORY_LABELS[c]).join("、");
    lines.push(
      `次のカテゴリで正答率が低い、もしくは未出題です: ${list}`
    );
    lines.push("それぞれで起こりがちなミスの例と、重点的に確認すべきポイントは次の通りです。");

    weakCategories.forEach((cat) => {
      const stats = base[cat];
      const accPercent = Math.round(stats.accuracy * 100);
      switch (cat) {
        case "simple-concentrated":
          lines.push(
            `・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: P×a×b/L と P×a や P×b を取り違えるミス、` +
            "Va, Vb との混同（M_max と反力の区別）が多いパターンです。支点反力の求め方（ΣM=0, ΣV=0）と、" +
            "最大曲げモーメントの位置・式 M_max = P×a×b/L を式レベルで書けるように復習してください。"
          );
          break;
        case "simple-distributed":
          lines.push(
            `・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: 反力 V = wL/2 と曲げモーメント M_max = wL²/8 を混同するミス、` +
            "全荷重 wL の扱い方を誤るミスが典型です。まず「等分布荷重の合力は wL」「その作用位置は中央 L/2」" +
            "という2点を整理し、そこから反力と M_max の式を自力で導けるか確認してください。"
          );
          break;
        case "cantilever-concentrated":
          lines.push(
            `・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: 片持ち梁の固定端モーメント |M_max| = P×a を、` +
            "単純梁と同じ式や P×L と混同するミスが多いです。また、符号ではなく「大きさ（絶対値）」を問われている点を" +
            "見落としている可能性もあります。固定端まわりのモーメントの釣り合いと、a の定義（固定端から荷重までの距離）を" +
            "図に書き込みながら確認してください。"
          );
          break;
        case "cantilever-distributed":
          lines.push(
            `・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: 片持ち梁の等分布荷重で、反力 V_A = wL と` +
            "モーメント |M_max| = wL²/2 のどちらか一方、あるいは両方を誤っている可能性があります。" +
            "合力 wL とその作用位置 L/2 を押さえた上で、固定端まわりのモーメントを式から丁寧に追ってください。"
          );
          break;
        case "overhang-concentrated":
          lines.push(
            `・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: 張り出し梁では V_A = P×c/L、V_B = P×(L+c)/L、` +
            "|M_B| = P×c です。単純梁の M_max = P×a×b/L や片持ちの式と混同しやすいので、" +
            "支点Bまわりのモーメントの釣り合い（V_A×L = P×c）と支点Aまわりの釣り合いから式を立て直してください。"
          );
          break;
        case "frame":
          lines.push(
            `・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: 3ヒンジラーメンでは、集中荷重 P のとき M = P×L/4、` +
            "等分布 w のとき M = w×L²/8（左柱頭）。柱脚まわりのモーメントのつり合いから H を求めてください。"
          );
          break;
        default:
          lines.push(`・${CATEGORY_LABELS[cat]}（正答率 ${accPercent}%）: 同カテゴリを苦手克服モードで集中的に解いてください。`);
          break;
      }
    });

    lines.push(
      "これらのパターンについて、まずはノートに力の釣り合い・モーメントの釣り合いの式を自分で立て直してから、" +
      "通常モードや苦手克服モードで同種の問題を集中的に解いてください。"
    );

    recommendation = lines.join("\n");
  }

  return {
    sessionId,
    createdAt: Date.now(),
    totalQuestions,
    overallAccuracy,
    overallAvgDurationMs,
    statsByCategory: base,
    weakCategories,
    recommendation,
  };
}

export function useBeamProblem() {
  const [problem, setProblem] = useState<BeamProblem | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<AnswerLog[]>([]);
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>("mixed");
  const [pinnedCategory, setPinnedCategory] = useState<ProblemCategory | null>(null);
  const [isWeakMode, setIsWeakMode] = useState(false);
  const [mode, setMode] = useState<Mode>("normal");
  const [currentSource, setCurrentSource] = useState<QuestionSource>("normal");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTargetCount, setSessionTargetCount] = useState<number | null>(null);
  const [sessionAnswerLogs, setSessionAnswerLogs] = useState<AnswerLog[]>([]);
  const [currentQuestionStartTs, setCurrentQuestionStartTs] = useState<number | null>(null);
  const [lastDiagnosticReport, setLastDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [diagnosticReports, setDiagnosticReports] = useState<DiagnosticReport[]>([]);

  // 履歴ロード
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (!json) return;
        const parsed = JSON.parse(json) as AnswerLog[];
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      } catch (e) {
        console.warn("Failed to load history", e);
      }
    })();
  }, []);

  // 診断レポートロード
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(DIAGNOSTIC_REPORTS_STORAGE_KEY);
        if (!json) return;
        const parsed = JSON.parse(json) as DiagnosticReport[];
        if (Array.isArray(parsed)) {
          setDiagnosticReports(parsed);
          if (parsed.length > 0) {
            setLastDiagnosticReport(parsed[0]);
          }
        }
      } catch (e) {
        console.warn("Failed to load diagnostic reports", e);
      }
    })();
  }, []);

  // 履歴保存
  const saveHistory = useCallback(async (logs: AnswerLog[]) => {
    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn("Failed to save history", e);
    }
  }, []);

  // 診断レポート保存
  const saveDiagnosticReports = useCallback(async (reports: DiagnosticReport[]) => {
    try {
      await AsyncStorage.setItem(
        DIAGNOSTIC_REPORTS_STORAGE_KEY,
        JSON.stringify(reports)
      );
    } catch (e) {
      console.warn("Failed to save diagnostic reports", e);
    }
  }, []);

  // カテゴリ別統計
  const stats: Record<ProblemCategory, CategoryStats> = useMemo(() => {
    const base: Record<ProblemCategory, CategoryStats> = {
      "simple-concentrated": { total: 0, correct: 0, accuracy: 0 },
      "simple-distributed": { total: 0, correct: 0, accuracy: 0 },
      "cantilever-concentrated": { total: 0, correct: 0, accuracy: 0 },
      "cantilever-distributed": { total: 0, correct: 0, accuracy: 0 },
      "overhang-concentrated": { total: 0, correct: 0, accuracy: 0 },
      "overhang-distributed": { total: 0, correct: 0, accuracy: 0 },
      "section-properties": { total: 0, correct: 0, accuracy: 0 },
      "bending-stress": { total: 0, correct: 0, accuracy: 0 },
      "buckling": { total: 0, correct: 0, accuracy: 0 },
      "truss-zero": { total: 0, correct: 0, accuracy: 0 },
      "truss-calculation": { total: 0, correct: 0, accuracy: 0 },
      "frame": { total: 0, correct: 0, accuracy: 0 },
      "deflection": { total: 0, correct: 0, accuracy: 0 },
    };
    const filtered = history.filter((log) => {
      if (!log.difficulty) {
        // 旧データ: mixed のときのみ集計対象にする
        return currentDifficulty === "mixed";
      }
      if (currentDifficulty === "mixed") return true;
      return log.difficulty === currentDifficulty;
    });
    filtered.forEach((log) => {
      const s = base[log.category];
      s.total += 1;
      if (log.isCorrect) s.correct += 1;
    });
    (Object.keys(base) as ProblemCategory[]).forEach((key) => {
      const s = base[key];
      s.accuracy = s.total > 0 ? s.correct / s.total : 0;
    });
    return base;
  }, [history, currentDifficulty]);

  const toggleWeakMode = useCallback(() => {
    setIsWeakMode((prev) => {
      if (mode === "diagnostic") {
        // 診断モード中は苦手克服モードの切り替えを無効化
        return prev;
      }
      return !prev;
    });
  }, [mode]);

  const resetWeakModeData = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, [saveHistory]);

  const sessionProgress: SessionProgress = useMemo(() => {
    const answeredCount = sessionAnswerLogs.length;
    const target = sessionTargetCount;
    const isCompleted = target != null && answeredCount >= target;
    return {
      answeredCount,
      targetCount: target,
      isCompleted,
    };
  }, [sessionAnswerLogs.length, sessionTargetCount]);

  // 通常ランダム出題（難易度付き）
  // 総合モード: 初級30%・中級50%・上級20% で実力判定。上級を除外しない。
  const generateRandomProblem = useCallback(
    (difficulty: Difficulty): BeamProblem => {
      const effectiveDifficulty: Difficulty =
        difficulty === "mixed"
          ? (() => {
              const r = Math.random();
              if (r < 0.3) return "beginner";
              if (r < 0.8) return "intermediate";
              return "advanced";
            })()
          : difficulty;

      // 難易度ごとに断面・座屈・トラス問題を混ぜる
      if (effectiveDifficulty === "beginner") {
        const r = Math.random();
        if (r < 0.12) return generateSectionPropertiesProblem(effectiveDifficulty);
        if (r < 0.24) return generateBucklingLength(effectiveDifficulty);
        if (r < 0.36) return generateTrussZero(effectiveDifficulty);
      } else if (
        effectiveDifficulty === "intermediate" ||
        effectiveDifficulty === "advanced"
      ) {
        const r = Math.random();
        if (r < 0.12) return generateSectionPropertiesProblem(effectiveDifficulty);
        if (r < 0.24) return generateBendingStressProblem(effectiveDifficulty);
        if (r < 0.36) return generateBucklingLoad(effectiveDifficulty);
        if (r < 0.42) return generateTrussCalculation(effectiveDifficulty);
        if (r < 0.46) return generateTrussCantilever(effectiveDifficulty);
        if (r < 0.48) return generateTrussPratt(effectiveDifficulty);
        if (r < 0.50) return generateDeflectionProblem(effectiveDifficulty);
        if (effectiveDifficulty === "advanced" && r < 0.56) {
          const q = Math.random();
          if (q < 0.33) return generateOverhangConcentrated();
          if (q < 0.66) return generateOverhangDistributed(effectiveDifficulty);
          return generateFrameProblem();
        }
      }

      // 残りは梁問題（単純梁・片持ち・張り出しの集中/等分布）
      const isCantilever = Math.random() < CANTILEVER_PROBABILITY;
      if (isCantilever) {
        return Math.random() < 0.5
          ? generateCantileverConcentrated(effectiveDifficulty)
          : generateCantileverDistributed(effectiveDifficulty);
      }
      const isDistributedProblem = Math.random() < 0.5;
      return isDistributedProblem
        ? generateDistributed(effectiveDifficulty)
        : generateConcentrated(effectiveDifficulty);
    },
    []
  );

  // 苦手克服モード用カテゴリ選択
  const pickCategoryByWeakness = useCallback((): ProblemCategory => {
    // 未回答: 2.0, 正答率<50%: 1.5, それ以外: 0.5
    const weights = ALL_CATEGORIES.map((cat) => {
      const s = stats[cat];
      if (s.total === 0) return 2.0;
      if (s.accuracy < 0.5) return 1.5;
      return 0.5;
    });
    const sum = weights.reduce((acc, w) => acc + w, 0);
    if (sum <= 0) {
      return ALL_CATEGORIES[
        Math.floor(Math.random() * ALL_CATEGORIES.length)
      ];
    }
    let r = Math.random() * sum;
    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        return ALL_CATEGORIES[i];
      }
    }
    return ALL_CATEGORIES[ALL_CATEGORIES.length - 1];
  }, [stats]);

  const generateProblemByCategory = useCallback(
    (cat: ProblemCategory, difficulty?: Difficulty): BeamProblem => {
      switch (cat) {
        case "simple-concentrated":
          return generateConcentrated(difficulty);
        case "simple-distributed":
          return generateDistributed(difficulty);
        case "cantilever-concentrated":
          return generateCantileverConcentrated(difficulty);
        case "cantilever-distributed":
          return generateCantileverDistributed(difficulty);
        case "overhang-concentrated":
          return generateOverhangConcentrated();
        case "overhang-distributed":
          return generateOverhangDistributed(difficulty);
        case "section-properties":
          return generateSectionPropertiesProblem(
            difficulty ?? "intermediate"
          );
        case "bending-stress":
          return generateBendingStressProblem(difficulty ?? "intermediate");
        case "buckling": {
          const eff = difficulty ?? "intermediate";
          if (eff === "beginner") return generateBucklingLength(eff);
          if (eff === "intermediate" || eff === "advanced")
            return generateBucklingLoad(eff);
          return Math.random() < 0.5
            ? generateBucklingLength("beginner")
            : generateBucklingLoad("intermediate");
        }
        case "truss-zero":
          return generateTrussZero(difficulty ?? "beginner");
        case "truss-calculation": {
          const d = difficulty ?? "intermediate";
          if (d === "beginner")
            return generateTrussCalculation("beginner");
          const r = Math.random();
          if (r < 1 / 3) return generateTrussCalculation(d);
          if (r < 2 / 3) return generateTrussCantilever(d);
          return generateTrussPratt(d);
        }
        case "frame":
          return generateFrameProblem();
        case "deflection":
          return generateDeflectionProblem(difficulty);
      }
    },
    []
  );

  const generateProblem = useCallback(() => {
    let next: BeamProblem;
    if (mode === "diagnostic") {
      const cat = pickDiagnosticCategory(sessionAnswerLogs);
      next = generateProblemByCategory(cat, DIAGNOSTIC_DIFFICULTY);
      setCurrentSource("diagnostic");
    } else if (pinnedCategory != null) {
      next = generateProblemByCategory(pinnedCategory, currentDifficulty);
      setCurrentSource("normal");
    } else if (isWeakMode) {
      const cat = pickCategoryByWeakness();
      next = generateProblemByCategory(cat, currentDifficulty);
      setCurrentSource("normal");
    } else {
      next = generateRandomProblem(currentDifficulty);
      setCurrentSource("normal");
    }
    setProblem(next);
    setIsCorrect(null);
    setCurrentQuestionStartTs(Date.now());
  }, [
    currentDifficulty,
    generateRandomProblem,
    generateProblemByCategory,
    isWeakMode,
    mode,
    pickCategoryByWeakness,
    pinnedCategory,
    sessionAnswerLogs,
  ]);

  // 難易度変更時: 診断モード以外ではスコアをリセットし、その難易度の新しい問題を出す
  const prevDifficultyRef = useRef<Difficulty>(currentDifficulty);
  useEffect(() => {
    if (prevDifficultyRef.current !== currentDifficulty && mode !== "diagnostic") {
      setScore(0);
      generateProblem();
    }
    prevDifficultyRef.current = currentDifficulty;
  }, [currentDifficulty, generateProblem, mode]);

  // 固定カテゴリ変更時: 即座にそのカテゴリの問題を1問出す（デバッグ・練習用）
  const prevPinnedRef = useRef<ProblemCategory | null>(pinnedCategory);
  useEffect(() => {
    if (prevPinnedRef.current !== pinnedCategory && mode !== "diagnostic") {
      generateProblem();
    }
    prevPinnedRef.current = pinnedCategory;
  }, [pinnedCategory, generateProblem, mode]);

  const startDiagnosticSession = useCallback((targetCount: number) => {
    const newSessionId = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMode("diagnostic");
    setSessionId(newSessionId);
    setSessionTargetCount(targetCount);
    setSessionAnswerLogs([]);
    setLastDiagnosticReport(null);

    // 初回問題はここで明示的に生成（モード反映のタイミングに依存しない）
    const firstCategory = pickDiagnosticCategory([]);
    const firstProblem = generateProblemByCategory(firstCategory, DIAGNOSTIC_DIFFICULTY);
    setProblem(firstProblem);
    setIsCorrect(null);
    setCurrentSource("diagnostic");
    setCurrentQuestionStartTs(Date.now());
  }, [generateProblemByCategory]);

  const enterNormalMode = useCallback(() => {
    setMode("normal");
  }, []);

  const enterDiagnosticMode = useCallback(() => {
    // 既に開始済みの診断セッションを再開する用途（完了済みセッションは再開しない）
    const isCompleted = sessionTargetCount != null && sessionAnswerLogs.length >= sessionTargetCount;
    if (sessionId && !isCompleted) {
      setMode("diagnostic");
    }
  }, [sessionAnswerLogs.length, sessionId, sessionTargetCount]);

  const resetDiagnosticSession = useCallback(() => {
    setMode("normal");
    setSessionId(null);
    setSessionTargetCount(null);
    setSessionAnswerLogs([]);
    setLastDiagnosticReport(null);
  }, []);

  const checkAnswer = useCallback(
    (selectedAnswer: number) => {
      if (problem === null) return;
      const now = Date.now();
      const correct =
        Math.abs(selectedAnswer - problem.answer) < ANSWER_TOLERANCE;
      setIsCorrect(correct);
      setScore((prev) => (correct ? prev + 1 : 0));

      const category = getCategoryFromProblem(problem);
      const newLog: AnswerLog = {
        timestamp: now,
        category,
        isCorrect: correct,
        difficulty: currentDifficulty,
      };
      if (currentQuestionStartTs != null) {
        newLog.durationMs = now - currentQuestionStartTs;
      }
      if (currentSource === "diagnostic" && sessionId) {
        newLog.sessionId = sessionId;
      }

      // 苦手克服モード用データは、苦手克服モードが ON のときのみ収集する
      if (isWeakMode) {
        setHistory((prev) => {
          const updated = [...prev, newLog];
          saveHistory(updated);
          return updated;
        });
      }

      if (currentSource === "diagnostic" && sessionId) {
        setSessionAnswerLogs((prev) => {
          const updated = [...prev, newLog];
          if (sessionTargetCount != null && updated.length >= sessionTargetCount) {
            const report = buildDiagnosticReport(updated, sessionId);
            setLastDiagnosticReport(report);
            setDiagnosticReports((prevReports) => {
              const next = [report, ...prevReports];
              saveDiagnosticReports(next);
              return next;
            });
            // 回答し終えたので診断モードは一旦終了（画面側でレポート表示へ誘導）
            setMode("normal");
          }
          return updated;
        });
      }
    },
    [
      currentDifficulty,
      currentQuestionStartTs,
      currentSource,
      isWeakMode,
      problem,
      saveHistory,
      saveDiagnosticReports,
      sessionId,
      sessionTargetCount,
    ]
  );

  const goToNext = useCallback(() => {
    // 診断モード中は、未回答で「次へ」を禁止
    if (mode === "diagnostic" && isCorrect === null) {
      return;
    }
    generateProblem();
  }, [generateProblem, isCorrect, mode]);

  return {
    problem,
    isCorrect,
    score,
    generateProblem,
    checkAnswer,
    goToNext,
    history,
    stats,
    isWeakMode,
    toggleWeakMode,
    resetWeakModeData,
    currentDifficulty,
    setCurrentDifficulty,
    pinnedCategory,
    setPinnedCategory,
    mode,
    startDiagnosticSession,
    enterNormalMode,
    enterDiagnosticMode,
    resetDiagnosticSession,
    sessionProgress,
    lastDiagnosticReport,
    diagnosticReports,
  };
}
