# HP公開物パッケージとPR QA（2026-09-24）

対象はPR #14の`codex/v3-lower-pages`。検証実施日は2026-09-25。公開HTML/CSS/JavaScript、画像、本文、URL、CNAME、robots、sitemapは編集しない。PR #15、main、親gitlink、診断ツール、本番デプロイは対象外。

## 生成・検査の契約

- Pagesアーティファクトの入力はリポジトリ直下の固定`.pages-artifact/`。rootと`v2/`の公開ファイルを相対パスとバイトを変えずにコピーする。rootの`index-v2.html`、両階層の`.nojekyll`、既存favicon、rootの`robots.txt`と`sitemap.xml`を保持する。`tools/publication-files.txt`で83ファイルを明示許可し、HTML31件は必須として実在を検査する。新しいHTML・画像・PDF・フォントなどはレビューして一覧を更新するまでビルドを止める。
- `assets/`と`v2/assets/`も明示一覧のファイルだけ保持する。既存の`v2/assets/comp-parts/README.md`、`manifest.json`、未参照の比較カンプ画像4枚は内部資料として配信しない。symlink、リンク経由の生成先、広域削除につながる出力先は拒否する。rootや`v2/`直下の資料、tests、QAスクリーンショット、node_modules、package関連ファイルはコピーしない。
- 元と生成物のファイル集合・バイト一致、公開HTML/CSSから抽出した相対`href`/`src`/`srcset`/`poster`/`action`/CSS `url()`/meta refreshを検査する。fragment、外部HTTP(S)、mailto等の別schemeはローカルファイルとして数えない。既存の配信用JavaScriptには追加のローカルファイル取得がないことを調査した。将来の動的参照はこの抽出だけでは網羅できないため、生成物上の代表ブラウザ通信検査でも確認する。Windows上でも大文字小文字の違う参照は集合比較で失敗する。
- PR #14にはv2の全ページへ`noindex,follow`を付ける差分がない。ビルダーはHTMLをバイト一致でコピーし、fixtureではnoindexが消えたら失敗する。さらにPages workflowに専用gateを置き、v2直下16 HTMLのrobots meta各1件が`noindex,follow`でなければupload前に失敗させる。これはPR #14単独マージによる検索可能なv2公開を防ぐため、設計文書の運用注意をコードで強制する措置である。PR用CIのbuildにはこのgateをかけず、PR #14の比較を可能にする。noindex解除は別判断。
- gateはHTMLコメントとscript/style内を除いた`head`内のmetaだけを数える。コメントだけ、bodyだけ、重複metaを故障fixtureで検出する。PR #15の別worktreeは読取のみでv2直下16/16 HTMLのhead内`noindex,follow`を確認した。PR #15をこのbranchへ統合・コピーする操作は行っていない。

## 実測

`npm run qa:publication-test`: 13件PASS。未実装ビルダー、参照欠落、meta refresh欠落、漏洩ファイル、noindex改変、symlink、未承認HTML/素材、必須ページ欠落、危険な削除先、noindex gate、内部比較カンプの漏洩を失敗fixtureで確認後、実装を通した。

`npm run publication:build`: 83ファイル、HTML31ファイル、HTML/CSS抽出ローカル参照836件。明示した公開URL集合の欠落0、追加0、バイト差分0。`docs/`、`v2/tests/`、`v2/qa-screenshots/`、packageファイル、assets内のREADME/manifest/比較カンプ4枚は出力しない。PR #14の生成物に対するPages専用staging gateは期待どおりFAIL（v2/404.htmlのrobotsは`noindex`のみ）し、uploadへ進まない。

`npm run qa:publication-browser`: 明示manifest導入後の83ファイルでChromiumを再実行し、rootのTOP/旧TOP/contact/orderリダイレクトとv2のTOP/services/contact、幅375/768/1280の21セルでHTTP200・ローカルリソース失敗0。外部GoogleフォームやGoogle Fontsの通信はローカル欠落として扱わない。

既存の`npm run qa:all`もWindows実行でexit 0。静的581項目、下層契約487項目、Lighthouse代表28測定は各カテゴリ0.90以上だった。この既存QA実行中に公開物の安全ガードとmanifestを更新したため、公開物については上記の最終契約13件・最終83ファイル検証・最終ブラウザ21セルを別に再実行して確認した。全QA実行で更新された追跡PNG 2件は、生成版を非公開visualizationsへSHA-256付きで退避し、開始時HEAD版へ明示的に復元した。復元後、両PNGと配信用HTML/CSS/JS/画像/robots/sitemapのGit差分は0件。

最適化確認：新規builder/test/workflowに使い捨て`console.log`、インラインstyle、`alert`/`confirm`/`prompt`、コメントアウトした死にコード、秘密情報の画面・ログ露出は0件。`console.info`は公開物検証の結果表示として意図的に保持。API返り値形式は外部APIやUIを変更していないため非該当。`git diff --check`はexit 0。実GitHub Actions、実Pages upload/deploy、外部サービスとの実通信は未検証。

PR用CIはWindows、Node 22、`npm ci`、Chromium/Firefox/WebKit、Chrome実行パス確認、`qa:all`、公開物契約、生成、生成物ブラウザを順に実行する。Pages workflowはmain push/手動起動のまま、生成後に限りアップロードする。実GitHub Actions環境、実Pagesアップロード・デプロイは未検証。フォント環境差による`qa:all`の結果は初回CIで確認し、閾値は緩和しない。

公式参照: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Playwright CI](https://playwright.dev/docs/ci)。
