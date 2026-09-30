# 下層V3実装計画

> **For agentic workers:** executing-plansを用い、代表ページ目視と最終目視の2ゲートを守る。

**Goal:** 最新確定内容をV3下層意匠へ反映し、旧サービスを未公開v2から除去する。
**Architecture:** root本文は参照のみ。v2外枠はTOP、本文は.lp-*部品を再利用。診断本体13番は別担当・別scope。
**Tech Stack:** HTML/CSS、Node assert、Playwright、axe、既存Lighthouse。

## 1. 代表ページ

- [x] `v2/tests/lower-pages-current-copy.mjs` を先に追加し、managementの最新単一プラン・本文とV3外枠を確認。旧v2でFAILを実測する。
- [x] `v2/service-management.html` を最新root本文で組み直し、`lower-page-template.css` に必要最小の.lp-*リスト/2列部品を追加。
- [x] `node v2/tests/lower-pages-current-copy.mjs service-management.html` をPASSへ。375/1280スクショ・axe・ナビを実測しroot目視ゲートへ。

## 2. 他ページと旧導線

- [x] services/training/banso/profile/worksは最新rootコピーで構造を組む。FAQ/法務/contact/thank-you/404は既存機能・法務文言を保持して外枠と本文意匠だけ整合。growth/toolsは確定本文を維持する。
- [x] TOPの旧orderカードを経営改善へ置換、研修5コースと3現役サービスを一致させる。全v2実HTMLからorder導線を除去し、order本体を削除。
- [x] 既存comp-contract、lower-pages-v3-contractの旧13DOMハッシュ、fixtureとQA各inventoryを新本文／14下層構成へ更新。旧サービス不在とroot正本コピーを契約で固定する。

## 3. 検証と反映

- [x] 全ページ静的・3幅・3ブラウザ・axe、代表Lighthouse、テンプレート回帰を実行。共有CSS/JSの重複とroot不変更を確認。
- [x] 目視画像・実測数・既知制限をrootへ渡して最終承認済み。docs/Obsidian記録とレビュー用commit/push/PR14更新へ。親gitlink・merge・本番は変更しない。


## 最終確認

実装とroot目視ゲートは完了。合格/既存TOP寸法未達3件/WebKit環境制限2件は [実測記録](../../qa/2026-09-15-lower-pages-v3.md) に分離。Git反映の最終状態はPR14のコミット履歴を参照し、mainへの統合はClaude Codeが別途判定する。
