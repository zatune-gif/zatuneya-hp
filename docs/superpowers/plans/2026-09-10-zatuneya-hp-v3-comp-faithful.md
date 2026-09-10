# ざつね屋 HP v3 承認カンプ忠実再制作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 承認カンプを座標分解し、カンプ由来の写真パーツとHTML/CSS/SVGで `v2/index.html` をPC/SPとも視覚的に忠実に再制作する。

**Architecture:** カンプから表示用写真7点・比較用パネル2点・SVG再構築用参照2点を可逆PNGとして切り出し、manifestで座標とSHA-256を固定する。TOP本文は10セクションに再構成し、共通シェルは `top-comp.css`、TOP固有レイアウトは `v3-top-page.css` に分離する。静的契約・幾何契約・低解像度グリッド画像差分の三層でカンプ一致を検証する。

**Tech Stack:** HTML5、CSS Grid/Flexbox、inline SVG、Node.js ESM、Playwright 1.62.1、Python 3 + Pillow 12.3.0（可逆PNG切り出しのみ）

---

### Task 1: カンプ座標と切り出し契約をREDにする

**Files:**
- Create: `v2/tests/comp-parts-contract.mjs`
- Create: `v2/assets/comp-parts/manifest.json`
- Test: `v2/tests/comp-parts-contract.mjs`

- [ ] **Step 1: 期待する11パーツの契約テストを書く**

```js
const expected = {
  'comp-desktop-reference.png': [0, 0, 588, 2178],
  'comp-mobile-reference.png': [590, 0, 722, 2178],
  'hero-desktop.png': [232, 41, 588, 328],
  'hero-mobile.png': [600, 45, 709, 131],
  'package-dashboard.png': [21, 587, 170, 711],
  'service-training.png': [21, 875, 183, 978],
  'service-design.png': [204, 875, 366, 978],
  'service-support.png': [389, 875, 566, 978],
  'representative.png': [26, 1224, 211, 1383],
  'logo-reference.png': [13, 12, 36, 35],
  'tool-icons-reference.png': [190, 1642, 529, 1734]
};
```

テストはPNG IHDRの幅・高さ、manifestの矩形、ファイル存在、source SHA-256を検査する。HTML上では表示用7点だけが参照され、AI生成 `v3-*.jpg` は参照されないことも検査する。

- [ ] **Step 2: テストを実行して正しい失敗を確認する**

Run: `node v2/tests/comp-parts-contract.mjs`

Expected: `manifest.json` または切り出しPNGが存在しないためFAIL。

- [ ] **Step 3: RED出力を作業ログへ残す**

Run: `node v2/tests/comp-parts-contract.mjs 2>&1`

Expected: 実装不足に起因するFAILであり、構文エラーではない。

### Task 2: カンプを座標で分解する

**Files:**
- Create: `tools/crop-v3-comp-parts.py`
- Create: `v2/assets/comp-parts/README.md`
- Create: `v2/assets/comp-parts/*.png`
- Modify: `v2/assets/comp-parts/manifest.json`
- Test: `v2/tests/comp-parts-contract.mjs`

- [ ] **Step 1: Pillow切り出しスクリプトを実装する**

```python
from pathlib import Path
from PIL import Image

PARTS = {
    "comp-desktop-reference.png": (0, 0, 588, 2178),
    "comp-mobile-reference.png": (590, 0, 722, 2178),
    "hero-desktop.png": (232, 41, 588, 328),
    "hero-mobile.png": (600, 45, 709, 131),
    "package-dashboard.png": (21, 587, 170, 711),
    "service-training.png": (21, 875, 183, 978),
    "service-design.png": (204, 875, 366, 978),
    "service-support.png": (389, 875, 566, 978),
    "representative.png": (26, 1224, 211, 1383),
    "logo-reference.png": (13, 12, 36, 35),
    "tool-icons-reference.png": (190, 1642, 529, 1734),
}
```

引数は `--source` と `--output`。元画像のSHA-256をmanifestへ書き、各切り出しはPNGで保存する。

- [ ] **Step 2: 親リポジトリの承認カンプから切り出す**

Run:

```powershell
& 'C:\Users\ooto\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\crop-v3-comp-parts.py `
  --source '..\..\..\design-comps\zatuneya-hp\v3-top-page-comp.png' `
  --output 'v2\assets\comp-parts'
```

Expected: 11 PNGとmanifestが生成され、sourceは722×2178と表示される。

- [ ] **Step 3: 低解像度・用途・差し替え条件をREADMEへ明記する**

