# 下層デザインテンプレート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans。承認済み設計を順に実施し、画像レビュー前にcommit/pushしない。

**Goal:** 本文を差し替えて増やせる、承認済TOP意匠の下層見本を作る。
**Architecture:** 1HTML＋名前空間付き本文CSS＋利用手順。外枠はTOPを複製、共通動作はnav.jsを再利用する。
**Tech Stack:** 静的HTML/CSS、Node assert、Playwright、axe。

### Task 1: 契約を先に固定

- [ ] `v2/tests/lower-page-template-contract.mjs` を追加。`assert.ok(existsSync(pagePath), 'template exists')`、外枠比較、noindex、参照、部品ID、診断URL1定数、CSS隔離を検証する。
- [ ] `node v2/tests/lower-page-template-contract.mjs` を実行し、template existsで失敗を確認する。

### Task 2: HTML/CSSと利用手順

- [ ] `v2/lower-page-template.html` にTOP外枠を置く。ナビ内 `href="#journey"` のみ `href="./index.html#journey"` に変える。
- [ ] `#hero`、`#overview`、`#features`、`#pricing`、`#process`、`#questions`、`#final-cta` の本文部品とHTML境界コメントを置く。
- [ ] `v2/lower-page-template.css` は `.lp-*` のみ。共有変数で色/間隔を設定し、3列カード・写真2列は狭幅で1列にする。
- [ ] `docs/templates/lower-page-template.md` に複製、差替え、meta/noindex、相対URL、素材、公開前QAを記録する。
- [ ] `node v2/tests/lower-page-template-contract.mjs` が全PASSになることを確認する。

### Task 3: 実画面とゲート

- [ ] `v2/tests/lower-page-template-browser.mjs` を追加し、`node v2/tests/lower-page-template-browser.mjs` で3ブラウザ375/1280、Chromium320/768、FAQ/navのキーボード、stickyのHero/本文/末尾表示条件、axe違反0とスクショを検証する。
- [ ] 375/1280画像と差分・実測数をrootへ送り、目視承認を待つ。
- [ ] 承認後に最適化確認・検証結果記録・対象ファイルcommit/push/PR更新を行う。親repo/本番は変更しない。
