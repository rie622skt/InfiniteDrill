# 構造力学ドリル ランディングページ（LP）

LP とアプリは**別物**です。このフォルダは静的 LP のみを含みます。

## 使い方

- **LP**: この `landing/` を任意の Web サーバーで配信する（Vercel / Netlify / GitHub Pages など）。
- **アプリ**: リポジトリルートで `npx expo start --web` または `npm run build:web` でビルド・配信。

## アプリの URL を変える

LP の「無料で始める」「Webで開く」は、アプリの URL へ飛ばします。

- 同じドメインで LP を `example.com/lp/`、アプリを `example.com/` で配信する場合: `index.html` の `<meta name="app-url" content="/">` のままでよい。
- アプリを別ドメイン（例: `https://app.example.com`）で配信する場合: `content` を `https://app.example.com` に変更する。

## ローカルで LP だけ確認する

```bash
# リポジトリルートで
npx serve landing
```

ブラウザで http://localhost:3000 を開く。