READMEには、スクリーンショット由来で拡大するとぼけること、表示用は写真7点だけであること、ロゴ/ツール参照はSVG再構築用であること、正式写真受領後は差し替えることを記載する。

- [ ] **Step 4: パーツ契約をGREENにする**

Run: `node v2/tests/comp-parts-contract.mjs`

Expected: 11パーツの座標・寸法・SHAがPASS。ただしHTML参照テストはTask 4までFAILしてよいよう個別テスト名を分ける。

- [ ] **Step 5: パーツ分解をコミットする**

```powershell
git add -- tools/crop-v3-comp-parts.py v2/assets/comp-parts v2/tests/comp-parts-contract.mjs
git commit -m "test: 承認カンプのパーツ座標契約を追加"
```

### Task 3: TOPの可視構成契約をREDにする

**Files:**
- Modify: `v2/tests/top-comp-contract.mjs`
- Modify: `v2/tests/verify-v2.mjs`
- Test: `v2/tests/top-comp-contract.mjs`

- [ ] **Step 1: セクション順とFAQ6問を先に契約化する**

```js
const expectedOrder = ['hero','problems','package','services','journey','why-us','cases','tools','faq','final-cta'];
assert.deepEqual(sectionIds, expectedOrder);
assert.doesNotMatch(html, /id="(?:value|growth)"/);
assert.equal(faqButtons.length, 6);
```

表示用画像の期待パスを `./assets/comp-parts/*.png` へ変更し、Heroは `<picture>` とPC/SP sourceを要求する。既存の逐語コピー契約は残る10セクション分を維持し、削除した2節の本文期待だけをTOP契約から外す。

- [ ] **Step 2: 契約テストを実行して正しい失敗を確認する**

Run: `node v2/tests/top-comp-contract.mjs`

Expected: 現行が12セクション、FAQ3問、AI生成画像参照のためFAIL。

### Task 4: HTMLをカンプ順に再構築する

**Files:**
- Modify: `v2/index.html`
- Test: `v2/tests/top-comp-contract.mjs`
- Test: `v2/tests/comp-parts-contract.mjs`

- [ ] **Step 1: ヘッダーをカンプ構図へ合わせる**

ブランドはinline SVGマーク＋屋号＋肩書の3要素にし、PCナビは「サービス」「進め方」「事例」「ツール」「会社案内」「よくある質問」、診断CTA、問い合わせCTAの順にする。SPは既存hamburger DOM契約で開閉する。

- [ ] **Step 2: Heroをpicture要素へ置換する**

```html
<picture class="hero-visual">
  <source media="(max-width: 480px)" srcset="./assets/comp-parts/hero-mobile.png">
  <img src="./assets/comp-parts/hero-desktop.png" data-asset-role="hero-meeting" width="356" height="287" alt="業務資料を囲み、二人で業務を整理する様子" fetchpriority="high">
</picture>
```

Hero本文と2CTA、地域マイクロコピーは確定本文を逐語維持する。

- [ ] **Step 3: カンプ外の独立2セクションを外す**

`#value` と `#growth` をTOPから削除し、可視順序を `hero → problems → package → services → journey → why-us → cases → tools → faq → final-cta` にする。`growth.html` 自体は変更しない。

- [ ] **Step 4: 残る写真6点をカンプパーツへ置換する**

パッケージ、サービス3枚、代表者に `assets/comp-parts/` のPNGを指定し、正しいwidth/height、alt、`data-asset-role`を付ける。代表者には `data-asset-status="comp-placeholder"` を付ける。

- [ ] **Step 5: 支援工程・強み・実績・ツールのinline SVGをカンプ輪郭へ合わせる**

SVGは `viewBox="0 0 48 48"`、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"`、round cap/joinで統一する。順序や意味を文字だけに依存しないよう、SVGは装飾扱い `aria-hidden="true"` とし、隣に見出しを残す。

- [ ] **Step 6: FAQを6問へ拡張する**

確定3問に、既存 `faq.html` の研修人数、費用目安、伴走内容の3問を追加する。6ボタンすべてに一意の`aria-controls`、回答側に対応IDと`hidden`を付ける。

- [ ] **Step 7: 静的契約をGREENにする**

Run: `node v2/tests/top-comp-contract.mjs; node v2/tests/comp-parts-contract.mjs; node v2/tests/verify-v2.mjs`

Expected: セクション順、FAQ6問、カンプ画像参照、逐語コピー、ローカル参照がPASS。

