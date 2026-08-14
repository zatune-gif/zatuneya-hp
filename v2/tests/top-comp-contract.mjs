import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const indexPath = join(root, 'index.html');
assert.ok(existsSync(indexPath), 'TOP comp implementation exists');
const html = readFileSync(indexPath, 'utf8');
for (const token of [
  '教えて、作って、', '一緒に走る。', 'こんなお悩みありませんか？',
  '現場を知るから、', '成果につなげられる。', 'AI活用のステップに合わせた 4 つのサービス',
  'ざつね屋の支援実績（一例）', 'ご相談からサポート開始までの流れ', '料金の目安',
  'AI研修・教育', 'オーダーメイド開発', '業務改善・経営支援', '伴走サポート',
  '実装-ヒーロー', '実装-お悩み', '実装-強み', '実装-サービス', '実装-実績', '実装-流れ', '実装-料金'
]) assert.ok(html.includes(token), `TOP comp contract: ${token}`);
assert.ok(html.includes('top-comp.css'), 'TOP uses dedicated comp stylesheet');
console.log('PASS TOP comp contract');
