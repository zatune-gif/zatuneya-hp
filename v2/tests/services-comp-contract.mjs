import { check, checks, commonPage, html, text } from './lower-current-contract-helpers.mjs';
import './lower-pages-current-copy.mjs';
const pages = ['services.html', 'service-training.html', 'service-management.html', 'service-banso.html'];
for (const page of pages) {
  const source = commonPage(page);
  check(/href="\.\/services\.html" aria-current="page"/.test(source), page + ' correct current navigation');
  check(!/service-order|個別業務設計|オーダーメイド/.test(source), page + ' no obsolete service');
}
const services = html('services.html');
check((services.match(/class="lp-card lps-overview-card"/g) || []).length === 3, 'three active service cards');
for (const name of ['training', 'management', 'banso']) check(services.includes('./service-' + name + '.html'), 'active service link ' + name);
const training = html('service-training.html');
check((training.match(/class="lps-course-blurb-item"/g) || []).length === 5, 'five complete course descriptions');
for (const token of ['①AI活用知識編（90分）', '各120分', 'Claude Code特化（120分）', '②〜④は要お問い合わせ', 'グループ3名まで', '1〜5名・6〜10名', '1人あたり8,000円', '5名 60,000円〜', 'Claude Proプランが必要']) check(training.includes(token), 'current training condition: ' + token);
for (const id of ['courses', 'course-guide', 'pricing']) check(training.includes('id="' + id + '"') && training.includes('href="#' + id + '"'), 'training table of contents ' + id);
check(!/20,900|560,000|全コースセット・10名|⑥|全6コース/.test(training), 'no ambiguous old bundle or sixth course');
const management = text(html('service-management.html'));
for (const token of ['360,000円', '期間3か月 計16時間分', '手順書']) check(management.includes(token), 'management: ' + token);
check(!/240,000|480,000|ライト|プレミアム/.test(management), 'management is one current plan');
const banso = text(html('service-banso.html'));
for (const token of ['月2回', '60〜90分', '3か月', '無料相談', 'お見積もり']) check(banso.includes(token), 'banso: ' + token);
check(!/月1回|月額60,000|月額100,000/.test(banso), 'no old fixed-price/one-meeting promotion');
console.log('PASS ' + checks + ' current services contract checks');