### Task 5: カンプ実測の幾何契約をREDにする

**Files:**
- Rewrite: `v2/tests/top-comp-geometry.mjs`
- Test: `v2/tests/top-comp-geometry.mjs`

- [ ] **Step 1: 旧予算をカンプランドマークへ置換する**

```js
const targets = {
  1280: { total: [4580,5000], starts: { hero:89, problems:757, package:1202, services:1687, journey:2284, whyUs:2619, cases:3050, tools:3480, faq:3808, finalCta:4441 } },
  375: { total: [5900,6500], starts: { hero:128, problems:1020, package:1810, services:2449, journey:3492, whyUs:4085, cases:4744, tools:5233, faq:5568, finalCta:5795 } }
};
```

各開始位置は全高差を補正した正規化比率でも比較し、±8%を許容する。PC列数とSP一列化をcomputed gridで検査する。

- [ ] **Step 2: 幾何契約を実行して正しい失敗を確認する**

Run: `npm run qa:top-geometry`

Expected: CSS未更新のため、複数ランドマークまたは列数がFAIL。

### Task 6: 共通シェルとTOP固有CSSを再構築する

**Files:**
- Modify: `v2/top-comp.css`
- Rewrite: `v2/v3-top-page.css`
- Test: `v2/tests/top-comp-geometry.mjs`
- Test: `v2/tests/v3-top-page-browser.mjs`

- [ ] **Step 1: 共通シェルの重複を除去する**

`top-comp.css` では `:root`、header/nav/footer、button、sticky CTA、focus、fade-inだけを正本とする。ファイル前半に残る旧header/hero/section/service/priceルールを削除し、TOP本文のselectorを置かない。

- [ ] **Step 2: PCレイアウトをカンプ比率で実装する**

`v3-top-page.css` はセクションごとに一度だけ定義する。コンテナ1200px、Hero 42/58%、悩み4列、パッケージの写真＋3列、サービス3列、工程5列、強み2列、実績3列、ツール2列、FAQ2列を実装する。

- [ ] **Step 3: SP専用レイアウトを実装する**

375pxではHero写真先行、悩み横長リスト、サービス横長カード、工程縦タイムライン、強み縦積み、FAQ1列とする。320pxでも本文14px以上、操作領域44px以上、横スクロールなしを保つ。

- [ ] **Step 4: 4pxグリッドとコントラストを点検する**

margin/padding/gapは `0/4/8/12/16/20/24/32/40/48/64/80/96` またはカンプ実測tokenだけを使用する。オレンジ背景の文字は`--orange-ink`、ティール文字は白背景で4.5:1を満たす濃色tokenに限定する。

- [ ] **Step 5: 幾何とブラウザ契約をGREENにする**

Run: `npm run qa:top-geometry; npm run qa:top-browser`

Expected: 1280/375の全高・ランドマーク・列数、320/375/768/1280の横スクロール、FAQ、ナビ、reduced-motionがPASS。

- [ ] **Step 6: HTML/CSS再構築をコミットする**

```powershell
git add -- v2/index.html v2/top-comp.css v2/v3-top-page.css v2/tests/top-comp-contract.mjs v2/tests/top-comp-geometry.mjs v2/tests/verify-v2.mjs
git commit -m "feat: V3 TOPを承認カンプの構図で再制作"
```

### Task 7: 画像比較をRED→GREENにする

**Files:**
- Create: `v2/tests/top-comp-visual-diff.mjs`
- Modify: `package.json`
- Create: `v2/qa-screenshots/index/comp-diff-1280.png`
- Create: `v2/qa-screenshots/index/comp-diff-375.png`
- Test: `v2/tests/top-comp-visual-diff.mjs`

- [ ] **Step 1: 低解像度グリッド比較テストを書く**

Playwrightのcanvasで参照と実装を24×96セルに縮小し、各セルの平均RGB、輝度、Sobel相当の隣接差を計算する。正規化MAE 0.22以下、主要ランドマーク誤差8%以下を要求する。

- [ ] **Step 2: 厳しい仮しきい値でREDを確認する**

Run: `node v2/tests/top-comp-visual-diff.mjs --threshold 0.05`

Expected: 写真・文字差を含むためMAE超過でFAILし、比較機能が実際に差を検出する。

- [ ] **Step 3: 設計済みしきい値でGREENにする**

Run: `node v2/tests/top-comp-visual-diff.mjs`

Expected: MAE 0.22以下、ランドマーク8%以下、比較画像2枚が生成される。

