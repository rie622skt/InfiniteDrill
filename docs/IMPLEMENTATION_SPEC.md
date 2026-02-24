# InfiniteDrill 実装仕様書

本ドキュメントは、アプリで実装されている問題カテゴリ・難易度・問題形式・解説・問題作成ロジック・誤答作成ロジックを一括でまとめた仕様書です。  
関連: `EXPLANATION_FORMAT_SPEC.md`（解説フォーマット）、`PROBLEM_ANSWER_EXPLANATIONS.md`（正解・誤答の典型パターン）

---

## 1. 問題カテゴリ（ProblemCategory）

### 1.1 全カテゴリ一覧

| カテゴリ | 日本語ラベル | 主な target | unit |
|----------|-------------|-------------|------|
| `simple-concentrated` | 単純梁×集中荷重 | M_max, Va, Vb | kN·m / kN |
| `simple-distributed` | 単純梁×等分布荷重 | M_max, Va, Vb, M_at_x, Q_at_x | kN·m / kN |
| `cantilever-concentrated` | 片持ち梁×集中荷重 | M_max, Va | kN·m / kN |
| `cantilever-distributed` | 片持ち梁×等分布荷重 | M_max, Va, M_at_x, Q_at_x | kN·m / kN |
| `overhang-concentrated` | 張り出し梁×集中荷重 | Va, Vb, M_max | kN·m / kN |
| `overhang-distributed` | 張り出し梁×等分布荷重 | Va, Vb, M_max, M_at_x, Q_at_x | kN·m / kN |
| `section-properties` | 断面の性質（Z, I） | Z, I, I_centroid, x_g, y_g | mm³ / mm⁴ / mm |
| `bending-stress` | 曲げ応力度 | sigma, tau, eccentric_e | N/mm² / mm |
| `buckling` | 座屈 | lk, P_ratio | m / 倍 |
| `truss-zero` | トラス（ゼロメンバー） | 軸力 N | kN |
| `truss-calculation` | トラス（軸力計算） | 軸力 N | kN |
| `frame` | 静定ラーメン | frame_M_left 等 | kN·m |
| `deflection` | たわみ・たわみ角 | 倍率 | 倍 |

### 1.2 bending-stress の内訳

bending-stress は以下のサブタイプを持つ（いずれも `problemCategory: "bending-stress"`）：

| サブタイプ | target | 内容 | 難易度 |
|-----------|--------|------|--------|
| 曲げ応力度 σ = M/Z | sigma | 長方形断面、梁の M_max から σ | 中級〜 |
| 複合応力度 σ = N/A ± M/Z | sigma | 軸力＋曲げ、圧縮側 or 引張側 | 中級〜 |
| 短柱・最大圧縮応力度 | sigma | 偏心荷重、τ_c = N/A + M/Z、Z = h×b²/6 | 中級〜 |
| 短柱・限界偏心 e | eccentric_e | e_max = Z/A = b/6（横偏心） | 中級〜 |
| せん断応力度 τ（長方形） | tau | τ_max = 3Q/(2A) = 1.5×Q/A | 中級〜 |
| せん断応力度 τ（H形） | tau | τ = Q/(t_w×h_w)、ウェブ負担 | 中級〜 |

---

## 2. 難易度（Difficulty）

### 2.1 定義

| 難易度 | 説明 |
|--------|------|
| `beginner` | 初級：基本的な梁・断面・座屈・ゼロメンバー |
| `intermediate` | 中級：偏心荷重、b 隠し、M_x/Q_x、複合応力度、トラス全種、たわみ |
| `advanced` | 上級：張り出し梁、ラーメン、中空/L形/H形/T形断面、短柱、せん断 τ |
| `mixed` | 総合：初級30%・中級50%・上級20% で難易度をランダム決定 |

### 2.2 難易度別の出題範囲

**初級**
- 単純梁：中央荷重のみ（a = L/2）
- 片持ち梁：自由端荷重のみ（a = L）
- 断面：Z のみ
- 座屈：l_k のみ
- ゼロメンバー：L字 / T字（約50%ずつ）

**中級**
- 単純梁：偏心、b 隠し、等分布で M_at_x / Q_at_x（約50%）
- 片持ち梁：任意 a、等分布で M_at_x / Q_at_x
- 断面：Z と I（約50:50）
- 曲げ応力度 σ、複合応力度、短柱、せん断 τ（各一定率）
- 座屈：l_k と荷重比率 1/γ²
- トラス：山形・片持ち・プラット・ゼロメンバー
- たわみ：倍率問題、δ_A/δ_B 比較

**上級**
- 中級に加え
- 張り出し梁（V_A, V_B, M_max）
- 静定ラーメン（梁中央集中、梁上等分布、柱頭水平荷重）
- 断面：中空長方形、L形（x_g, I_centroid）、H形、T形（y_g, I）
- 曲げ応力度：複合・短柱・せん断 τ の出題率を強化

### 2.3 カテゴリ出題率（通常モード）

