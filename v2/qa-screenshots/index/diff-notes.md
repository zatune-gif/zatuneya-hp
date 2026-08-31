# v3 TOP スクリーンショット確認（2026-08-30）

- 確認幅: 320px / 375px / 768px / 1280px
- 確認項目: 全12セクションの順序、H1と主力パッケージの視線誘導、CTAの用途別リンク、写真枠の比率、4px余白、ヘッダー、フッター、スティッキーCTA、横スクロール、重なり、キーボードフォーカス、reduced-motion
- 結果: 4幅ともブラウザ検証で `document.documentElement.scrollWidth <= window.innerWidth` を確認。375px / 768px / 1280pxの目視では、参考画像の情報優先順位に沿うことを確認。
- 差し替え対象: Hero以外の写真は暫定素材。`data-asset-role`を持つ画像の `src` と `alt` を事実確認済み素材へ差し替える。匿名実績は `data-case-status="placeholder"` の仮データであり、事実確認済みの匿名事例へ置換する。
