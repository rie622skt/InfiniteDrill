# Stripe 課金仕様（上級・診断モード解禁）

本ドキュメントは、**上級問題**と**診断モード**を有料（プレミアム）で解禁するための Stripe 課金の実装方針をまとめたものです。

---

## 1. 課金モデル

| 項目 | 無料 | プレミアム（課金後） |
|------|------|----------------------|
| 通常モード難易度 | 初級・中級のみ | 初級・中級・**上級**・総合 |
| 診断モード | 利用不可 | 利用可能 |
| 診断レポート | 閲覧不可 | 閲覧可能 |

- **課金形態**: サブスクリプション（月額 or 年額）を推奨。買い切りも可能。
- **決済**: Stripe（Web 決済）。iOS/Android アプリからはブラウザ or WebView で自サイトの Stripe Checkout ページを開く想定。

---

## 2. 全体アーキテクチャ

```
[アプリ (Expo)]
  - プレミアムかどうか: ローカルキャッシュ + 必要時にAPIで検証
  - 上級・診断: プレミアムでない場合は選択不可 or 課金案内表示

[自前バックエンド]（Vercel / Firebase / Supabase 等）
  - POST /api/create-checkout-session … Stripe Checkout セッション作成、URL を返す
  - GET (or POST) /api/premium-status … デバイス/ユーザーがプレミアムか返す
  - Webhook: Stripe の checkout.session.completed / customer.subscription.* を受信
    → 購入者を識別し、DB 等に「プレミアム」状態を保存

[Stripe]
  - 商品・価格（サブスク）の作成
  - Checkout で支払い
  - Webhook でバックエンドにイベント送信
```

- **ユーザー識別**: アプリでは「ユーザーID」を決める必要がある。  
  - 未ログイン前提なら: デバイス固有ID（expo-application の androidId / IMEI は使わず、UUID を AsyncStorage で保存など）を「顧客ID」としてバックエンドに送る。  
  - または「メールアドレス」のみで識別（Checkout で Stripe にメールを入力してもらい、そのメールをキーにプレミアム状態を保存）でも可。

---

## 3. Stripe 側の準備

1. **Stripe アカウント**  
   - https://dashboard.stripe.com で登録。

2. **商品・価格の作成**  
   - 例: 商品「構造力学ドリル プレミアム」  
   - 価格: 月額 〇〇円 または 年額 〇〇円（ recurring ）。