- 断面 12%、曲げ応力度 12%、座屈 12%
- トラス計算 6%、片持ちトラス 4%、プラット 2%、たわみ 2%
- ゼロメンバー（初級時）12%
- 残り：梁（片持ち25%、等分布50%、張り出し・ラーメンは上級のみ 6% など）

---

## 3. 問題形式（ProblemTarget）

### 3.1 全 target 一覧

| target | 説明 | 主なカテゴリ |
|--------|------|-------------|
| `M_max` | 最大曲げモーメント | 梁、たわみ・座屈（内部表現） |
| `Va`, `Vb` | 支点反力 | 梁 |
| `Z` | 断面係数 | section-properties |
| `I` | 断面二次モーメント | section-properties |
| `I_centroid` | 図心軸まわりの I | section-properties（L形） |
| `sigma` | 曲げ応力度・複合応力度 | bending-stress |
| `M_at_x`, `Q_at_x` | 位置 x の曲げ・せん断力 | 梁（等分布） |
| `x_g`, `y_g` | 図心位置 | section-properties（L形・T形） |
| `frame_M_beam`, `frame_M_left`, `frame_M_right` | ラーメンの曲げモーメント | frame |
| `eccentric_e` | 偏心距離 e（短柱） | bending-stress |
| `tau` | せん断応力度 | bending-stress |

---

## 4. 解説（explanation）

### 4.1 共通ルール

- 改行は `"\n"` で結合（`explanationLines.join("\n")`）
- 整数なら `=`、それ以外は `≒`（`eqOrApprox(value)` 使用）
- 数値代入の式を必ず 1 行以上挟む
- 応力度問題では単位変換（kN·m → N·mm、kN → N）を明記

### 4.2 ステップ形式（①②③）を使用する問題

- L形 I_centroid：① 面積・図心 → ② x_g → ③ I_0 → ④ d → ⑤ I 合成
- T形 I：① 面積・図心 → ② y_g → ③ I_0 → ④ d → ⑤ I 合成
- 複合応力度：① 軸力応力度 → ② 曲げ応力度 → ③ 重ね合わせ
- 短柱（σ_c / e）：① A, Z → ② σ_軸 → ③ σ_曲げ → ④ σ_c または e_max
- せん断 τ：① A（または t_w×h_w）→ ② Q → ③ τ

### 4.3 注記定型文

| 用途 | 定型文 |
|------|--------|
| 大きさを問う場合 | 「※本問では大きさを問うているため、絶対値（正の値）で解答します。」 |
| 符号を問う場合（トラス） | 「※建築士試験の慣例に従い、引張力を正（+）、圧縮力を負（-）とします。」 |

---

## 5. 問題作成ロジック

### 5.1 候補セット（candidates）

| カテゴリ | 候補セット | 条件 |
|----------|-----------|------|
| 梁（集中） | L_VALUES, P_VALUES, A_BY_L, C_OVERHANG_BY_L 等 | 正解が整数 or 小数第1位で表せる |
| 梁（等分布） | L_VALUES, W_VALUES | 同上 |
| 断面・長方形 | SECTION_PAIRS | Z = bh²/6、I = bh³/12 が整数になる (b,h) |
| 断面・中空 | HOLLOW_SECTION_QUADS | I, Z が整数になる (B,H,b,h) |
| 断面・H形 | H_SHAPE_QUADS | I, Z が整数になる (b,h,tf,tw) |
| 断面・T形 | T_SHAPE_QUADS | 手動選定 |
| 断面・L形 | L_SHAPE_CENTROID_TRIPLES, L_SHAPE_I_CENTROID_TRIPLES | x_g, I が整数 |
| 曲げ応力度 | collectBendingStressCandidates | σ = M/Z が整数 |
| 複合応力度 | collectCombinedStressCandidates | σ = N/A ± M/Z が整数 |
| 短柱・σ_c | SHORT_COLUMN_MAX_COMP_CANDIDATES | Z = h×b²/6、σ_c が整数 |
| 短柱・e | SHORT_COLUMN_CORE_CANDIDATES | b/6 が整数 |
| せん断 τ（長方形） | SHEAR_STRESS_RECT_CANDIDATES | τ_max = 1.5×Q/A が整数 |
| せん断 τ（H形） | SHEAR_STRESS_H_CANDIDATES | τ = Q/(tw×hw) が整数 |
| 座屈 | SUPPORT_TYPES, L_VALUES_M 等 | l_k または 1/γ² |
| トラス | P_VALUES_KN, L_VALUES_M, パターン別候補 | 軸力が整数 |
| ラーメン | FRAME_TRIPLES, FRAME_DISTRIBUTED_TRIPLES 等 | M が整数 |
| たわみ | DEFLECTION_COMPARISON_CASES 等 | 倍率がきれいな小数 |

### 5.2 整数・小数の扱い

- `roundToOneDecimal`：梁の反力・モーメント
- `roundToInteger`：断面、応力度、座屈など
- `eqOrApprox`：図心・距離など、整数なら `=`、そうでなければ `≒`
- `isNiceOneDecimal`：小数第1位で「きれいに」表せるか（最大10回リトライ）
- 原則：正解・選択肢は式から整数になる組み合わせを優先。丸めのみで作るのは避ける

### 5.3 generateProblem の流れ

