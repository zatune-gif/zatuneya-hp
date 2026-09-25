# HP公開物とCIの設計提案（2026-09-24）

状態：HP公開物パッケージとHP用PR CIは2026-09-24にユーザー承認済み。ローカル実装・検証の記録は`docs/qa/2026-09-24-publication-package.md`。PRマージ、本番公開、診断ツール側の変更はこの承認に含まれない。

## 目的と変更境界

GitHub Pagesで現在配信しているルートページと`v2/`のURL、HTMLが参照する素材、見た目を保持したまま、開発資料と検証成果物を公開アーティファクトから除外する。PRの検証をCIに追加する。掲載文、料金、法務、FAQ、正式画像、HTML/CSSのデザイン変更、canonical変更、`noindex`解除、本番への昇格は対象外とする。

## 現状

- HPの`.github/workflows/pages.yml`は`main`へのpushで`actions/upload-pages-artifact@v3`の`path: .`を公開する。ルートには現行公開HTML、CSS、JavaScript、`assets/`、`robots.txt`、`sitemap.xml`、`.nojekyll`があり、`v2/`には次期ページとその素材がある。同じ公開アーティファクトに`docs/`、`v2/tests/`、`v2/qa-screenshots/`も入る。
- HP公開物作業の開始時PR #14のHEADは`c522593b0ea685ef54757f7b04668ac5acba432d`。PR #15はPR #14をbaseとするstacked PRで、HEAD `bd7cf19b663410f9d2326670b7a10f30b5b6c56b`の`v2/`直下16 HTMLに`noindex,follow`を追加する。PR #14だけを`main`へマージすると、Pagesが`v2/`を検索可能な状態で直ちに公開するため、実装ではアップロード前に16 HTMLのnoindex gateを追加した。
- HPの`npm run qa:all`はリポジトリ内のカンプ画像とQA画像を相対パスで参照し、実行中に`v2/qa-screenshots/index/`の画像を更新する。ブラウザ検査、Lighthouse、画像比較には日本語フォントとChromeの実行環境が影響する。
- 診断ツールの`netlify.toml`は`publish = "."`、`functions = "netlify/functions"`。`index.html`は`diagnosis-simple.html`へのリダイレクトを担い、3つのFunctionは`@anthropic-ai/sdk`、`googleapis`、`nodemailer`を使用する。診断ツールの公開物変更はHPとは別段階で扱う。

## 選択肢と採用案

1. **採用案：配布専用ディレクトリを生成する。** Pagesワークフローでルートと`v2/`の公開ファイルを元の相対パスのままコピーし、`upload-pages-artifact`の`path`だけ生成ディレクトリへ向ける。コピー対象は、既存のルート公開HTML/CSS/JavaScript、favicon、`robots.txt`、`sitemap.xml`、`.nojekyll`、`assets/`、および`v2/`内の公開HTML/CSS/JavaScript、favicon、`.nojekyll`、`assets/`とする。`docs/`、`tools/`、`v2/tests/`、`v2/qa-screenshots/`、README・AGENTS・CLAUDE・package関連ファイル、`node_modules/`を静的公開物へ入れない。PR #15のHTMLをバイト変更せずコピーして`noindex`を保持する。
2. 現行の`path: .`を維持して除外リストを適用する案は、今後追加される資料の除外漏れが公開事故につながるため採用しない。
3. `v2/`だけを公開する案は、既存ルートの公開ページとURLが消えるため採用しない。

生成物の検査は配布前に行う。上記コピー対象のルート・`v2/`公開ファイル集合を基準に、既存ルート公開ファイルの欠落が0件であること、含めた各ファイルが原本とバイト一致すること、公開HTML/CSS/JavaScriptの全ローカル参照が生成物内で解決することを確認する。`docs/`、`tests/`、`qa-screenshots/`および開発用ファイルが生成物にないこと、PR #15を含む状態では`v2/`直下16 HTMLすべてに`noindex,follow`が1件ずつ残ることも検査する。いずれかが失敗したらアップロードとデプロイを実行しない。

## HPのCIと公開ゲート

Pagesのデプロイワークフローとは別に、PR用CIを設ける。`pull_request`のbaseを`main`と`codex/v3-lower-pages`に限定し、Node 22を使う`windows-latest`で`npm ci`、PlaywrightのChromium・Firefox・WebKit導入、Chrome実行パス確認、`npm run qa:all`、生成物検査を順に実行する。このCIはPagesへアップロード・デプロイしない。日本語のシステムフォント差が幾何検査と画像比較に影響するため、Ubuntuへの移行は同じフォント・ブラウザ条件で実測してから判断する。LighthouseのChrome自動検出に失敗する場合は`CHROME_PATH`をCIで明示する。

`v2/qa-screenshots/`はQAで更新され得るが、公開生成物へコピーしない。PR #14のみを`main`にマージしない。PR #15をPR #14に畳むか、`noindex`付き変更を同時に反映できる手順を確認してから昇格する。PR #15がない状態で`noindex`検査を通す例外を本番公開に設けない。PR #15のステージング`noindex`を外す将来の公開判断と、現行のGitHub Pages固定canonicalの変更は別途設計・承認する。

## 診断ツールへの適用範囲

親リポジトリで診断ツールのCIを追加する場合は、`pull_request`の対象パスを`00-01_han-ai/13_ai-diagnosis-tool/**`とCIワークフロー自身に限定する。`ubuntu-latest`、Node 22、対象ディレクトリでの`npm ci`、`npx playwright install --with-deps chromium firefox webkit`、`npm test`を候補とする。現在の279項目には3ブラウザ試験と`127.0.0.1`へのSMTPソケット試験が含まれる。Linuxでの成功は未実測なので、初回CIで確認する。

診断ツールの`publish = "."`を生成ディレクトリへ変更する案は別段階とする。行う場合は`index.html`を含む全公開HTML・CSS・JavaScript・画像・`robots.txt`・`sitemap.xml`を同じ相対パスで保持し、Functionの3 JavaScriptと依存パッケージのビルド経路を残す。Deploy Previewで3 Functionの起動と既存URL・フォーム経路を確認できなければ本番へ反映しない。

## 未確定事項と停止条件

HPのWindows CIで`qa:all`が安定して通るか、生成物と上記コピー対象の公開URL集合が完全一致するか、診断ツールのLinux CIとNetlify Functionsが動くかは未実測である。失敗時は閾値の緩和や検査の無効化をせず、原因を特定して設計を再確認する。掲載内容と正式画像の公開前確認、PR #14/#15の反映手順、`noindex`解除、canonical、本番公開には別途ユーザーの判断と承認が必要である。
