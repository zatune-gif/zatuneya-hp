# 下層ページのデザインテンプレート

まず [デザイン見本](../../v2/lower-page-template.html) を確認してください。写真・カード・料金・進め方・FAQ・問い合わせ導線を、実際のページの流れで確認できます。

## STEP 1：コピーする

`v2/lower-page-template.html` を **同じv2フォルダー** に別名で複製します。既存の実ページは上書きしません。`lower-page-template.css` は共用できます。ページ固有の変更が必要なら別名でCSSを複製し、HTMLのlinkを更新してください。共通外枠は `top-comp.css`、動作は `nav.js` が担当します。

## STEP 2：本文を差し替える

各部品は `<!-- PART: 名前 -->` から `<!-- END PART: 名前 -->` までです。不要な部品はまとまりで削除します。見出しはh1を1個にし、h2→h3の階層を保ってください。参照されるidやaria-controlsも合わせて確認します。

- hero：ページ見出し・短い紹介・CTA。冒頭サンプル表示は実際の本文が確定した後に削除します。
- overview：写真＋文章。写真は既存の仮素材です。正式素材のsrc・alt・実寸width/heightを更新してください。
- features：PCは3列、900px以下は1列です。2列が必要なら `class="lp-card-grid lp-card-grid--two"` を使います。枚数だけ減らしても列数は自動で変わりません。見出しの意味単位改行には `.lp-title-part`、箇条書きには `.lp-list` を共用できます。
- pricing：具体的な架空金額は入れていません。料金・税区分・単位・対象・含む作業・除外条件を事実確認して記載します。
- process：実際の進行順を記載します。番号と部品数を揃えてください。
- questions：FAQ本文と回答を差し替えます。buttonのaria-controlsと回答のidはページ内で一意にします。
- final-cta：問い合わせ導線。フォーム送信は実装しておらず、既存contactへ移動します。

実績や成果、営業上の約束を捏造しないでください。追従診断の `#sticky-cta`・close、ナビのDOMフックは削除しません。本文の最初に `#hero`、末尾導線に `#final-cta` を維持すると既存の表示抑制が働きます。

## STEP 3：ページ情報とリンクを更新する

title、description、canonical、og:url/title/description/imageを新ページ用に更新します。見本の自己canonicalとog:urlを残さないでください。診断URLは `zatuneya:diagnosis-url` meta **1個** に置き、アンカーは `data-diagnosis-link` を使います。hrefへの重複直書きは避けます。

見本の `noindex,follow` は検索除外の指示であり、**非公開やアクセス制限の保証ではありません**。見本自体はnoindexを維持し、サイトナビ・sitemapに追加しません。複製した実ページも承認前はnoindexを維持します。正式公開が承認されたときだけ、その新ページのnoindexを外し、ナビ・sitemap・公開用テスト対象への追加を別途レビューしてください。

別階層に置く場合はCSS/JS/画像/各リンクの相対パスをすべて更新します。TOP内アンカーは `./index.html#journey` のようにページ名を含めます。本文内リンクの先を削除していないかも確認します。

## STEP 4：表示と操作を確認する

リポジトリルートで依存をインストール済みなら、次を実行します。

```powershell
node v2/tests/lower-page-template-contract.mjs
node v2/tests/lower-page-template-browser.mjs
```

専用テストは見本ファイルを対象にします。**複製したページは自動で検証対象になりません。** 新ページのパスを専用契約に追加し、375/768/1280pxの画像、320pxの横溢れ、ナビ・FAQ・追従診断・リンク先・axeを確認してください。画像は `v2/qa-screenshots/lower-page-template/` に生成されます。

公開前に料金・写真・コピー・metaのサンプルが残っていないことを確認します。見本は意図的にnoindexのため、公開ページ向けLighthouse SEO判定とは分けます。エラーが表示されたら、表示された文章をそのままご連絡ください。
