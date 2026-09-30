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
npm run qa:all
```

`qa:all` はVer.5の静的契約、公開パッケージ、375/768/1280px×Chromium・Firefox・WebKitの表示と操作、axe、Lighthouseを順に検査します。旧V3本文・画像に固定した検査は `qa:v3-legacy` として保持します。Ver.5のブラウザ検証はセクション・アンカー・横スクロール・ハンバーガー・ドロップダウン・FAQ開閉・6ページの5秒転送を確認し、Chromiumの全ページ画像を `qa-screenshots/ver5-lp/` に保存します。画像は実際のスクロールでアニメーションを発火させた後に撮影します。代表的な保持ページ（profile/contact/tokusho）のナビ操作とaxeも確認します。

旧ページの5秒 `meta refresh` は指定された案内方式ですが、axeはこの要素自体を `meta-refresh`（critical）として検出します。このため `qa:all` のaxeはLPと保持3ページを対象にし、案内ページは静的な転送先・手動リンクと実ブラウザでの5秒後の遷移を別途検証します。旧全ページ用の `qa:axe` を単独実行すると、この既知の違反で失敗します。

Lighthouseはモバイル・デスクトップ各2回で4指標を実測します。レビュー用の全17ページが `noindex,follow` のとき、LPのSEOに限り `is-crawlable` 監査による減点だけを閾値判定から除き、実測スコアは表示します。Performance、Accessibility、Best Practicesは90以上を維持します。本番用の監査ではこの例外を使わず、SEOを含む4指標90以上を確認します。

公開物の許可リストは `tools/publication-files.txt` です。新規ファイルの配信が必要な場合だけ更新してください。`/v2/` はレビュー用のため、公開パッケージのnoindexゲートを通します。ルート本番への切り替えと旧ルートページからLPへの転送は、昇格判断後に別途行います。

Googleフォーム送信や診断結果ページの遷移は、このLP検証では実通信していません。エラーが表示されたら、表示された文章をそのままご連絡ください。
