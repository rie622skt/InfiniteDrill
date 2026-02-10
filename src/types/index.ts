/** 問いの対象: 最大曲げモーメント / 左支点A反力 / 右支点B反力 */
export type ProblemTarget = "M_max" | "Va" | "Vb";

/** 構造: 単純梁 / 片持ち梁 */
export type BeamStructure = "simple" | "cantilever";

/** 問題カテゴリ: 構造 × 荷重タイプ */
export type ProblemCategory =
  | "simple-concentrated"
  | "simple-distributed"
  | "cantilever-concentrated"
  | "cantilever-distributed";

/** 学習履歴1件分 */
export type AnswerLog = {
  timestamp: number;
  category: ProblemCategory;
  isCorrect: boolean;
  /** 1問あたりの解答時間[ms]（診断モードで使用） */
  durationMs?: number;
  /** 診断セッションID（通常モードのログでは null or 未定義） */
  sessionId?: string | null;
};

/** 診断レポート用のカテゴリ別統計 */
export type DiagnosticCategoryStats = {
  total: number;
  correct: number;
  accuracy: number; // 0〜1
  avgDurationMs: number | null;
};

/** 診断トレーニング1セッション分のサマリ */
export type DiagnosticReport = {
  sessionId: string;
  createdAt: number;
  totalQuestions: number;
  overallAccuracy: number;
  overallAvgDurationMs: number | null;
  statsByCategory: Record<ProblemCategory, DiagnosticCategoryStats>;
  weakCategories: ProblemCategory[];
  recommendation: string;
};

/** 共通プロパティ */
type BeamProblemBase = {
  L: number;
  structure: BeamStructure;
  target: ProblemTarget;
  answer: number;
  choices: number[];
  explanation: string;
};

/** 集中荷重 */
export type BeamProblemConcentrated = BeamProblemBase & {
  type: "concentrated";
  P: number;
  a: number;
  b: number;
};

/** 等分布荷重 */
export type BeamProblemDistributed = BeamProblemBase & {
  type: "distributed";
  w: number;
};

/** 判別可能な共用体 */
export type BeamProblem = BeamProblemConcentrated | BeamProblemDistributed;

/** 型ガード */
export function isConcentrated(p: BeamProblem): p is BeamProblemConcentrated {
  return p.type === "concentrated";
}

export function isDistributed(p: BeamProblem): p is BeamProblemDistributed {
  return p.type === "distributed";
}
