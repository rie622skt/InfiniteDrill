/** 難易度 */
export type Difficulty = "beginner" | "intermediate" | "advanced" | "mixed";

/** 問いの対象: 最大曲げモーメント / 左支点A反力 / 右支点B反力 / 断面係数 / 断面二次モーメント / 曲げ応力度 / 位置xの曲げモーメント・せん断力 / 図心位置（x_g, y_g） / ラーメン用 */
export type ProblemTarget =
  | "M_max"
  | "Va"
  | "Vb"
  | "Z"
  | "I"
  | "I_centroid"
  | "sigma"
  | "M_at_x"
  | "Q_at_x"
  | "x_g"
  | "y_g"
  | "frame_M_beam"
  | "frame_M_left"
  | "frame_M_right";

/** 構造: 単純梁 / 片持ち梁 / 張り出し梁 */
export type BeamStructure = "simple" | "cantilever" | "overhang";

/** 問題カテゴリ: 構造 × 荷重タイプ + 断面・応力度 + 座屈 + トラス + 静定ラーメン + たわみ */
export type ProblemCategory =
  | "simple-concentrated"
  | "simple-distributed"
  | "cantilever-concentrated"
  | "cantilever-distributed"
  | "overhang-concentrated"
  | "overhang-distributed"
  | "section-properties"
  | "bending-stress"
  | "buckling"
  | "truss-zero"
  | "truss-calculation"
  | "frame"
  | "deflection";

/** トラス問題のテンプレート形状 */
export type TrussPattern =
  | "simple-triangle"
  | "zero-member"
  | "zero-member-t"
  | "cantilever-truss"
  | "pratt-truss";

/** 座屈問題の支持条件 */
export type BucklingSupportType =
  | "pinned-pinned"
  | "fixed-fixed"
  | "fixed-pinned"
  | "fixed-free";

/** 座屈問題の問い種別: 座屈長さ l_k または 座屈荷重の比率 */
export type BucklingTarget = "lk" | "P_ratio";

/** 学習履歴1件分 */
export type AnswerLog = {
  timestamp: number;
  category: ProblemCategory;
  isCorrect: boolean;
  /** 出題時の難易度（初期リリースの履歴には存在しない可能性がある） */
  difficulty?: Difficulty;
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
  /** 中級・上級で b 寸法を隠すためのフラグ（単純梁×集中荷重で使用） */
  hideDimensionB?: boolean;
  /** 断面問題で使用する幅 b [mm]（外寸 or 実長方形の幅） */
  sectionBmm?: number;
  /** 断面問題で使用するせい h [mm]（外寸 or 実長方形のせい） */
  sectionHmm?: number;
  /** 断面形状: 長方形 / 中空長方形（ロの字）/ L形（横並び2長方形）/ H形 / T形。未指定は長方形 */
  sectionShape?: "rectangle" | "hollow-rect" | "L-shape" | "H-shape" | "T-shape";
  /** 中空断面の内側幅 b' [mm]（sectionShape === 'hollow-rect' のとき必須） */
  sectionBInner?: number;
  /** 中空断面の内側せい h' [mm]（sectionShape === 'hollow-rect' のとき必須） */
  sectionHInner?: number;
  /** L形断面: 左矩形の幅 b1 [mm]。sectionShape === 'L-shape' のとき必須 */
  sectionB1mm?: number;
  /** L形断面: 右矩形の幅 b2 [mm]。sectionShape === 'L-shape' のとき必須 */
  sectionB2mm?: number;
  /** L形断面: 共通せい h [mm]。sectionShape === 'L-shape' のとき必須 */
  sectionLShapeHmm?: number;
  /** H形断面: フランジ厚さ tf [mm]。sectionShape === 'H-shape' のとき必須 */
  sectionTfMm?: number;
  /** H形断面: ウェブ厚さ tw [mm]。sectionShape === 'H-shape' のとき必須 */
  sectionTwMm?: number;
  /** 構造×荷重以外のカテゴリを扱うための明示的なカテゴリ指定 */
  problemCategory?: ProblemCategory;
  /** 座屈問題: 支持条件（problemCategory === 'buckling' のとき必須） */
  bucklingSupportType?: BucklingSupportType;
  /** 座屈問題: 問い種別（座屈長さ l_k または 荷重比率）（problemCategory === 'buckling' のとき必須） */
  bucklingTarget?: BucklingTarget;
  /** トラス問題: テンプレート形状（problemCategory が truss-* のとき必須） */
  trussPattern?: TrussPattern;
  /** トラス問題: 軸力を求める対象部材ID（例: 'A', 'B'） */
  targetMember?: string;
  /** トラス問題: 荷重 P [kN] */
  trussP?: number;
  /** トラス問題: スパン L [m]（BeamProblem の L も使うが、トラス用に明示） */
  trussL?: number;
  /** 等分布で M_at_x / Q_at_x を問うときの位置 x [m]（支点Aから） */
  questionX?: number;
  /** 曲げ応力度（複合）: 軸力 N [kN]。指定時は σ = N/A ± M/Z を出題 */
  axialForceKN?: number;
  /** 複合応力度で圧縮側を問うとき true。未指定または false は引張側 σ = N/A + M/Z */
  sigmaCompressionSide?: boolean;
  /** 張り出し梁: 支点Bから先の張り出し長さ c [m]。structure === 'overhang' のとき必須 */
  overhangLength?: number;
  /** 静定ラーメン: スパン L [m]。problemCategory === 'frame' のとき必須 */
  frameL?: number;
  /** 静定ラーメン: 軒高（柱の高さ）h [m]。problemCategory === 'frame' のとき必須 */
  frameH?: number;
  /** 静定ラーメン: 梁中央の集中荷重 P [kN]。集中荷重パターンのとき使用 */
  frameP?: number;
  /** 静定ラーメン: 梁上の等分布荷重 w [kN/m]。等分布パターンのとき使用（frameP と排他的） */
  frameW?: number;
  /** 静定ラーメン: ヒンジの位置。0〜1で左端からの比率。未指定は 0.5（梁中央） */
  frameHingeRatio?: number;
  /** 静定ラーメン: 左柱に作用する水平荷重 P [kN]（風圧・地震想定）。指定時は鉛直荷重の代わりに水平荷重問題 */
  frameHorizontalP?: number;
  /** 問題文を上書き（たわみの倍率問題など）。指定時はこれをそのまま表示 */
  customQuestion?: string;
  /** たわみの大小比較（δ_A/δ_B）問題。指定時は梁A・梁Bの2本を表示し、比を問う（中級・上級向け） */
  deflectionComparison?: {
    structureA: "simple" | "cantilever";
    structureB: "simple" | "cantilever";
    L_A: number;
    L_B: number;
    P_A: number;
    P_B: number;
  };
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
