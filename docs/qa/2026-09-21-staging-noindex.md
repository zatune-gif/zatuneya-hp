# V3ステージング検索除外 QA（2026-09-21）

PR #14を親とするstacked branch `codex/v3-staging-noindex`。本番ルート、robots.txt、sitemap、CNAME、親gitlinkは変更しない。

## 設計

- v2直下の16 HTMLは各headに`<meta name="robots" content="noindex,follow">`をちょうど1つ置く。404は従来`noindex`から統一。本文・canonical・OGP・画像は不変。
- 通常QAサーバーと配信HTMLではnoindexを保持する。`--promotion-readiness`指定時だけlocalhost QAレスポンスからmetaを除く。これは将来の本番昇格後を予測するローカル監査であり、実配信SEO値ではない。
- `robots.txt`でv2をDisallowしない。クローラーがページを取得してnoindexを読める必要がある。noindexはアクセス制限ではない。
- 公開時の手順として、正式素材・本文確認後にこのmetaを全対象から除去し、本番契約でnoindexゼロを確認する。今回のPRでは公開切替を行わない。

## 実測

- `npm run qa:staging-noindex`: 16 HTML × 静的・通常配信・readiness応答・stacked親との差分、167 checks PASS。本文とrobots以外の内容は親HEADと一致。
- 通常配信Lighthouse（今回の最終再測定）：TOP mobile/desktop Perf・A11y・BP 1.00 / SEO .66。services mobile Perf .99 / A11y・BP 1.00 / SEO .63、desktop Perf・A11y・BP 1.00 / SEO .63。SEO低下は`is-crawlable`のみ。他の重み付きSEO監査の部分失敗も拒否する。
- 本番昇格readiness（localhostのみ）：TOP mobile/desktopは全4指標1.00、services mobile Perf .99・他1.00、desktop全1.00。実配信SEOスコアと混同しない。
- 既存回帰：verify-v2 581、各comp契約51/116/237/139/212、lower-page契約487、Lighthouse構造契約PASS。
- `npm run qa:all`は通常権限でPlaywright起動が`spawn EPERM`となり途中停止。権限昇格による再実行では新契約167 checksまでPASSしたが、既に検証済みの全ページbrowser等の重複実行を避けるため中止した。したがって今回の差分で`qa:all`全完走とは報告しない。

## 最適化と保留

追加のproduction JavaScript/CSSなし。QA内のconsole出力は測定結果の意図的診断。インラインstyle、alert/confirm/prompt、秘密情報の追加なし。正式写真、匿名実績、法務・料金・FAQ本文、本番昇格は別途公開前確認に留保する。
