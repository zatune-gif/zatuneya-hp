import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pages = ['faq', 'contact', 'privacy', 'tokusho', 'thank-you', '404', 'growth', 'tools'];
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'lower-info-pages-d5b9203.json'), 'utf8'));
const normalizeText = value => value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const extractBodyCopy = html => [...html.matchAll(/<(p|li|dd|th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => normalizeText(match[2])).filter(Boolean);
const requiredCopy = {
  faq: ['従業員5〜100名程度', '①〜④は1〜5名・6〜10名', 'グループ3名まで', '月2回・各60〜90分'],
  contact: ['docs.google.com/forms', 'お問い合わせフォーム'],
  privacy: ['Cookieの使用', 'zatuneya@gmail.com'],
  tokusho: ['運営統括責任者', 'AI経営改善パッケージ', 'AI活用伴走', 'AI実務研修', '納品済み・実施済み'],
  'thank-you': ['内容を確認してご連絡いたします。', '送信が完了しました'],
  '404': ['URLが変更または削除', 'サービス詳細を見る'],
  growth: ['5つの段階', '内製化'],
  tools: ['プロンプトライブラリ', '15_prompt-library'],
};

for (const name of pages) {
  const html = fs.readFileSync(path.join(root, `${name}.html`), 'utf8');
  assert.match(html, /<main id="main" class="lp-page">/, `${name}: lp-page`);
  assert.match(html, /<section id="hero" class="lp-hero(?:\s|\")/, `${name}: hero`);
  assert.match(html, /top-comp\.css[\s\S]*lower-page-template\.css[\s\S]*lower-info-pages\.css/, `${name}: CSS order`);
  assert.equal((html.match(/name="zatuneya:diagnosis-url"/g) || []).length, 1, `${name}: diagnosis meta`);
  assert.match(html, /href="\.\/index\.html#journey"/, `${name}: journey link`);
  assert.match(html, /class="footer-brand"/, `${name}: approved footer`);
  assert.match(html, /id="sticky-cta"/, `${name}: sticky CTA`);
  assert.match(html, /<script src="\.\/nav\.js" defer><\/script>/, `${name}: nav script`);
  for (const text of requiredCopy[name]) assert.ok(html.includes(text), `${name}: preserve ${text}`);
  const currentCopy = new Set(extractBodyCopy(html));
  const permittedTokushoUpdates = value => name === 'tokusho' && (value.includes('AI業務改善オーダーメイドサービス') || value.includes('オーダーメイド開発・伴走支援'));
  const approvedReplacements = {
    'thank-you': {
      'お問い合わせありがとうございます。ご連絡をいただきありがとうございます。 内容を確認のうえ、3営業日以内にご連絡いたします。': 'お問い合わせありがとうございます。内容を確認してご連絡いたします。',
      '内容を確認のうえ、3営業日以内にご連絡いたします。': null,
      '迷わないよう、次に進める導線をご用意しています。': null,
      'お問い合わせありがとうございます。内容を確認のうえ、3営業日以内にご連絡いたします。': null
    },
    privacy: {
      'Google Fonts （フォントの読み込み） フォントの表示のため、Googleのサーバーにアクセスします。Googleのプライバシーポリシーに従って処理されます。': 'Googleフォーム （お問い合わせフォーム） お問い合わせフォームを開いた場合、Googleのサーバーに接続します。Googleのプライバシーポリシーに従って処理されます。',
      '現在、当サイトでは独自のCookieやトラッキングツールを使用していません。ただし、外部サービス（Google Fonts等）の利用に伴い、それらのサービスがCookieを使用する場合があります。': '現在、当サイトでは独自のCookieやトラッキングツールを使用していません。ただし、外部サービス（Googleフォーム）の利用に伴い、それらのサービスがCookieを使用する場合があります。'
    },
    faq: {
      '3名から承っております。少人数でも対応可能ですので、まずはお気軽にご相談ください。': '①〜④は1〜5名・6〜10名の人数区分で承ります。⑤Claude Code特化はグループ3名までです。',
      '月次のオンラインミーティングを基本に、AI活用の進捗確認・課題整理・ツール選定のアドバイスなどを継続的に行います。研修で終わりではなく、現場への定着まで一緒に取り組みます。': '月2回・各60〜90分のミーティングを基本に、AI活用の進捗確認・課題整理・ツール選定のアドバイスなどを継続的に行います。研修で終わりではなく、現場への定着まで一緒に取り組みます。',
      '人材開発支援助成金（事業展開等リスキリング支援コース）が活用できる可能性があります。ただし要件の確認が必要です。詳しくはお問い合わせいただければ、一緒に確認いたします。': null
    },
    contact: {
      '入力エラーは項目の近くに原因と識別子を表示します。': null,
      '例：メールアドレスの形式を確認してください［CONTACT_EMAIL_INVALID］': null
    }
  };
  for (const text of baseline[name]) {
    const replacements = approvedReplacements[name] || {};
    if (Object.hasOwn(replacements, text)) {
      if (replacements[text] !== null) assert.ok(currentCopy.has(replacements[text]), name + ': approved replacement is exact');
      else assert.ok(!currentCopy.has(text), name + ': obsolete/internal copy absent');
    } else if (!permittedTokushoUpdates(text)) assert.ok(currentCopy.has(text), `${name}: baseline body copy preserved: ${text}`);
  }
}

const faq = fs.readFileSync(path.join(root, 'faq.html'), 'utf8');
for (let i = 1; i <= 6; i++) {
  assert.match(faq, new RegExp(`class="faq-trigger[^\"]*"[^>]*aria-controls="faq-answer-${i}"`), `faq: trigger ${i}`);
  assert.match(faq, new RegExp(`id="faq-answer-${i}"`), `faq: answer ${i}`);
}

const contact = fs.readFileSync(path.join(root, 'contact.html'), 'utf8');
assert.match(contact, /<iframe[\s\S]*src="https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSfmX_5vT9A751YBGaCqCsILRk8AQnrD1GlY3GY0Dhfo0-H3kA\/viewform\?embedded=true"[\s\S]*title="お問い合わせフォーム"/, 'contact: iframe contract');

const css = fs.readFileSync(path.join(root, 'lower-info-pages.css'), 'utf8');
const selectors = [...css.matchAll(/(?:^|\})\s*([^@{}][^{}]*)\{/gm)].map((m) => m[1].trim());
for (const selector of selectors) {
  if (selector.startsWith('@')) continue;
  for (const part of selector.split(',')) assert.match(part.trim(), /\.lpi-/, `CSS selector must be lpi scoped: ${part}`);
}

console.log(`lower info contract: ${pages.length} pages PASS`);
