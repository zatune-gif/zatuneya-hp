# Ver.5 LP（レビュー用）

`index.html` に「業務の見直し支援（業務改善）」と「個別実装」を集約した13セクションのLPです。各サービスのオプションは「AI活用設計」「運用保守」です。現在の公開トップはルート直下の `index.html` であり、`/v2/` のLPは本番へ昇格していません。

## ページと導線

- LPの見出し・料金・FAQは `v2/index.html` を確認してください。
- 旧詳細ページからの案内は5秒後の移動と手動リンクを使います。移動先はLP内の該当アンカーです。
- `service-banso.html` はリンクを外してファイルを残し、`noindex` を維持します。
- 相談ボタンの実際の問い合わせ先は `contact.html` です。無料診断は `https://ai-shindan-zatuneya.netlify.app/` に接続します。
- `v2/tokusho.html` はこのLP作業の変更対象外です。公開サイトの法定価格はルート直下の `tokusho.html` で先行更新します。

## デザインと編集

LPは既存V3の `top-comp.css`、`v3-top-page.css`、`lower-info-pages.css`、`nav.js` と既存のセクション・カード・表・折りたたみを使います。現V3の見出しフォントを維持します。`style.css` と `nav.js` のDOM契約は変更しません。

## 確認

リポジトリルートで依存を `npm ci` により導入してから、次を実行します。

```powershell
node v2/tests/ver5-lp-browser.mjs
node v2/tests/qa-axe.mjs --pages=index.html
node v2/tests/qa-lighthouse.mjs --pages=index.html
npm run qa:publication-test
npm run publication:build
npm run qa:publication-browser
```

`ver5-lp-browser.mjs` は375/768/1280pxをChromium・Firefox・WebKitで確認し、セクション・アンカー・横スクロール・診断リンクを検査して、Chromiumの全ページ画像を `qa-screenshots/ver5-lp/` に保存します。画像は実際のスクロールでアニメーションを発火させた後に撮影します。

公開物の許可リストは `tools/publication-files.txt` です。新規ファイルの配信が必要な場合だけ更新してください。`/v2/` はレビュー用のため、公開パッケージのnoindexゲートを通します。ルート本番への切り替えと旧ルートページからLPへの転送は、昇格判断後に別途行います。

Googleフォーム送信や診断結果ページの遷移は、このLP検証では実通信していません。エラーが表示されたら、表示された文章をそのままご連絡ください。
