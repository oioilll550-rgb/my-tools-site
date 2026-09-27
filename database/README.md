# 全国施設データ基盤

このディレクトリは、現在の越谷市飲食店データを将来の日本全国施設データへ拡張するためのDB設計です。

## 方針

- Web表示は当面 GitHub Pages のまま維持する。
- GitHub上のJSONは取得・検証・バックアップ用のステージングデータとして残す。
- 本番検索DBは Cloudflare D1 を想定する。
- 元データの出典、取得日時、元レコードIDを必ず保持する。
- 閉店・廃止は削除せず `status` と履歴で管理する。
- 施設IDはD1へ登録後は永続IDとして扱い、名称や住所変更で再採番しない。
- 自治体は全国地方公共団体コードをキーにする。

## 現在の第1号データ

- 都道府県: 埼玉県（11）
- 市区町村: 越谷市（112224）
- 施設種別: restaurant
- 元データ: 越谷市 食品関係営業施設一覧

`scripts/build_facility_dataset.py` が既存の越谷市飲食店データを、全国施設モデルの
`assets/data/facilities-koshigaya.json` に変換します。

## D1移行時

1. CloudflareでD1データベースを1つ作成する。
2. `database/schema.sql` を適用する。
3. ステージングJSONをD1へupsertする同期スクリプトを接続する。
4. Worker APIをGitHub Pagesから呼ぶ。
5. JSON直読みは障害時のフォールバックとして残す。

## 検索

通常のB-treeインデックスに加えて `facilities_fts` を用意しています。
日本語の店名・住所に対する部分文字列検索を想定し、FTS5のtrigram tokenizerを利用します。
