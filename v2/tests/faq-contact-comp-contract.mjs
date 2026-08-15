// TDD contract for v2/faq.html and v2/contact.html (faq-contact camp implementation).
// Run: node v2/tests/faq-contact-comp-contract.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };

// ── Shared files ──
check(existsSync(join(root, 'faq.html')), 'faq.html exists');
check(existsSync(join(root, 'contact.html')), 'contact.html exists');
check(existsSync(join(root, 'faq-contact-comp.css')), 'faq-contact-comp.css exists');
check(existsSync(join(root, 'top-comp.css')), 'top-comp.css exists (shared, must not be edited)');
check(existsSync(join(root, 'nav.js')), 'nav.js exists (shared, read-only)');

const faq = readFileSync(join(root, 'faq.html'), 'utf8');
const contact = readFileSync(join(root, 'contact.html'), 'utf8');

for (const [name, html] of [['faq.html', faq], ['contact.html', contact]]) {
  check(/<html lang="ja">/i.test(html), `${name} declares Japanese`);
  check(html.includes('./top-comp.css'), `${name} links shared top-comp.css`);
  check(html.includes('./faq-contact-comp.css'), `${name} links dedicated faq-contact-comp.css`);
  check(!html.includes('./style.css'), `${name} no longer links legacy style.css`);
  check(!/<style[\s>]/.test(html), `${name} has no embedded <style> block`);
  check(!/\sstyle\s*=\s*"/.test(html), `${name} adds no inline styles`);
  check(!/alert\(|confirm\(|prompt\(/.test(html), `${name} avoids blocking dialogs`);
  check(html.includes('<script src="./nav.js" defer></script>'), `${name} includes nav.js`);
  check(html.includes('class="comp-header"'), `${name} reuses TOP comp-header block`);
  check(html.includes('class="comp-footer"'), `${name} reuses TOP comp-footer block`);
  check(html.includes('© 2026 ざつね屋'), `${name} has correct copyright`);
  check(html.includes('https://han-ai-diagnosis.netlify.app/'), `${name} keeps primary diagnosis CTA reachable`);
  for (const match of html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
    check(existsSync(join(root, match[1].replace(/^\.\//, ''))), `${name} local reference exists: ${match[1]}`);
  }
}

// ── faq.html specific ──
check(faq.includes(`rel="canonical" href="${origin}faq.html"`), 'faq.html has V2 canonical URL');
check(faq.includes('はじめる前の'), 'faq.html has camp headline line 1');
check(faq.includes('「気になる」を、先に。'), 'faq.html has camp headline line 2');
check(faq.includes('必要なところだけ、お気軽にお尋ねください。'), 'faq.html has camp lead copy');

const faqQuestions = [
  'どのような規模・業種の企業が対象ですか？',
  'ITや AIに詳しくない社員でも研修を受けられますか？',
  '研修は何名から受けられますか？',
  '費用の目安を教えてください。',
  '伴走支援とはどのような内容ですか？',
  '地方でも対応できますか？',
  '助成金を活用できますか？'
];
for (const q of faqQuestions) check(faq.includes(q), `faq.html preserves existing Q&A copy: ${q}`);

const triggerMatches = [...faq.matchAll(/<button[^>]*class="faq-trigger"[^>]*>/g)];
check(triggerMatches.length === 7, `faq.html has 7 accordion triggers (found ${triggerMatches.length})`);
for (const m of triggerMatches) {
  check(/aria-expanded="false"/.test(m[0]), 'faq trigger starts collapsed (aria-expanded=false)');
  check(/aria-controls="[^"]+"/.test(m[0]), 'faq trigger has aria-controls');
}
const controlIds = [...faq.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
check(controlIds.length === 7, 'faq.html has 7 aria-controls references');
for (const id of controlIds) {
  const re = new RegExp(`id="${id}"[^>]*class="faq-answer"[^>]*hidden`);
  check(re.test(faq) || new RegExp(`class="faq-answer"[^>]*id="${id}"[^>]*hidden`).test(faq), `faq.html answer #${id} exists and starts hidden`);
}

// ── contact.html specific ──
check(contact.includes(`rel="canonical" href="${origin}contact.html"`), 'contact.html has V2 canonical URL');
check(contact.includes('話すだけでも、'), 'contact.html has camp headline line 1');
check(contact.includes('大丈夫です。'), 'contact.html has camp headline line 2');
check(contact.includes('ご相談内容が固まっていなくても構いません。'), 'contact.html has camp lead copy');
check(contact.includes('CONTACT_EMAIL_INVALID'), 'contact.html shows error identifier example per camp/design-spec');
check(contact.includes('ご相談は、無料です。'), 'contact.html has camp closing reassurance headline');
check(contact.includes('エラーが表示されたら、表示された文章をそのままご連絡ください。'), 'contact.html has camp error-copy guidance');
check(
  contact.includes('https://docs.google.com/forms/d/e/1FAIpQLSfmX_5vT9A751YBGaCqCsILRk8AQnrD1GlY3GY0Dhfo0-H3kA/viewform?embedded=true'),
  'contact.html preserves the existing Google Forms embed src unchanged'
);

console.log(`PASS ${checks} faq-contact comp contract checks`);
