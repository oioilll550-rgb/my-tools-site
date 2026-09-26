# アクセスカウンター

GitHub Pages は静的ホスティングなので、アクセス数の保存だけ Cloudflare Worker + D1 に分離します。

## 数え方

- ブラウザの1セッションにつき1回だけ `/hit` を送信
- ページ再読み込みだけでは同じセッション中は増えません
- 累計アクセス数と日本時間の当日アクセス数を表示
- IPアドレスやユーザーエージェントをD1へ保存しません

この方式は厳密な「ユニークユーザー数」ではなく、サイト利用の目安となるセッション数です。

## デプロイ

Cloudflare 側で D1 と Worker を作成します。

```
cd cloudflare-counter
npm install -g wrangler
wrangler login
wrangler d1 create benri-visitor-counter
```

返された database_id を `wrangler.toml` の `database_id` に設定します。

```
wrangler d1 execute benri-visitor-counter --remote --file=./schema.sql
wrangler deploy
```

公開された Worker URL を `assets/js/config.js` の `counterApiUrl` に設定します。

例:

```js
window.BENRI_CONFIG = {
  counterApiUrl: "https://benri-visitor-counter.example.workers.dev"
};
```

## 将来の拡張

D1を使っているため、ページ別カウント、週間・月間集計、人気ツールランキングへ拡張できます。
大量の不正リクエスト対策が必要になった場合は Cloudflare Turnstile や Rate Limiting を追加できます。
