# SP geometryとv2検索除外の事前調査（2026-09-15）

実装前の調査記録です。コード、テストassert、公開ファイルはまだ変更していません。

## 1. SPカンプと実装の比較母集団

カンプSPは `v2/assets/comp-parts/comp-mobile-reference.png`（132×2178px）。375px幅へ等比換算した全高は約6187.5pxです。実装の375px全高は8899pxです。

| 区画 | カンプSP | 実装375px | 実装高 | 差の根拠 |
| --- | --- | --- | ---: | --- |
| header | あり | あり | 81px | 共通 |
| Hero | あり | あり | 801.5px | 共通。ただし確定本文はカンプより長い |
| お悩み | 3カード | 4カード | 902.33px | カンプに4枚目がない |
| 主力パッケージ | 短縮版 | 確定詳細版 | 1308.25px | 手順・成果物・対象企業の確定本文が長い |
| サービス | 2カード | 3カード | 1736.44px | カンプに2番目のカードがない |
| 進め方 | あり | あり＋growth導線 | 750.23px | growth導線追加で全高が62px増加 |
| 強み | なし | あり | 624.28px | 実装のみ |
| 実績 | なし | あり | 904.73px | 実装のみ |
| 無料ツール | なし | あり | 589.05px | 実装のみ |
| FAQ | なし | あり | 619.28px | 実装のみ |
| 最終CTA | あり | あり | 320.38px | 配置位置は異なる |
| 通常footer | なし | あり | 261.67px | 実装のみ |

実装だけに存在する強み・実績・無料ツール・FAQ・footerは合計約2999pxです。カンプ換算全高と実装の差約2711.5pxを単なる余白超過として扱うことはできません。現在の`top-comp-visual-diff.mjs`のscore 0.1748は、両方の**全ページ画像**を同じ比較キャンバスへ縮小して24×96点で色・輪郭を評価した値であり、section normalizedではありません。代替テストの合格根拠には流用しません。

## 2. 品質ゲート変更案（承認前・未実装）

全ページ比較から区画別geometryへ移すのは品質ゲート自体の変更です。旧assertは先に削除せず、新ゲートを追加して赤→緑と目視を確認した後に置換可否を再判断します。

| 観点 | 現行 | 変更案 | 保持する数値・契約 |
| --- | --- | --- | --- |
| 全高 | 375pxを7200〜8200pxに制限 | 情報量が異なるため合否から外し診断値として記録 | 8899px、カンプ換算6187.5px、実装のみ5区画約2999px |
| visual aspect | 全ページ同士、上限40% | 共通5区画を個別に切り出し各々を独立正規化 | 現行43.82%は診断値。閾値は承認画像の実測後に新規固定 |
| visual score | 全ページ24×96点、上限0.22 | 共通5区画ごとに新規score | 現行0.1748は全ページ値なので流用しない |
| problems/package高 | 860／1260px以下 | 絶対高ではなく内部構造・余白・可読性を検査 | 4問題、詳細3カード、本文14px以上、line-height 1.7以上 |
| レスポンシブ | 全高と主要配置 | 4幅のoverflow・左右余白・画像比・カード数・順序 | 320/375/768/1280、SP左右20px以上、1280時wrap1200px以下 |
| 操作性 | 別テスト | 区画別gateにも含め二重確認 | CTA44px以上、パッケージCTA48px以上、補足12px以上 |

区画別検査はHero（画像220〜270px・全高680〜820px）、お悩み（4枚・gap12・padding20）、パッケージ（見出し→画像→詳細、画像170px・gap/padding20）、サービス（3枚・幅335px以上・画像比162:103・gap20）、進め方（5工程＋growth導線）を対象にします。後半は強み・実績3件・無料ツール2件・FAQ6件・最終CTA・footerの存在、順序、重なりなしを別途維持します。本文削除、文字縮小、閾値緩和は行いません。

## 3. v2検索除外の別PR案（未承認・未実装）

v2直下HTMLは16ファイルです。現在は404と再利用テンプレートだけがnoindexで、残る14ファイルにはありません。GitHub Pagesでは任意の`X-Robots-Tag`レスポンスヘッダーを設定できないため、全16ファイルのheadへ同一の`<meta name="robots" content="noindex,follow">`を1個置く案が最小です。`robots.txt`で`/v2/`をDisallowするとcrawlerがnoindexを読めないため採用しません。なおnoindexは検索結果からの除外指示であり、URLを知る人のアクセスを止めるものではありません。

