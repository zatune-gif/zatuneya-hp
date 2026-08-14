# AGENTS.md

## 応答

ユーザーへの応答は敬語で行う。

## プロジェクト

ざつね屋のWebサイト。静的HTML/CSS/JavaScriptをGitHub Pagesで公開する。

- 公開URL: https://zatune-gif.github.io/zatuneya-hp/
- AI活用診断: Netlify版 https://han-ai-diagnosis.netlify.app/ は統一先候補かつ主要CTA。GitHub Pages版との混在は既知の不整合であり、別タスクで正式な統一方針を決める。

## 役割

- Codex: HPの開発、保守、コード確認、デザインレビュー、改善の主担当。
- Claude Code: 親プロジェクト「暮らしの土台」と、ざつね屋事業全体の統括・整合確認。
- ChatGPT: デザイン検討、デザインカンプ、コピー案、全体ディレクション。
- 事業内容・親子関係の最終判断はClaude Code側の方針を優先し、HP実装・品質判断はCodexが担う。方針が両立しない場合はユーザーが最終判断する。
- 恒久ルールの正本は本ファイル、実装履歴はGit、長期的な設計判断はObsidianに残す。

## Git運用

- 通常変更はmainで進めてよい。
- サービス内容、価格、ブランド、外部ツール接続、URL・公開方式、親リポジトリ構成の意味または契約を変え、複数ページ・他ツール・親プロジェクトへ影響する変更を大規模変更とする。大規模変更は`codex/...`ブランチまたはworktreeを使い、Claude Codeが差分と検証結果を確認できる状態にしてから統合を判断する。誤字修正や単一ページ内の軽微なリンク修正は通常変更として扱う。
- 作業前にサブモジュールと親リポジトリ双方の`git status`を確認する。
- 他者の未コミット変更を上書き、復元、削除しない。無関係な変更をステージしない。
- 完了時は、`zatuneya-hp`でcommit/pushした後、親リポジトリのgitlinkをcommit/pushする。

## サイト構成

- 公開トップの正本は`index.html`。
- `index-v2.html`は改善候補。トップを変更する前に、両方へ反映するか、v2を昇格するか、一方だけを変更するかを判断する。
- 主要なサイト構成はHTML群、`style.css`、`nav.js`、`assets/`。HTMLの対象は作業時に`rg --files -g '*.html'`で列挙する。
- `nav.js`は`#nav-hamburger`、`#site-nav`、`.site-nav__dropdown-trigger`、`.fade-in`、`#sticky-cta`をDOM契約として利用する。
- ヘッダー、フッター、CTA、著作権、診断リンクを変更するときは、列挙した全HTMLを機械的に照合する。

## デザイン・実装制約

- 背景`#EFF4F5`、ティール`#5BBDC8`、オレンジ`#F8981D`。
- フォントはRoboto + Noto Sans JP。
- 絵文字アイコンは禁止し、SVGモノラインを使う。
- 一般的なイメージ写真は顔を判別できない構図とする。代表者プロフィール写真は例外。
- 新規のインラインstyleは禁止する。既存のページ内`<style>`や既存不整合の整理は別タスクとし、新たに悪化させない。
- `alert`、`confirm`、`prompt`は禁止する。
- 著作権表記は`© [年] ざつね屋`。

## 検証

- HTML/CSS/JavaScript/assetsを変更した場合は、Playwrightで375px、768px、1280pxを確認し、表示崩れと横スクロールがないことを確認する。
- 内部リンク、canonical、sitemap、著作権年、メタタグ、OGPを確認する。
- axe等によるアクセシビリティ確認を行う。Lighthouseは`index.html`と変更ページをモバイル／デスクトップで測定し、Performance、Accessibility、Best Practices、SEOを各90以上とする。レイアウト・ナビゲーション変更時はChromium、Firefox、WebKitで確認し、その他の変更はChromiumを必須とする。
- `git diff --check`を実行し、変更対象が依頼範囲内であることを確認する。
- `AGENTS.md`や`CLAUDE.md`だけの変更ではサイト表示検証は不要。
- 完了前に設計判断と次回参照事項をObsidianへ記録する。
