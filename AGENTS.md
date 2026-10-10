# AGENTS.md

## 応答

ユーザーへの応答は敬語で行う。

## プロジェクト

ざつね屋のWebサイト。静的HTML/CSS/JavaScriptをGitHub Pagesで公開する。

- 公開URL: https://zatuneya.com/
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
- CTAボタン（2026-10-10 ユーザー決定・指摘）
  - 色の役割はサイト全体で固定：お問い合わせ＝オレンジ（`.btn-primary`、主）、AI診断＝ティール（`.btn-teal`、副）。濃いティール地の上のAI診断ボタンは白地＋ティール文字。2つ並べるときはお問い合わせを先にする
  - 文言も固定：お問い合わせ＝「お問い合わせ」（スマホ固定バー・ヘッダーも同じ）、AI診断＝「AI診断してみる」。診断ツールの名称は「AI活用準備度診断」
  - 呼びかけ（例「まず30分、話を聞かせてください」）は見出しが担い、ボタンで同じ文言を繰り返さない
  - 「現在地を確かめる」のような社内の言い回しをボタンに使わない。押すと何が起きるか（行き先）が初見で分かる文言にする
  - オレンジはボタン専用。ボタン以外の要素にオレンジの大きな面を使わない
- 下層ページのファーストビューは共通部品`.sub-hero`（左揃え：パンくず→英字eyebrow→h1→リード→区切り線）を使う。404・thank-youのみ中央揃え（2026-10-10 ユーザー決定）。
- 要素の大きさ・色の強さは中身の情報量に見合わせる。2〜3行の結論に、大きなアイコン・一面の強い色・大きな余白のパネルを使わない（使うなら画像など情報を伴わせる）（2026-10-10 ユーザー指摘）。
- `<button>`はiOS Safariで中身が中央寄せになる。メニュー等で左揃えにしたいときは`justify-content`と`text-align`を明示する（2026-10-10 ユーザー指摘）。
- 共通部品（`.btn`・`.btn-primary`・`.btn-outline`・フォーカスリング・`.sec-head`・`.cv-*`・ヘッダー／フッター／追従バナーの文字設定）の正本は`style.css`。各ページの`<style>`に同じ定義を再び書かない。ボタンは`white-space:nowrap`にしない（長い文言が枠からはみ出す）（2026-10-10 総チェック）。
- 日本語の折り返し：`overflow-wrap:anywhere`と`word-break:keep-all`の併用は「。」「？」だけが次行に落ちるため使わない。`line-break:strict`＋`word-break:normal`＋`text-wrap:pretty`／`balance`を使う（`style.css`末尾に全体設定あり）。
- 見出し・ボタン・キャッチ・カード見出しは文節単位で改行する。HTML側に`<wbr>`（BudouXで生成）を入れ、`style.css`末尾の`word-break:keep-all`が効く。新しい見出し・ボタン文言を足したら同様に`<wbr>`を入れる。`.btn`内はラベルを`<span class="btn__label">`で1つにまとめる（flex内では`<wbr>`が別アイテムになるため）。途中で折れやすい括弧・「〜」・文末の「。」は`.nw`／`.nwe`で囲む。`overflow-wrap:anywhere`は使わず`break-word`にする（flex／gridの最小幅が1文字に縮むため）。
- 本文の基準文字サイズは16px（`style.css`の`body`が正本。ページの`<style>`に`body`の文字設定を書かない）（2026-10-10 ユーザー決定）。
- 写真は表示幅の2倍以上の実ピクセルを用意し、`<picture>`でWebP＋JPEGを1x/2xの`srcset`で配信する。ファーストビューの画像は`fetchpriority="high"`、それ以外は`loading="lazy"`、いずれも`decoding="async"`。低解像度の写真はReal-ESRGAN（realesrgan-x4plus）で4倍にしてから使う。コードから参照のない画像は残さない（OGP・favicon・`index-v2`／`v2/`が参照するものを除く）。
- Webフォントは自サイト配信（`assets/fonts/NotoSansJP-VF.woff2`・`Roboto-VF.woff2`、可変フォント・太さ400〜900、サイトで使う文字だけに絞ったサブセット）。`@font-face`は`style.css`冒頭に集約し、Google Fontsの`<link>`・preconnectは使わない（2026-10-10）。新しいページでも`<head>`に同じ2本の`<link rel="preload" as="font" type="font/woff2" crossorigin>`（相対パス）を入れ、Google Fontsは足さない。使うウェイトは400/500/700/900。600・800は可変フォントでそのまま描画され、従来（700・900に寄っていた）と見た目が変わるので使わない。
- **文言を追加・変更したら、`python tools/build-fonts.py`（要 `pip install fonttools brotli`）でフォントを再生成し、`node tools/check-fonts.mjs --browsers=chromium,webkit`で欠字0件を確認する。** 再生成したフォント・`assets/fonts/charset.txt`も一緒にコミットする。欠字があると、その文字だけ端末の代替フォントで表示される。原本フォントは`tools/.font-cache/`（git管理外）に固定コミットから取得しSHA-256を検証する。常用漢字2136字まで入れたいときは`--jouyou`（約+400KBになるため既定では入れない）。フォントのライセンス（SIL OFL）は`assets/fonts/OFL-*.txt`。
- `service-banso.html`は孤立ページのため`noindex`（sitemap・内部リンクに入れない）。
- フォントはRoboto + Noto Sans JP。
- 絵文字アイコンは禁止し、SVGモノラインを使う。
- 一般的なイメージ写真は顔を判別できない構図とする。代表者プロフィール写真は例外。
- 新規のインラインstyleは禁止する。既存のページ内`<style>`や既存不整合の整理は別タスクとし、新たに悪化させない。
- `alert`、`confirm`、`prompt`は禁止する。
- 著作権表記は`© [年] ざつね屋`。

## 検証

- 機械チェック（はみ出し・配色・コントラスト）だけで完了にしない。スマホ幅のスクリーンショットを実際に読み、①見出しとボタンの文言が重複していないか ②初見で意味が通じるか ③要素の大きさが中身に見合っているか ④同種の部品（ファーストビュー・CV・ボタン）が全ページ同じ型か、を目視する（2026-10-10 ユーザー指摘が続いたため）。
- はみ出しは横スクロールだけでなく、要素単位（`scrollWidth > clientWidth`）・句読点だけの行・見出しの単語途中の改行も調べる。実機フォントは幅が広いので、文字1.15倍の条件とWebKitでも確認する。
- HTML/CSS/JavaScript/assetsを変更した場合は、Playwrightで375px、768px、1280pxを確認し、表示崩れと横スクロールがないことを確認する。
- 内部リンク、canonical、sitemap、著作権年、メタタグ、OGPを確認する。
- axe等によるアクセシビリティ確認を行う。Lighthouseは`index.html`と変更ページをモバイル／デスクトップで測定し、Performance、Accessibility、Best Practices、SEOを各90以上とする。レイアウト・ナビゲーション変更時はChromium、Firefox、WebKitで確認し、その他の変更はChromiumを必須とする。
- `git diff --check`を実行し、変更対象が依頼範囲内であることを確認する。
- `AGENTS.md`や`CLAUDE.md`だけの変更ではサイト表示検証は不要。
- 完了前に設計判断と次回参照事項をObsidianへ記録する。