QAは次の2結果を分けて報告します。

- **実配信ステージング監査**：noindexを保持した通常レスポンスでLighthouseを実行。Performance／Accessibility／Best Practicesは90以上、SEOはnoindexによる意図した減点を数値のまま報告し、90以上を要求しない。HTML／ブラウザ契約で16/16のnoindexを検証。
- **本番昇格readiness監査**：明示的に別名のQAで、ローカル応答だけnoindex行を除いた場合のSEOを含む4指標90以上を検証。「実配信SEOスコア」とは呼ばない。

| ブランチ方式 | 利点 | 注意点 |
| --- | --- | --- |
| PR #14マージ後、最新mainから新規 | 独立PRになり差分が明快 | PR #14のマージ待ち |
| 現在のPR #14 HEADからstacked branch、baseを`codex/v3-lower-pages` | 今すぐ実装・検証可能 | 親PR依存。PR #14マージ後にmainへretargetまたはrebaseが必要。先にmerge・公開不可 |

安全性とレビュー容易性では「PR #14マージ後にmainから」が第一候補です。着手速度を優先する場合のみstacked PRを選びます。どちらもroot index、CNAME、sitemap、親gitlink、main、merge、deployは変更しません。

## 4. 承認後の短い実装計画（区画別gate）

1. `v2/tests/top-comp-section-geometry.mjs`を追加し、320／375／768／1280pxで共通5区画の写真比、左右余白、カード数、並び、可読性、44px主要操作域、横overflowを検査する。故障注入引数でHero写真高を壊し、期待したREDを先に確認する。
2. 通常実装で新gateをGREENにし、既存の10区画、問題4枚、サービス3枚、後半区画の件数・順序も維持する。
3. 新gateのRED／GREEN確認後に限り、`top-comp-geometry.mjs`の母集団不一致3assert（SP全高／お悩み絶対高／パッケージ絶対高）と、`top-comp-visual-diff.mjs`のSP全ページaspect判定を診断値へ移す。全ページvisual score 0.1748は名称を変えず継続する。
4. `package.json`へ新gateを接続し、関連QAを再実行する。本文、画像、production CSSは変更しない。

### 実装記録

- 故障注入RED：文字8px、カード左右移動、Hero写真高96px、SP問題カード2列化、必須区画非表示の5種類を、それぞれ期待した契約違反として検出した。
- 故障注入の実測：`tiny-text`は320/375px本文14px契約、`remove-gutter`は4幅の左右余白契約、`image-aspect`は320/375px Hero高と768px写真優先順、`card-columns`は320/375px問題カード1列契約、`hide-section`は4幅の必須区画可視契約で、すべてexit 1になった。
- 通常GREEN：区画別gateは4幅・88 checks PASS。カンプcropはdesktop/mobileの共通5区画だけをfixture化し、文言pixel差や交換待ち写真の内容差は評価対象にしていない。許容差はfixture内に数値根拠を併記し、特にHero高は旧46pxから、低解像度境界誤差＋4pxグリッド1段に相当する12pxへ縮小した。
- 旧値の扱い：375px全高8899px、旧上限8200px、SP problems 902.33px、旧上限860px、SP package 1308.25px、旧上限1260pxは診断値として履歴に残す。SP全ページaspect 43.82%も診断値へ移す。全ページvisual score 0.1748は区画比較と改称せず、従来どおり全ページの粗い色・輪郭回帰として継続する。
- 全体回帰：`npm run qa:all` exit 0。静的581、下層契約487、下層browser992、header136、SP typography199、新geometry88、cross-browser 9、axe 60スキャン違反0、Lighthouse 28測定（Performance 0.98〜1.00、他3指標1.00）を確認した。QAが再生成したsticky CTA PNG 2点はproduction差分ではないためcommit対象から除外した。
- 最適化確認：productionコードは変更なし。追加テスト内の`console.info`はQA結果と診断値を残す意図的出力。使い捨てログ、インラインstyleのproduction混入、`alert`／`confirm`／`prompt`、死にコード、秘密情報の追加はない。
