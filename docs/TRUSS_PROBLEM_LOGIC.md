# トラス問題の作成ロジック 詳細解説

トラス関連は **2 カテゴリ**（`truss-zero` / `truss-calculation`）で、**4 パターン**（山形・ゼロメンバー・片持ち・プラット）があります。  
ロジックは `src/hooks/useTrussProblem.ts`、出題分岐は `src/hooks/useBeamProblem.ts` の `generateProblemByCategory("truss-zero" | "truss-calculation", difficulty)` で行われます。

---

## 1. カテゴリとパターンの対応

| カテゴリ | パターン | 難易度による出題 |
|----------|----------|------------------|
| `truss-zero` | `zero-member` のみ | 全難易度で `generateTrussZero()` のみ |
| `truss-calculation` | 山形 / 片持ち / プラット | 初級: 山形のみ。中級・上級: 山形 1/3、片持ち 1/3、プラット 1/3 でランダム |

**コード（useBeamProblem.ts 1646–1657 行付近）:**

```ts
case "truss-calculation": {
  const d = difficulty ?? "intermediate";
  if (d === "beginner")
    return generateTrussCalculation("beginner");  // 山形のみ
  const r = Math.random();
  if (r < 1 / 3) return generateTrussCalculation(d);  // 山形
  if (r < 2 / 3) return generateTrussCantilever(d);    // 片持ち
  return generateTrussPratt(d);                        // プラット
}
```

共通の数値プールは `useTrussProblem.ts` 冒頭で定義されています。

```ts
const P_VALUES_KN = [20, 24, 30, 40] as const;
const L_VALUES_M = [3, 4, 5] as const;
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
```

---

## 2. パターン1: 山形トラス（simple-triangle）

**役割**: 頂点に集中荷重 P が作用する 2 ピン・1 ローラーの山形トラスで、**底辺（水平材）の軸力**を問う。

### 2.1 構造と力学

- 底辺 2L、高さ L（斜材 45°）、頂点に P、左ピン・右ローラー。
- 対称より反力: \(V_A = V_B = P/2\)。
- 左下節点の水平つり合い: 斜材の水平成分 = 底辺の軸力。斜材 45° より  
  \(N_{\text{底辺}} = \frac{P/2}{\tan 45°} = \frac{P}{2}\)（引張）。

したがって **正解は常に \(N_A = P/2\)（正の値）**。

### 2.2 コード（useTrussProblem.ts 16–62 行）

```ts
export function generateTrussCalculation(difficulty: Difficulty): BeamProblem {
  const P = pickRandom(P_VALUES_KN);   // 20, 24, 30, 40 のいずれか
  const L = pickRandom(L_VALUES_M);     // 3, 4, 5 のいずれか
  const answer = P / 2;                // 必ず整数
```

- **誤答候補**: `0, -answer, P, -P, P/4, -P/4, (3P)/4` のうち、正解と 0.01 以上離れたもの。
- **選択肢**: 誤答からランダムに 3 つ選び、正解を加えて `[...chosenWrong, answer].sort((a,b)=>a-b)` で 4 択を生成。
- **返却**: `trussPattern: "simple-triangle"`, `targetMember: "A"`, `trussP: P`, `trussL: L` を付与。図は「部材A＝底辺」で一意。

### 2.3 想定パターン数

- P が 4 通り、L が 3 通り → **12 通り**（問う部材は常に底辺のため、実質 12 種類）。

---

## 3. パターン2: ゼロメンバー（zero-member）

**役割**: 「荷重のない節点に 3 部材がつき、そのうち 2 本が同一直線上」のとき、**残り 1 本がゼロメンバー**であることを問う。

### 3.1 構造と力学

- 4 節点: 左下・右下・L 字節点（中央上付近）・右上。
- L 字節点に接続: 左下→L 字（左斜材）、L 字→右上（左斜材の延長＝同一直線）、L 字→右下（右斜材）。
- ゼロメンバーの定理: 同一直線上でない **「L 字→右下」の右斜材**の軸力が 0。
- 図上で「部材A」＝この右斜材としてハイライトしているため、**正解は常に 0**。

