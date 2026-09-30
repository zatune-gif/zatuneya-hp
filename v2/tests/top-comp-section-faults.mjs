import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const cases = [
  ['tiny-text', 'mobile body text stays at least 14px'],
  ['remove-gutter', 'cards keep comp-derived side gutters'],
  ['image-aspect', 'mobile Hero keeps the comp-derived photo-first height'],
  ['card-columns', 'four problem cards form one vertical sequence'],
  ['hide-section', 'no required section is hidden'],
  ['mobile-padding-inflation', 'mobile section padding retains the approved 44/32px rhythm'],
  ['second-problem-padding-inflation', 'all four problem cards retain 12px gap and 20px inset']
];

for (const [fault, expectedFailure] of cases) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, 'top-comp-section-geometry.mjs'), `--inject-fault=${fault}`], {
    encoding: 'utf8', timeout: 30_000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, `${fault} must fail the geometry gate:\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stderr.includes(expectedFailure), `${fault} must fail the intended contract:\n${result.stderr}`);
  console.info(`PASS ${fault}: rejected by ${expectedFailure}`);
}

console.info(`top-comp-section-faults: ${cases.length} fault injections PASS`);