- [ ] **Step 4: npm scriptsへ組み込む**

`qa:top-visual` を追加し、`qa:all` のTOP geometry直後に実行する。

- [ ] **Step 5: 視覚テストをコミットする**

```powershell
git add -- package.json v2/tests/top-comp-visual-diff.mjs v2/qa-screenshots/index/comp-diff-1280.png v2/qa-screenshots/index/comp-diff-375.png
git commit -m "test: 承認カンプとの画像差分ゲートを追加"
```

### Task 8: 全QAと目視確認を行う

**Files:**
- Update: `v2/qa-screenshots/index/1280.png`
- Update: `v2/qa-screenshots/index/375.png`
- Test: all QA scripts

- [ ] **Step 1: 375/1280スクリーンショットを生成する**

Run: `node v2/tests/v3-top-page-browser.mjs`

Expected: `v2/qa-screenshots/index/375.png` と `1280.png` が更新される。

- [ ] **Step 2: カンプ・実装・差分画像を目視する**

確認対象はHero比率、悩み4件、主力帯、3サービス写真比率、工程、代表＋強み、実績、ツール、FAQ2列、最終CTA、SPの積み順。相違がしきい値内でも構図が違えばCSSを修正し、再撮影する。

- [ ] **Step 3: 契約・ブラウザ・クロスブラウザ・axeを実行する**

Run:

```powershell
npm run qa:verify
npm run qa:comp-contracts
npm run qa:lower-pages-contract
npm run qa:lower-pages-browser
npm run qa:top-browser
npm run qa:top-geometry
npm run qa:top-visual
npm run qa:cross-browser
npm run qa:axe
```

Expected: すべてexit 0、axe違反0、Chromium/Firefox/WebKitで横スクロールなし。

- [ ] **Step 4: Lighthouseと総合QAを実行する**

Run: `npm run qa:lighthouse-contract; npm run qa:lighthouse; npm run qa:all`

Expected: 対象ページのPerformance/Accessibility/Best Practices/SEOがすべて90以上、総合QA exit 0。

- [ ] **Step 5: 最適化と差分点検を行う**

Run:

```powershell
rg -n "console\.log|alert\(|confirm\(|prompt\(|style=|v3-(hero|package|service|representative).*\.jpg" v2/index.html v2/top-comp.css v2/v3-top-page.css
git diff --check
git status --short
```

Expected: 使い捨てログ・alert系・インラインstyle・TOPのAI生成画像参照ゼロ、diff check exit 0、対象外ファイルなし。

### Task 9: レビュー用PRを更新し記録する

**Files:**
- Create or Update: Obsidian `01_Projects/zatuneya-hp/HP-v3-要件定義_2026-08-30.md`
- Review: `origin/main...HEAD`

- [ ] **Step 1: 最終差分をセルフレビューする**

設計書の受け入れ基準11項目を1行ずつ照合し、未達があればコミット前に修正する。

- [ ] **Step 2: 最終コミットを作成する**

```powershell
git add -- docs v2 tools package.json
git diff --cached --check
git commit -m "fix: 承認カンプとの視覚差を解消"
```

- [ ] **Step 3: ブランチをpushしてPR #14を更新する**

Run: `git push origin codex/v3-lower-pages`

Expected: fast-forwardでpush成功。PRはopen・未マージのまま。

- [ ] **Step 4: Obsidianへ設計判断と検証結果を記録する**

記録内容は、カンプ座標、切り出し11点、TOPの10セクション化、FAQ6問、画像差分の実測MAE、全QA件数、正式写真・匿名実績・本番昇格が未完であること。

- [ ] **Step 5: PR URL・固定プレビュー・検証証拠を報告する**

PR URL、commit hash、変更ファイル、QA件数、Lighthouse最小値、axe違反数、画像差分MAE、固定コミットのraw.githack URLを列挙する。マージ・本番昇格未実施を明記する。

## Plan self-review

- Spec coverage: パーツ分解、PC/SP座標、画像/HTML境界、10セクション、FAQ6問、DOM契約、TDD、視覚差分、全QA、PR更新、Obsidian記録をTask 1〜9へ割り当てた。
- Placeholder scan: 実装を先送りする記述や未確定の手順はない。正式写真・匿名実績は本タスク外の既知条件としてのみ記載した。
- Type consistency: `comp-parts-contract.mjs`、`top-comp-geometry.mjs`、`top-comp-visual-diff.mjs`、npm script名、manifestの11ファイル名を全Taskで統一した。