### 3.2 コード（useTrussProblem.ts 64–102 行）

```ts
export function generateTrussZero(difficulty: Difficulty): BeamProblem {
  const P = pickRandom(P_VALUES_KN);
  const L = pickRandom(L_VALUES_M);
  const answer = 0;

  const wrongCandidates: number[] = [P / 2, -P / 2, P, -P, P / 4, -P / 4];
  // ここから 3 つ選んで choices = [...chosenWrong, 0].sort(...)
```

- 正解は常に 0。誤答は P や P/2 など「力が流れている」と勘違いしやすい値。
- 返却: `problemCategory: "truss-zero"`, `trussPattern: "zero-member"`, `targetMember: "A"`。図は `TrussDiagram` の zero-member で「部材A＝L字→右下」をオレンジ表示。

### 3.3 想定パターン数

- P×L の組み合わせのみで、問う部材は常に「ゼロメンバー 1 本」→ **12 通り**（見た目は 12 種類）。

---

## 4. パターン3: 片持ちトラス（cantilever-truss）

**役割**: 壁から 2 スパン突出した片持ちトラスで、先端に P。**上弦（A）または下弦（B）**の軸力を、断面法で求める。

### 4.1 構造と力学

- 左端: 壁に固定（上・下 2 点支持）。右方向にスパン L が 2 つ、高さ h = L。先端（右上）に P 下向き。
- **上弦（部材A）**: モーメントの中心を **中央下節点**（斜材と下弦の交点）に取る。荷重 P までの距離 = **L**。  
  \(M = P \times L,\quad N_A \cdot h = P \times L \Rightarrow N_A = P\)（引張）→ **正解 \(+P\)**。
- **下弦（部材B）**: モーメントの中心を **左上支点（壁）**に取る。荷重 P までの距離 = **2L**。  
  \(M = P \times 2L,\quad N_B \cdot h = P \times 2L \Rightarrow N_B = 2P\)（圧縮）→ **正解 \(-2P\)**。

### 4.2 コード（useTrussProblem.ts 104–167 行）

```ts
const targetMember = pickRandom(["A", "B"] as const);
const answer = targetMember === "A" ? P : -2 * P;

const wrongCandidates: number[] = [
  0, P/2, -P/2, P, -P, P*2, -P*2, P/4, -P/4,
].filter((v) => Math.abs(v - answer) > 0.01);
```

- 解説文は **部材A** と **部材B** で完全に分岐:
  - A: 「モーメントの中心＝中央下節点、距離 L、N_A = +P」
  - B: 「モーメントの中心＝左上支点（壁）、距離 2L、N_B = -2P」

### 4.3 想定パターン数

- P が 4 通り、L が 3 通り、targetMember が 2 通り → **4 × 3 × 2 = 24 通り**。

---

## 5. パターン4: プラットトラス（pratt-truss）

**役割**: 静定の 2 スパン・3:4:5 のプラットトラス（左右端に垂直材あり）。下弦中央に P。**部材 A/B/C/D のいずれか 1 本**の軸力を問う。

### 5.1 構造と力学（3:4:5、高さ: 幅 = 3:4）

- 節点 6、部材 9（2n−3=9 で静定）。左端垂直材・右端垂直材あり。
- 荷重 P は **中央下節点**にのみ作用。反力 \(V_A = V_B = P/2\)。
- 部材定義（コードと図の対応）:
  - **A**: 左斜材（左上→中央下）。引張 \(N_A = \frac{5P}{6}\)。
  - **B**: 上弦（左スパン）。圧縮 \(N_B = -\frac{2P}{3}\)。
  - **C**: 下弦（左スパン）。左下節点は鉛直反力と左端垂直材のみで、下弦は水平のみ → \(N_C = 0\)。
  - **D**: 中央垂直材。中央下節点の鉛直つり合いで、左右斜材の鉛直成分が P を打ち消す → \(N_D = 0\)。

### 5.2 正解の算出（useTrussProblem.ts 182–193 行）

```ts
function getPrattAnswer(member: PrattMember, P: number): number {
  switch (member) {
    case "A": return (5 * P) / 6;   // 左斜材 引張
    case "B": return -(2 * P) / 3;  // 上弦 圧縮
    case "C": return 0;             // 下弦左
    case "D": return 0;             // 中央垂直材（ゼロメンバー）
  }
}
```

