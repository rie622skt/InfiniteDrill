import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AnswerLog,
  BeamProblem,
  BeamProblemConcentrated,
  BeamProblemDistributed,
  DiagnosticCategoryStats,
  DiagnosticReport,
  ProblemCategory,
  ProblemTarget,
} from "../types";

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

function isValidWrong(value: number, answer: number): boolean {
  return value > 0 && Math.abs(value - answer) > ANSWER_TOLERANCE;
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

function generateConcentrated(): BeamProblemConcentrated {
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
  return { type: "concentrated", structure: "simple", L, a, b, P, target, answer, choices, explanation };
}

function generateDistributed(): BeamProblemDistributed {
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
function generateCantileverConcentrated(): BeamProblemConcentrated {
  const L = L_CANTILEVER[Math.floor(Math.random() * L_CANTILEVER.length)];
  const aOptions = A_CANTILEVER_BY_L[L];
  const a = aOptions[Math.floor(Math.random() * aOptions.length)];
  const b = L - a;
  const P = P_VALUES[Math.floor(Math.random() * P_VALUES.length)];

  const target = pickTargetCantilever();
  const r = roundToOneDecimal;
  let answer: number;
  let explanation: string;
  let wrongCandidates: number[];

  if (target === "M_max") {
    answer = r(P * a);
    explanation = [
      "片持ち梁の固定端モーメントの大きさは、荷重 × 距離で求まります。",
      "|M_max| = P × a",
      `= ${P} × ${a}`,
      `= ${answer} kN·m`,
      "※片持ち梁では上側引張りのため符号は負ですが、本問では大きさを問うているため正の値で表しています。",
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
  } else {
    answer = r(P);
    explanation = [
      "片持ち梁の固定端の鉛直反力は、荷重と等しくなります。",
      "V_A = P",
      `= ${answer} kN`,
    ].join("\n");
    wrongCandidates = [
      r(P / 2),
      r(P * a),
      r((P * a) / L),
      r(answer + 5),
      r(answer - 5),
      r(answer + 10),
    ].filter((v) => v > 0 && Math.abs(v - answer) > ANSWER_TOLERANCE);
  }

  const chosenWrong = pickWrongChoices(wrongCandidates, answer, 3);
  const choices = shuffle([answer, ...chosenWrong]);

  return { type: "concentrated", structure: "cantilever", L, a, b, P, target, answer, choices, explanation };
}

/** 片持ち梁・等分布荷重: M_max = w*L²/2, Va = w*L */
function generateCantileverDistributed(): BeamProblemDistributed {
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
      "※片持ち梁では上側引張りのため符号は負ですが、本問では大きさを問うているため正の値で表しています。",
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
  const prefix = problem.structure === "cantilever" ? "cantilever" : "simple";
  const type =
    problem.type === "concentrated" ? "concentrated" : "distributed";
  return `${prefix}-${type}` as ProblemCategory;
}

const ALL_CATEGORIES: ProblemCategory[] = [
  "simple-concentrated",
  "simple-distributed",
  "cantilever-concentrated",
  "cantilever-distributed",
];

type CategoryStats = {
  total: number;
  correct: number;
  accuracy: number;
};

const HISTORY_STORAGE_KEY = "@beam-drill/history";

type Mode = "normal" | "diagnostic";
type QuestionSource = "normal" | "diagnostic";

type SessionProgress = {
  answeredCount: number;
  targetCount: number | null;
  isCompleted: boolean;
};

const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  "simple-concentrated": "単純梁×集中荷重",
  "simple-distributed": "単純梁×等分布荷重",
  "cantilever-concentrated": "片持ち梁×集中荷重",
  "cantilever-distributed": "片持ち梁×等分布荷重",
};

function pickDiagnosticCategory(logs: AnswerLog[]): ProblemCategory {
  const answered = new Set<ProblemCategory>(logs.map((l) => l.category));
  const remaining = ALL_CATEGORIES.filter((c) => !answered.has(c));
  if (remaining.length > 0) {
    return remaining[Math.floor(Math.random() * remaining.length)];
  }
  return ALL_CATEGORIES[Math.floor(Math.random() * ALL_CATEGORIES.length)];
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
  };

  const perCategoryDuration: Record<ProblemCategory, { sum: number; count: number }> = {
    "simple-concentrated": { sum: 0, count: 0 },
    "simple-distributed": { sum: 0, count: 0 },
    "cantilever-concentrated": { sum: 0, count: 0 },
    "cantilever-distributed": { sum: 0, count: 0 },
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

  // 履歴保存
  const saveHistory = useCallback(async (logs: AnswerLog[]) => {
    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn("Failed to save history", e);
    }
  }, []);

  // カテゴリ別統計
  const stats: Record<ProblemCategory, CategoryStats> = useMemo(() => {
    const base: Record<ProblemCategory, CategoryStats> = {
      "simple-concentrated": { total: 0, correct: 0, accuracy: 0 },
      "simple-distributed": { total: 0, correct: 0, accuracy: 0 },
      "cantilever-concentrated": { total: 0, correct: 0, accuracy: 0 },
      "cantilever-distributed": { total: 0, correct: 0, accuracy: 0 },
    };
    history.forEach((log) => {
      const s = base[log.category];
      s.total += 1;
      if (log.isCorrect) s.correct += 1;
    });
    (Object.keys(base) as ProblemCategory[]).forEach((key) => {
      const s = base[key];
      s.accuracy = s.total > 0 ? s.correct / s.total : 0;
    });
    return base;
  }, [history]);

  // 全期間正答率
  const overallAccuracy: number | null = useMemo(() => {
    const total = history.length;
    if (total === 0) return null;
    const correct = history.filter((h) => h.isCorrect).length;
    return correct / total;
  }, [history]);

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

  // 通常ランダム出題
  const generateRandomProblem = useCallback((): BeamProblem => {
    const isCantilever = Math.random() < CANTILEVER_PROBABILITY;
    if (isCantilever) {
      return Math.random() < 0.5
        ? generateCantileverConcentrated()
        : generateCantileverDistributed();
    }
    const isDistributedProblem = Math.random() < 0.5;
    return isDistributedProblem ? generateDistributed() : generateConcentrated();
  }, []);

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
    (cat: ProblemCategory): BeamProblem => {
      switch (cat) {
        case "simple-concentrated":
          return generateConcentrated();
        case "simple-distributed":
          return generateDistributed();
        case "cantilever-concentrated":
          return generateCantileverConcentrated();
        case "cantilever-distributed":
          return generateCantileverDistributed();
      }
    },
    []
  );

  const generateProblem = useCallback(() => {
    let next: BeamProblem;
    if (mode === "diagnostic") {
      const cat = pickDiagnosticCategory(sessionAnswerLogs);
      next = generateProblemByCategory(cat);
      setCurrentSource("diagnostic");
    } else if (isWeakMode) {
      const cat = pickCategoryByWeakness();
      next = generateProblemByCategory(cat);
      setCurrentSource("normal");
    } else {
      next = generateRandomProblem();
      setCurrentSource("normal");
    }
    setProblem(next);
    setIsCorrect(null);
    setCurrentQuestionStartTs(Date.now());
  }, [
    generateRandomProblem,
    generateProblemByCategory,
    isWeakMode,
    mode,
    pickCategoryByWeakness,
    sessionAnswerLogs,
  ]);

  const startDiagnosticSession = useCallback((targetCount: number) => {
    const newSessionId = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMode("diagnostic");
    setSessionId(newSessionId);
    setSessionTargetCount(targetCount);
    setSessionAnswerLogs([]);
    setLastDiagnosticReport(null);

    // 初回問題はここで明示的に生成（モード反映のタイミングに依存しない）
    const firstCategory = pickDiagnosticCategory([]);
    const firstProblem = generateProblemByCategory(firstCategory);
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
            setDiagnosticReports((prevReports) => [report, ...prevReports]);
            // 回答し終えたので診断モードは一旦終了（画面側でレポート表示へ誘導）
            setMode("normal");
          }
          return updated;
        });
      }
    },
    [currentQuestionStartTs, currentSource, isWeakMode, problem, saveHistory, sessionId, sessionTargetCount]
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
    overallAccuracy,
    isWeakMode,
    toggleWeakMode,
    resetWeakModeData,
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
