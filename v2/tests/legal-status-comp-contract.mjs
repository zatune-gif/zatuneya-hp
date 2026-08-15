// Contract test for the legal-status page group (privacy / tokusho / thank-you / 404).
// Comp source of truth: 00-01_han-ai/design-comps/zatuneya-hp/legal-status-desktop.png / legal-status-mobile.png
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };

const cssPath = join(root, 'legal-status-comp.css');
check(existsSync(cssPath), 'legal-status-comp.css exists');
const css = readFileSync(cssPath, 'utf8');
check(css.includes('.legal-hero'), 'legal-status-comp.css defines the legal/status hero block');
check(css.includes('.status-band'), 'legal-status-comp.css defines the dark status CTA band');

const pages = {
  'privacy.html': {
    headings: ['プライバシーポリシー', 'LEGAL / 安心してご利用いただくために'],
    bodyTokens: ['個人情報の取扱い', '事業者について', '第三者提供', 'zatuneya@gmail.com'],
  },
  'tokusho.html': {
    headings: ['特定商取引法に基づく表記', 'LEGAL / 安心してご利用いただくために'],
    bodyTokens: ['販売業者', '運営統括責任者', '支払方法', 'キャンセル・返品について'],
  },
  'thank-you.html': {
    headings: ['送信が完了しました', 'STATUS / ページ状態'],
    bodyTokens: ['3営業日以内', 'トップへ戻る', '無料相談'],
  },
  '404.html': {
    headings: ['ページが見つかりません', 'STATUS / ページ状態', '404'],
    bodyTokens: ['トップへ戻る', '無料相談'],
  },
};

for (const [page, spec] of Object.entries(pages)) {
  const path = join(root, page);
  check(existsSync(path), `${page} exists`);
  const html = readFileSync(path, 'utf8');

  check(/<html lang="ja">/i.test(html), `${page} declares Japanese`);
  check(
    html.includes(`rel="canonical" href="${origin}${page}"`),
    `${page} has the V2 canonical URL`
  );
  check(!/style\s*=/.test(html), `${page} adds no inline styles`);
  check(html.includes('legal-status-comp.css'), `${page} loads the dedicated page-group stylesheet`);
  check(html.includes('top-comp.css'), `${page} loads the shared TOP comp stylesheet`);
  check(html.includes('<script src="./nav.js" defer></script>'), `${page} includes nav.js`);
  check(html.includes('class="comp-header"'), `${page} reuses the confirmed TOP header block`);
  check(html.includes('class="comp-footer"'), `${page} reuses the confirmed TOP footer block`);
  check(html.includes('© 2026 ざつね屋'), `${page} shows the 2026 copyright notice`);
  check(!html.includes('style.css'), `${page} no longer links the legacy shared stylesheet`);

  for (const heading of spec.headings) {
    check(html.includes(heading), `${page} contains comp heading text: ${heading}`);
  }
  for (const token of spec.bodyTokens) {
    check(html.includes(token), `${page} preserves existing body copy: ${token}`);
  }

  for (const match of html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
    check(existsSync(join(root, match[1].replace(/^\.\//, ''))), `${page} local reference exists: ${match[1]}`);
  }
}

console.log(`PASS ${checks} legal-status comp contract checks`);