3. **Webhook**  
   - エンドポイント: `https://あなたのドメイン/api/webhooks/stripe`  
   - イベント例: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`  
   - 署名シークレット（`STRIPE_WEBHOOK_SECRET`）を環境変数で保持。

4. **Checkout の流れ**  
   - バックエンドで [Stripe Checkout Session](https://stripe.com/docs/api/checkout/sessions/create) を作成（`mode: 'subscription'`、`line_items` に上記価格を指定）。  
   - `success_url` / `cancel_url` で、アプリの Deep Link または Web の URL を指定し、支払い後にアプリに戻れるようにする。  
   - 顧客識別: `client_reference_id` にデバイスID やメールなどを渡し、Webhook で「誰がプレミアムか」を判別する。

---

## 4. バックエンド API 案

### 4.1 Checkout セッション作成

- **POST** `/api/create-checkout-session`
- Body 例: `{ "customerId": "device-uuid-or-email" }`
- 処理: Stripe の `checkout.sessions.create` を呼び出し、`url` を返す。
- レスポンス例: `{ "url": "https://checkout.stripe.com/..." }`  
  → アプリはこの URL をブラウザ or WebView で開く。

### 4.2 プレミアム状態の取得

- **GET** `/api/premium-status?customerId=xxx`  
  または **POST** `/api/premium-status` Body: `{ "customerId": "xxx" }`
- 処理: DB（または Stripe の subscription 一覧）を参照し、有効なサブスクがあればプレミアム。
- レスポンス例: `{ "premium": true }` または `{ "premium": false }`

### 4.3 Webhook

- **POST** `/api/webhooks/stripe`
- Stripe の署名を検証（`stripe.webhooks.constructEvent`）し、  
  `checkout.session.completed` / `customer.subscription.*` で「どの customer / client_reference_id がプレミアムか」を DB に保存・更新する。

---

## 5. アプリ側の実装ポイント

### 5.1 プレミアム状態の管理

- **永続化**: `AsyncStorage` に `premium: boolean` と `premiumCheckedAt: number`（最終確認時刻）を保存。  
  - 起動時や「診断」「上級」を押したときに API で検証し、結果で `premium` を更新。
- **コンテキスト**: `useBeamProblem` の外で「プレミアムか」を参照するため、  
  - 例: `PremiumContext` + `usePremium()` を用意し、  
  - `isPremium` と「課金ページを開く」関数（Checkout URL を開く）を提供する。

### 5.2 上級の解禁

- **難易度選択 UI**（`HomeScreen.tsx` の難易度カード）  
  - 「上級」「総合」は `isPremium === false` のとき:  
    - タップで「プレミアムのご案内」モーダル or 別画面を表示し、課金ボタンで Checkout URL を開く。  
  - または「上級」「総合」のカードをグレーアウト＋ロックアイコンで「プレミアムで解禁」と表示。
- **ロジック**: `useBeamProblem` の `setCurrentDifficulty` や `currentDifficulty` はそのまま利用し、  
  - 上級/総合を**選択可能にするかどうか**を UI 側で `isPremium` に応じて制御する。

### 5.3 診断モードの解禁

- **タブ「診断モード」**  
  - `isPremium === false` のとき:  
    - タップで「診断モードはプレミアム機能です」案内を表示し、課金ボタンで Checkout へ誘導。  
    - 診断モードの中身（診断開始・進捗・結果表示）は表示しない。  
  - または診断タブは表示するが、中身を「プレミアム解禁」の CTA に差し替える。
- **「診断レポート」タブ**  
  - プレミアム未加入時は「診断モードを利用するにはプレミアムが必要です」などのメッセージにし、レポート一覧は表示しない。

### 5.4 課金フロー（Stripe Checkout を開く）

- Web: `window.open(checkoutUrl)` または `window.location.href = checkoutUrl`。
- iOS/Android:  
  - `Linking.openURL(checkoutUrl)` でブラウザを開く、  
  - または WebView で Checkout を表示し、`success_url` でアプリの Deep Link に戻る。  
- 支払い完了後、`success_url` でアプリに戻ったタイミングで `/api/premium-status` を再取得し、`AsyncStorage` の `premium` を更新する。

---

## 6. 実装順序の提案

1. **Stripe ダッシュボード**: 商品・価格・Webhook の準備。
2. **バックエンド**:  
   - Checkout セッション作成 API  
   - Webhook でプレミアム状態を保存  
   - プレミアム状態取得 API  
3. **アプリ**:  
   - 顧客ID（デバイスID or メール）の決定と保存  
   - Premium 用コンテキスト/フック（`isPremium`, 課金開始）  
   - 上級・診断のゲート UI と Checkout を開く処理  
   - 戻り画面（success_url）でプレミアム状態を再取得して更新

---

## 7. 注意事項

- **iOS/Android のストア審査**: アプリ内で「Stripe の Web 決済」に飛ばすだけなら、審査ガイドライン上は「アプリ外決済」として扱われる場合があります。ストアの「アプリ内課金の義務」との関係は、ストアの規定と弁護士確認を推奨。
- **セキュリティ**: プレミアム状態は**必ずバックエンドで検証**する。クライアントのキャッシュだけだと改ざんされうるため、重要な操作前には API で再確認する。
- **顧客ID**: デバイスID のみだと端末変更でプレミアムが引き継がれない。引き継ぎが必要なら「アカウント（メール）ログイン」を検討する。

---

## 8. 参考リンク

- [Stripe Checkout（サブスク）](https://stripe.com/docs/payments/checkout/subscription)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Expo Linking（URL を開く）](https://docs.expo.dev/versions/latest/sdk/linking/)
