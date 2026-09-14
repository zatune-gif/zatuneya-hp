# V3下層ページ（レビュー用）

TOPは `index.html`、14下層はサービス一覧・研修・経営改善・伴走・実績・代表・FAQ・contact・privacy・tokusho・thank-you・404・growth・toolsです。ここは `/v2/` のレビュー用で、本番ルートは変更していません。

## 編集する場所

- 外枠：`top-comp.css` と `nav.js`（TOPと共有）。
- 共通本文：`lower-page-template.css`。サービス/実績/代表の差分は `lower-service-pages.css`、情報ページ差分は `lower-info-pages.css`。
- ページ追加：[下層テンプレートの使い方](../docs/templates/lower-page-template.md)。
- 本文の確定条件・例外・未検証範囲：[今回の実装・検証記録](../docs/qa/2026-09-15-lower-pages-v3.md)。

## 確認する

リポジトリルートで実行します。初回は `npm install` と `npx playwright install chromium firefox webkit` が必要です。

```powershell
npm run qa:verify
npm run qa:comp-contracts
npm run qa:lower-pages-contract
node v2/tests/info-visual-interaction.mjs
npm run qa:lower-pages-browser
npm run qa:axe
npm run qa:lighthouse
```

`qa:lower-pages-browser` は320/375/768/1280×3ブラウザで確認します。最終微修正だけ再確認する場合は `--pages=faq.html,contact.html` のように対象を指定できます。axeも同じ指定が可能です。全ページ指定を外すと既定の全管理ページが対象です。

`qa:all` には既存TOP寸法予算3項目とWindows WebKitの自然Tab2項目に未達があります。閾値を緩和せず、上記記録に対照証拠を残しています。全緑との誤認に注意してください。

## 画像と問い合わせ

画像は `qa-screenshots/lower-pages-current/` と `qa-screenshots/lower-info-pages/` にあります。代表者写真は準備中で、正式素材ではありません。未公開orderページはユーザー指示で削除済みです（Git履歴・root版から復旧可能）。

contactはGoogleフォームの直接リンク・メール・任意展開の埋込があります。フォーム送信の実通信は今回試していません。エラーが表示されたら、表示された文章をそのままご連絡ください。
