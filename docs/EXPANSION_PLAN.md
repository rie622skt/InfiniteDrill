# 発展案 詳細プラン

発展A〜D を順次実装するための設計・タスク一覧。実装は A → B → C → D の順で進める。

---

## 発展A: 図心軸の移動と平行軸の定理（上級・断面の性質）

### 目的
「図心を通る軸まわりの I」に加え、L形断面で「まず図心 x_g を求め、その図心軸（x_g を通る鉛直軸）まわりの断面二次モーメント I を求めよ」という 2 ステップ問題を出題する。本試験頻出の T 形・L 形の I 算出の土台となる。

### 前提・流用
- 既存の **L 形断面**（横並び 2 長方形 b1×h, b2×h）と **SectionDiagram** の L 形描画・x_g 表示をそのまま流用する。
- 既存の **section-properties** カテゴリに統合し、上級（advanced）で「図心 x_g」に続く選択肢として「図心軸まわりの I」を追加する。

### 計算式
- 図心: x_g = (A1×x1 + A2×x2) / (A1 + A2)。A1 = b1×h, A2 = b2×h, x1 = b1/2, x2 = b1 + b2/2。
- 平行軸の定理: 各部分について I = I_g + A×d²。I_g はその部分の図心軸まわりの I（長方形で I_g = b×h³/12）。
- 左矩形: I_g1 = b1×h³/12, d1 = |x_g − x1| → I1 = I_g1 + A1×d1²。
- 右矩形: I_g2 = b2×h³/12, d2 = |x2 − x_g| → I2 = I_g2 + A2×d2²。
- **正解**: I_total = I1 + I2 [mm⁴]。割り切れる（整数）になる (b1, b2, h) のみ出題する。

### データ・型
- **ProblemTarget**: 既存の `"I"` と区別するため **`"I_centroid"`** を追加（図心軸まわりの I 専用）。
- **寸法候補**: 既存 `L_SHAPE_CENTROID_TRIPLES` のうち I_total が整数になる組だけを使う、または新定数 `L_SHAPE_I_CENTROID_TRIPLES` を定義（例: [100,100,60] は I=33,600,000 で整数）。
- **BeamProblem**: `target: "I_centroid"` と既存の `sectionShape: "L-shape"`, `sectionB1mm`, `sectionB2mm`, `sectionLShapeHmm` で表現。新プロパティは不要。

### 問題生成ロジック（useSectionProblem.ts）
1. 上級で「図心 x_g」の次に、一定確率で「図心軸まわりの I」を選択（例: 図心 25%、中空 50%、H 形 67% の前に「I_centroid」を 20% などで挿入）。
2. `generateLShapeICentroidProblem()` を新設: (b1, b2, h) を候補から選択 → x_g を正確に計算 → I_total = I1 + I2 を計算 → 整数でなければ候補を変えるか、その組は使わない。
3. 誤答候補: I_g1+I_g2（平行軸の項を忘れた）、I1 のみ or I2 のみ、b・h 入れ替え系、I_total×2, I_total/2、他支持の図心式混同など。整数のみ。

### UI
- **問題文**: 「図の L 形断面について、図心（x_g）を通る鉛直軸まわりの断面二次モーメント I [mm⁴] を求めよ」。
- **図**: 既存 SectionDiagram（L 形 + x_g の線）をそのまま使用。必要なら「図心軸」のラベルを追加してもよい。
- **単位**: mm⁴。選択肢は整数で表示。

### タスク一覧（発展A）※実装済み
- [x] types: `ProblemTarget` に `"I_centroid"` を追加。
- [x] useSectionProblem: I_total が整数になる L 形の (b1,b2,h) のリストを定義（L_SHAPE_I_CENTROID_TRIPLES: [100,100,60], [60,180,40]）。
- [x] useSectionProblem: `generateLShapeICentroidProblem()` を実装（正解・誤答・解説）。
- [x] useSectionProblem: `generateSectionPropertiesProblem("advanced")` の分岐に I_centroid を追加（15% で出題）。
- [x] HomeScreen: `problem.target === "I_centroid"` のときの問題文・単位 mm⁴・ラベル I を追加。SectionDiagram は既存 L 形と同じで表示される。
- [x] 解説ドキュメント: PROBLEM_ANSWER_EXPLANATIONS.md に「1.5 L 形断面・図心軸まわりの I」を追加。

---

## 発展B: たわみ・たわみ角（新カテゴリ）

### 目的
δ = PL³/(48EI) などの公式は頻出。EI をそのまま扱うと桁が大きくなるため、「スパン L が 2 倍になるとたわみは何倍か（8 倍）」など、**比率・比例関係**を問う形にし、ドリル向きにする。

### 方針
- **新カテゴリ**: `"deflection"` を追加（または既存「断面・座屈・応力度」に含めず独立カテゴリとしても可）。ラベル「たわみ・たわみ角」。
- **出題形式**: 選択式。「単純梁中央に集中荷重 P。スパン L を 2 倍にすると、中央たわみ δ は何倍になるか？」→ 答え 8。同様に「EI が 2 倍なら δ は何倍か？」→ 0.5。「片持ち先端に P。L が 2 倍なら δ は何倍か？」→ 8。
- **公式**: 単純梁中央 δ = PL³/(48EI) → L のみ変数なら δ ∝ L³。片持ち先端 δ = PL³/(3EI) → 同様に δ ∝ L³。
- **正解・誤答**: 倍数は整数または 0.5 などきれいな値に限定。誤答は 2, 4, 6, 1/4 など典型的な取り違え。