1. **診断モード**：`pickDiagnosticCategory` で未出題カテゴリ優先 → `generateProblemByCategory(cat, intermediate)`
2. **カテゴリ固定**：`generateProblemByCategory(pinnedCategory, difficulty)`
3. **苦手克服**：`pickCategoryByWeakness` でカテゴリ選択 → `generateProblemByCategory`
4. **通常**：`generateRandomProblem(difficulty)`  
   - mixed なら 初級30%・中級50%・上級20% で effectiveDifficulty を決定  
   - カテゴリ確率で分岐し、各カテゴリのジェネレータを呼ぶ

---

## 6. 誤答作成ロジック

### 6.1 共通関数

| 関数 | 用途 | 条件 |
|------|------|------|
| `pickWrongChoices(candidates, answer, 3)` | 正の値のみ | `isValidWrong`: v > 0 かつ \|v - answer\| > tolerance |
| `pickWrongChoicesAllowNegative(candidates, answer, 3)` | 負解あり（Q_at_x, 複合応力度等） | `isValidWrongAllowNegative`: \|v - answer\| > 1 |
| `pickWrongChoicesWithPriority` | 優先リスト＋補完 | 足りなければ answer±10 等で補完 |

### 6.2 許容差（ANSWER_TOLERANCE）

- `useBeamProblem`: 0.01
- `useSectionProblem`: 1e-6（isValidWrong）、1（isValidWrongAllowNegative）

### 6.3 各カテゴリの誤答設計思想

| カテゴリ | 誤答の典型 | 意図 |
|----------|-----------|------|
| 集中荷重 M_max | Pab/1, Pa/L, Pb/L, PL/4, PL/2, PL/8, Pa, Pb | 公式・梁タイプの混同 |
| Va / Vb | 他方の反力、P/2、M_max | 反力とモーメントの混同 |
| 等分布 M_max | wL²/4, wL²/2, wL/8 | 分母・式の取り違え |
| Q_at_x | wL/2, -wL/2, M_x, wx | 全荷重・反力との混同 |
| 断面 Z/I | b,h 入れ替え、分母 6/12 の取り違え、2倍・1/2 | 中立軸・公式の混同 |
| 曲げ応力度 | 単位ミス（10^6→10^3）、I と Z の混同、他梁タイプの式 | 単位・公式の混同 |
| 複合応力度 | σ_軸のみ、σ_曲げのみ、σ_軸−σ_曲げ（最小側） | 項の取り忘れ |
| 短柱 σ_c | σ_軸のみ、σ_曲げのみ、σ_軸−σ_曲げ | 同上 |
| 短柱 e | h/4, h/8, h/3, h/2, h/10 | 公式・軸の混同 |
| せん断 τ | τ_avg、τ×2、τ/2、全断面積で計算 | 1.5倍忘れ、ウェブ面積忘れ |
| 座屈 l_k | 他支持条件の l_k、0.5L, L, 2L | 係数 γ の混同 |
| 座屈比率 | 0.25, 0.5, 1, 2 | 1/γ² の計算ミス |
| トラス | 0, ±P, ±P/2, ±P/4 | 符号・倍率の混同 |
| ラーメン | PL/2, Ph/2, PL, Ph, PL/8 | 鉛直荷重・片持ち柱との混同 |

### 6.4 重複排除・4択保証

- 誤答候補は `Array.from(new Set(...))` で重複除去
- 正解と許容差以内の値は除外
- 不足時は `answer±1, ±2` などのフォールバックで補完
- 短柱・せん断など：`choices.length < 4` のときフォールバックを追加して必ず4択

---

## 7. 図・UI の補足

### 7.1 図のスケール

- **比率忠実**：短柱の断面（b/h 比に合わせて幅・高さを動的計算）、曲げ応力度の M 図・Q 図（データに応じてゼロ線位置を調整）
- **概念図**：梁図、トラス図、ラーメン図は読みやすさ優先でスケール固定

### 7.2 短柱図の注意

- 偏心 e は幅 b 方向（横方向）。Z = h×b²/6、e_max = b/6
- 寸法線 e の左端は図心の X 座標と一致（`eccentricOriginX` で共通化）
- 図心から e 寸法線まで補助点線を表示

---

## 8. 関連ファイル

| ファイル | 役割 |
|----------|------|
| `src/types/index.ts` | ProblemCategory, ProblemTarget, BeamProblem 型 |
| `src/hooks/useBeamProblem.ts` | 梁・カテゴリ分岐・診断・履歴 |
| `src/hooks/useSectionProblem.ts` | 断面・曲げ応力度・複合・短柱・せん断 τ |
| `src/hooks/useBucklingProblem.ts` | 座屈 |
| `src/hooks/useTrussProblem.ts` | トラス |
| `src/hooks/useFrameProblem.ts` | ラーメン |
| `src/hooks/useDeflectionProblem.ts` | たわみ |
| `docs/EXPLANATION_FORMAT_SPEC.md` | 解説フォーマット仕様 |
| `docs/PROBLEM_ANSWER_EXPLANATIONS.md` | 正解・誤答の典型パターン |
