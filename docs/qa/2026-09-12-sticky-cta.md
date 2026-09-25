# 追従診断CTAの仕上げ（2026-09-12）

対象は `zatuneya-hp` の `codex/v3-lower-pages`、レビュー先は [PR #14](https://github.com/zatune-gif/zatuneya-hp/pull/14) です。本番昇格・main統合・親リポジトリgitlink変更は対象外です。

## 変更と判断

- TOPと下層の計16HTMLで共通の白い浮遊ドックに統一しました。PC最大幅680px、SP左右16px・下16px以上、端末safe areaを考慮します。閉じる操作領域44px、SPの診断ボタン48px以上を維持します。
- 補助文は「AI活用の準備度を確認できます。」、ボタンは「無料で診断する」。320pxでも補助文が1行に収まることをテストします。
- Hero内の診断CTA（存在しないページでは先頭section）が画面外に出てから表示します。最終CTA・フッター・ナビ／ドロップダウン展開中・フォーカス対象との重なりでは一時非表示にします。本文末尾の追加余白は廃止しました。
- 一時抑制には `visibility:hidden` を使用します。矩形を保つことで、フォーカス重なり判定が表示／非表示を往復することを防ぎます。
- 閉じる操作は `sticky-cta-closed=1` をセッション保存します。ストレージ拒否時にもそのページでは閉じられ、BFCache復帰時には別ページで保存された閉状態も反映します。イベントとMutationObserverは離脱時に解除し、復帰時に重複なく再登録します。
- 診断URLは16ページ各1個のmetaと `data-diagnosis-link` 委譲を維持しました。

## 検証記録

- `npm run qa:sticky-cta`：16ページのmarkup契約、320/375/390/430/768/1280/1440の7幅、表示抑制・フォーカス・閉状態の保存がPASS。
- `npm run qa:verify`：533項目PASS。`qa:lower-pages-contract`：465項目PASS。
- `qa:comp-contracts`：TOP 50逐語項目、works/profile 157、services 281、faq/contact 123、legal/status 182項目と下層13ページ×3幅がPASS。
- `qa:cross-browser`：Chromium／Firefox／WebKit×375/768/1280の9組がPASS。
- `qa:lower-pages-browser`：811項目PASS。続く900px負例追加後は `--interactions-only` で該当18項目を限定再実行しPASSしました。旧「中盤へスクロール」テストは900px高でHeroまたは終端CTAが視野内に残り、正しく非表示になるため失敗していました。900pxの競合CTA可視矩形をassertする負例を維持し、別途700px高で表示・閉じる正例を検証します。
- `qa:top-browser`：4幅、キーボード、ストレージ拒否、BFCacheイベント模擬、reduced-motionがPASS。
- 独立した3ブラウザ再現検証：ドロップダウン開閉、BFCacheイベント模擬後の監視再開、別ページでの閉状態保存について計21チェックPASS。
- 代表axe：TOP／services／growth×375/1280×中盤／フッターの12スキャンでWCAG 2/2.1 A/AA違反0。バナーを実際に表示した状態も含みます。
- 文字コントラスト：ティール `#31747C`／白＝5.36:1、補助文 `#49676D`／白＝6.10:1、ボタン `#332211`／`#F8981D`＝6.90:1、hover／`#F4AF48`＝8.04:1。
- 新しいドックの余白値は4/8/12/16/20/24/32/48pxの4pxグリッドです。safe areaは端末値との最大値を使います。
- 最適化確認：新規インラインstyle、使い捨てconsole.log、alert/confirm/prompt、秘密情報、コメントアウトされた死にコードはありません。テストの実行結果ログは意図した診断出力です。API返り値構造の変更はありません。

## 目視証跡

rootレビューで320px補助文1行、閉じる／診断ボタン配置、375pxフッターの余計な帯・底余白がないことを確認しました。

- `v2/qa-screenshots/sticky-cta/320-mid-scroll.png`
- `v2/qa-screenshots/sticky-cta/375-footer-hidden.png`
- `v2/qa-screenshots/sticky-cta/1280-mid-scroll.png`
- 同ディレクトリに375/390/430/768/1440の中盤スクリーンショットも格納しています。

## 未検証・後続

BFCacheはイベント模擬で検証しており、実端末の履歴キャッシュ採用は未検証です。端末safe areaも実機未検証です。今回Lighthouseは再測定していません。正式写真・匿名実績への置換と本番昇格は別タスクです。