### データ・型
- **ProblemCategory**: `"deflection"` を追加。
- **BeamProblem**: `problemCategory: "deflection"`。問い種別は「L が 2 倍→δ の倍率」「EI が 2 倍→δ の倍率」「P が 2 倍→δ の倍率」などを target または説明で区別。既存 target で「M_max」のまま answer だけ倍率でも可。または `deflectionTarget: "ratio_L" | "ratio_EI" | "ratio_P"` などを追加。

### タスク一覧（発展B）※実装済み
- [x] types: `ProblemCategory` に `"deflection"` を追加。BeamProblemBase に `customQuestion` を追加。
- [x] useDeflectionProblem.ts を新規作成: 倍率問題の生成（単純梁・片持ち × L/EI/P の 2 倍にすると。正解 8 / 0.5 / 2）。
- [x] useBeamProblem: `generateProblemByCategory("deflection")` と `generateRandomProblem` に deflection を組み込み。ALL_CATEGORIES, DIAGNOSTIC_CATEGORIES, CATEGORY_LABELS, 診断 base, stats base, perCategoryDuration に追加。
- [x] HomeScreen: `customQuestion` を最優先で表示。単位「倍」・ラベル「倍率」。CHART_GROUPS に deflection を追加。
- [x] DiagnosticRadarChart: RADAR_SHORT_LABELS に "deflection": "たわみ" を追加。
- [x] ドキュメント: PROBLEM_ANSWER_EXPLANATIONS.md に「5. たわみ・たわみ角（発展B）」を追加。

---

## 発展C: 静定ラーメンの水平荷重（上級・ラーメン）

### 目的
現在は「梁中央集中 P」「梁上等分布 w」の鉛直対称荷重のみ。柱の横から**水平荷重 P**（風圧・地震想定）がかかるパターンを追加し、反力・柱頭モーメントの算出を問う。

### 方針
- **frame** カテゴリのまま、`generateFrameProblem()` 内で「水平荷重」を一定確率で選択（例: 50% 鉛直、50% 水平）。
- 3 ヒンジ門形で、柱の片側（例: 左柱）に水平集中 P が作用するモデルを想定。反力: 右支点に水平 H_B = P、左支点に H_A = 0（または対称でないので両方出る）。鉛直反力は 0 または偶力でつり合い。左柱頭曲げ M = P×h（または 0）、右柱頭曲げなどは問題設定による。本試験の定番に合わせて「左柱頭の曲げモーメント」を問うなら、左柱に P が上向きに作用する場合、左柱頭で M = P×h になるような設定にする。
- **データ**: frame に `frameHorizontalP?: number` を追加し、問題文と FrameDiagram で「左柱に水平荷重 P」を表示する。

### タスク一覧（発展C）※実装済み
- [x] types: BeamProblem に `frameHorizontalP?: number` を追加。
- [x] FrameDiagram: `frameHorizontalP` 指定時に左柱頭に水平矢印（P kN）を描画。
- [x] useFrameProblem: `FRAME_HORIZONTAL_TRIPLES` と `generateFrameProblemHorizontal()` を実装。M = P×h、誤答は P×L/4, P×h/2 等。
- [x] useFrameProblem: `generateFrameProblem()` で集中・等分布・水平を約 1/3 ずつ出題。
- [x] HomeScreen: 水平荷重時は問題文・info を「左柱頭に水平荷重 P が作用するとき…」「水平 P = … kN」に変更。FrameDiagram に frameHorizontalP を渡す。
- [x] ドキュメント: PROBLEM_ANSWER_EXPLANATIONS.md に「2.3 左柱に水平荷重 P（発展C）」を追加。

---

## 発展D: 複合応力度

### 目的
σ = N/A ± M/Z。偏心荷重による「軸力 N + 曲げ M」の複合。既存の軸力・曲げ・断面の性質の集大成。

### 方針
- **既存の bending-stress** に「複合応力度」が一部含まれているか確認。含まれていれば、出題率を上げるか、問題パターンを増やす。未実装なら新規に `generateCompositeStressProblem()` を useSectionProblem または useBeamProblem に追加。
- 条件: 長方形 or 既存断面で N, M, A, Z を設定し、σ = N/A + M/Z（引張側）または σ = N/A − M/Z（圧縮側）が**整数**になる組み合わせのみ。誤答は N/A のみ、M/Z のみ、符号取り違え、係数取り違え。
- **データ**: 既存の `axialForceKN`, `bendingStressTarget`, `sigmaCompressionSide` 等を流用。問題文で「偏心荷重で、引張側縁の応力度 σ を求めよ」など。

### タスク一覧（発展D）※実装済み
- [x] 既存の曲げ応力度・複合を確認: 複合応力度は `generateCombinedStressProblem()` で既に実装済み（bending-stress カテゴリ、上級で 50% 出題）。
- [x] 出題率の強化: 中級でも複合応力度を 35% で出題するように変更。上級は 50% のまま。
- [x] HomeScreen: 問題文・単位（N/mm²）は既に複合用の文言で表示済み。変更なし。
- [x] ドキュメント: PROBLEM_ANSWER_EXPLANATIONS.md に「6.2 複合応力度 σ = N/A ± M/Z（発展D）」を追加し、正解・誤答の典型を整理。

---

## 実装順序と依存

| 順序 | 発展 | 依存 | 見積もり |
|------|------|------|----------|
| 1 | A | なし（既存 L 形・section-properties のみ拡張） | 小 |
| 2 | B | 新カテゴリ・新 hook。useBeamProblem のカテゴリ列への追加 | 中 |
| 3 | C | FrameDiagram・useFrameProblem の拡張 | 中 |
| 4 | D | 既存 bending-stress の確認後、複合専用ロジック追加 | 小〜中 |

まず **発展A** から実装を進める。