- A の導出: 左支点反力 P/2 が左端垂直材を経て左上節点へ。左斜材の鉛直成分とつり合い  
  \(N_A \cdot \frac{3}{5} = \frac{P}{2} \Rightarrow N_A = \frac{5P}{6}\)。
- B の導出: 左上節点の水平つり合いから、上弦が左斜材の水平成分と釣り合うため \(N_B = -\frac{2P}{3}\)。

### 5.3 誤答候補（useTrussProblem.ts 195–211 行）

```ts
function getPrattWrongCandidates(member: PrattMember, P: number, answer: number): number[] {
  const a = (5 * P) / 6, b = (2 * P) / 3, halfP = P / 2;
  const base = [
    0, -answer, answer, P, -P, a, -a, b, -b, halfP, -halfP, answer/2, answer*2,
  ].filter((v) => Math.abs(v - answer) > 0.01);
  return Array.from(new Set(base));
}
```

- 正解と 0.01 以上離れたものだけ残し、重複除去。ここから 3 つをランダムに選び、正解と合わせて 4 択にする。

### 5.4 スケールと P のプール（179–180, 217–222 行）

- **L=4**: `P_VALUES_PRATT_L4 = [24, 30, 36]`、図は h=3 m, 2L=8 m（3:4:5）。
- **L=8**: `P_VALUES_PRATT_L8 = [24, 30, 36, 48]`、図は h=6 m, 2L=16 m（相似形）。
- L は `Math.random() < 0.5` で 4 か 8 を選択。その L に対応する P 配列から 1 つ `pickRandom`。

### 5.5 想定パターン数

- L=4: P 3 通り × 部材 4 通り = 12。L=8: P 4 通り × 部材 4 通り = 16。  
- 合計 **28 通り**（L の選択がランダムなので、見かけ上 28 種類の問題）。

---

## 6. 共通の返却形（BeamProblem）

いずれのトラス生成関数も、次の形で `BeamProblem` を返します。

```ts
return {
  type: "concentrated",
  structure: "simple",
  L,                    // スパン関連の寸法（図の 2L や h の基準）
  target: "M_max",      // トラスでは図側で targetMember を見るため実質未使用
  answer,               // 数値（kN）
  choices,              // [number, number, number, number] 昇順
  explanation,          // 解説テキスト（改行区切り）
  problemCategory: "truss-zero" | "truss-calculation",
  trussPattern: "simple-triangle" | "zero-member" | "cantilever-truss" | "pratt-truss",
  targetMember: "A" | "A"|"B" | "A"|"B"|"C"|"D",  // パターンに依存
  trussP: P,
  trussL: L,
  P: 0, a: 0, b: 0,    // 梁用フィールドは未使用
};
```

- **図の表示**: `HomeScreen` で `problemCategory` が `truss-zero` / `truss-calculation` かつ `trussPattern`・`targetMember`・`trussP`・`trussL` が揃っているとき、`TrussDiagram` に `pattern`, `P`, `L`, `targetMember` を渡して描画します。

---

## 7. まとめ（パターン数）

| パターン | 正解の式 | パラメータ | 想定パターン数 |
|----------|----------|------------|----------------|
| 山形 | \(N_A = P/2\) | P∈{20,24,30,40}, L∈{3,4,5} | 12 |
| ゼロメンバー | \(N_A = 0\) | P, L 同上（見た目のみ変化） | 12 |
| 片持ち | A: \(+P\)、B: \(-2P\) | P, L 同上、targetMember∈{A,B} | 24 |
| プラット | A: \(5P/6\)、B: \(-2P/3\)、C: 0、D: 0 | L∈{4,8}, P は L に応じた配列、targetMember∈{A,B,C,D} | 28 |

**合計**: 同じ「数値の組み合わせ」まで区別すると **12+12+24+28 = 76 通り**以上。  
（ゼロメンバーは「0 を当てる」だけなので実質 1 問型だが、P/L で図のスケールが変わる分は 12 としてカウント。）
