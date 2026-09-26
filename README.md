# My Tools Site

無料のブラウザツールを公開する GitHub Pages サイトです。

## 構成

- `index.html`: TOPページ
- `tools/`: 各ツールのページ
- `assets/css/style.css`: 共通デザイン
- `assets/js/site.js`: サイト共通処理・ツール検索
- `assets/js/*.js`: 各ツール固有の処理
- `privacy.html`: プライバシーポリシー
- `404.html`: 404ページ
- `robots.txt`, `sitemap.xml`: 検索エンジン向け設定

## 新しいツールを追加するとき

1. `tools/` にHTMLを追加
2. 必要なら `assets/js/` に専用JavaScriptを追加
3. TOPページの「公開中のツール」にカードを追加
4. `assets/js/site.js` の `SITE_TOOLS` に検索データを追加
5. `sitemap.xml` にURLを追加
6. 開発履歴を更新

## 方針

可能な処理はブラウザ内で完結させ、外部API依存を必要最小限にします。
