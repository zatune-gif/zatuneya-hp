import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const v2Root = resolve(import.meta.dirname, '..');
const partsRoot = resolve(v2Root, 'assets', 'comp-parts');
const manifestPath = resolve(partsRoot, 'manifest.json');

const expected = {
  'comp-desktop-reference.png': [0, 0, 588, 2178],
  'comp-mobile-reference.png': [590, 0, 722, 2178],
  'hero-desktop.png': [272, 41, 588, 270],
  'hero-mobile.png': [600, 45, 709, 131],
  'package-dashboard.png': [21, 587, 170, 711],
  'service-training.png': [21, 875, 183, 978],
  'service-design.png': [204, 875, 366, 978],
  'service-support.png': [389, 875, 566, 978],
  'representative.png': [26, 1300, 211, 1471],
  'logo-reference.png': [13, 12, 36, 35],
  'tool-icons-reference.png': [20, 1725, 568, 1850]
};

function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'asset must be PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

assert.ok(existsSync(manifestPath), `comp manifest is missing: ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.deepEqual(manifest.sourceSize, [722, 2178], 'source comp size is fixed');
assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/, 'source SHA-256 is recorded');
assert.deepEqual(Object.keys(manifest.parts).sort(), Object.keys(expected).sort(), 'manifest has exactly 11 approved crops');

for (const [name, crop] of Object.entries(expected)) {
  const assetPath = resolve(partsRoot, name);
  assert.ok(existsSync(assetPath), `${name} exists`);
  assert.deepEqual(manifest.parts[name].crop, crop, `${name} crop coordinates are fixed`);
  const buffer = readFileSync(assetPath);
  const expectedSize = [crop[2] - crop[0], crop[3] - crop[1]];
  assert.deepEqual(pngSize(buffer), expectedSize, `${name} PNG dimensions match crop`);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), manifest.parts[name].sha256, `${name} hash matches manifest`);
}

const html = readFileSync(resolve(v2Root, 'index.html'), 'utf8');
const displayed = [
  'hero-desktop.png', 'hero-mobile.png', 'package-dashboard.png',
  'service-training.png', 'service-design.png', 'service-support.png',
  'representative.png'
];
for (const name of displayed) {
  assert.match(html, new RegExp(`\\./assets/comp-parts/${name.replace('.', '\\.')}\\b`), `TOP uses ${name}`);
}
assert.doesNotMatch(html, /\.\/assets\/v3-(?:hero|package|service|representative)[^"']*\.(?:jpg|png)/, 'TOP does not use AI-generated V3 image assets');
assert.doesNotMatch(html, /comp-(?:desktop|mobile)-reference\.png|logo-reference\.png|tool-icons-reference\.png/, 'reference-only crops are not rendered');

console.info(`comp-parts-contract: ${Object.keys(expected).length} crop assets and 7 rendered references PASS`);
