# V3承認カンプ切り出しパーツ

## 用途

このフォルダは、承認カンプ `v3-top-page-comp.png`（722×2178px）を座標で切り出した再制作用パーツです。生成AIで作った代替写真ではなく、ユーザーが承認したカンプの画面内画像をそのままPNGとして保存しています。

## 重要な制限

- すべてスクリーンショット由来の低解像度画像です。PCで拡大すると輪郭や細部がぼけます。
- 本番用の正式写真ではありません。代表者写真を含め、正式素材の提供後に差し替えます。
- 代表者画像は本人確認済みの写真ではなく、カンプ上の仮画像です。
- 匿名実績の本文も仮データのため、この状態ではV3 TOPを本番へ昇格しません。

## 表示に使う7点

| ファイル | 原寸 | 用途 |
|---|---:|---|
| `hero-desktop.png` | 316×229 | PC Hero（焼き込み文字のない写真部分） |
| `hero-mobile.png` | 109×86 | SP Hero |
| `package-dashboard.png` | 149×124 | 主力パッケージ |
| `service-training.png` | 162×103 | AI実務研修 |
| `service-design.png` | 162×103 | 個別業務設計 |
| `service-support.png` | 177×103 | AI活用伴走 |
| `representative.png` | 185×171 | 代表者枠の仮画像 |

## 比較・再構築の参照だけに使う4点

| ファイル | 用途 |
|---|---|
| `comp-desktop-reference.png` | 1280px実装との視覚比較 |
| `comp-mobile-reference.png` | 375px実装との視覚比較 |
| `logo-reference.png` | ロゴマークをinline SVGで再構築するための輪郭参照 |
| `tool-icons-reference.png` | 無料ツールのモノラインSVGを再構築するための輪郭参照 |

参照用4点をHTMLへ埋め込んではいけません。見出し・本文・料金・ボタン・アイコンは、拡大可能で読み上げ可能なHTML/CSS/inline SVGとして実装します。

## 再生成

親リポジトリの正本から、次のコマンドで同じ結果を再生成できます。

```powershell
& 'C:\Users\ooto\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\crop-v3-comp-parts.py `
  --source '..\..\..\design-comps\zatuneya-hp\v3-top-page-comp.png' `
  --output 'v2\assets\comp-parts'
```

座標と各PNGのSHA-256は `manifest.json` が正本です。
