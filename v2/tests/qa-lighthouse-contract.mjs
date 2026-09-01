import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runnerPath = join(root, 'tests', 'qa-lighthouse.mjs');
const source = readFileSync(runnerPath, 'utf8');

function countMatches(pattern) {
  return [...source.matchAll(pattern)].length;
}

assert.ok(source.includes('async function launchChrome'),
  'Lighthouse owns a dedicated browser factory named launchChrome');
assert.equal(countMatches(/await\s+launchChrome\s*\(/g), 1,
  'a full Lighthouse runner launches Chrome exactly once');
assert.equal(countMatches(/await\s+stopChrome\s*\(\s*chrome\s*\)/g), 1,
  'a full Lighthouse runner stops Chrome exactly once');
assert.ok(source.includes("'--no-sandbox'"), 'trusted-localhost Chrome disables sandboxing');
assert.match(source, /'--headless(?:=new)?'/, 'Chrome runs headless');
assert.ok(source.includes("'--disable-gpu'"), 'Chrome disables GPU for deterministic QA');
assert.ok(source.includes('Launcher.defaultFlags()'),
  'Chrome retains chrome-launcher deterministic background-service defaults');
assert.ok(source.includes('assertLocalhostOrigin(server.origin)'),
  'the runner rejects any non-local QA origin before launching Chrome');
assert.ok(source.includes('disableStorageReset: false'),
  'every audit explicitly keeps Lighthouse storage reset enabled');
assert.ok(source.includes('settings.disableStorageReset, false'),
  'the audit result verifies storage reset was enabled');
assert.ok(source.includes('LIGHTHOUSE_RUN_TIMEOUT_MS'),
  'each Lighthouse audit has a finite timeout');
assert.ok(source.includes('LIGHTHOUSE_TOTAL_TIMEOUT_MS'),
  'the complete four-audit run has a finite timeout');
assert.ok(source.includes('await rm(temporaryReportDirectory'),
  'temporary reports and the single Chrome profile are cleaned up');
assert.ok(!source.includes('taskkill'), 'the runner does not use repeated taskkill cleanup');
assert.ok(!source.includes('process.exit'), 'the runner reports failure by throwing, not process.exit');

const launchIndex = source.indexOf('await launchChrome(');
const auditCallIndex = source.lastIndexOf('runAudits({');
const stopIndex = source.indexOf('await stopChrome(chrome)');
const cleanupIndex = source.indexOf('await rm(temporaryReportDirectory');
assert.ok(launchIndex >= 0 && launchIndex < auditCallIndex,
  'Chrome starts before the four-audit sequence');
assert.ok(stopIndex > auditCallIndex && stopIndex < cleanupIndex,
  'Chrome stops in outer cleanup after all audits and before profile removal');

function runIntegration() {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [runnerPath], {
      cwd: resolve(root, '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      rejectRun(new Error('Lighthouse integration child timed out after 240000ms'));
    }, 240_000);

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveRun({ code, signal, stdout, stderr });
    });
  });
}

const integration = await runIntegration();
assert.equal(integration.signal, null,
  `Lighthouse integration child was not terminated by a signal\n${integration.stderr}`);
assert.equal(integration.code, 0,
  `Lighthouse integration child exits successfully\n${integration.stdout}\n${integration.stderr}`);
const scoreLines = integration.stdout.match(/^LIGHTHOUSE (?:mobile|desktop) run [12]:.*$/gm) ?? [];
assert.deepEqual(scoreLines.map(line => line.match(/^LIGHTHOUSE (mobile|desktop) run ([12]):/).slice(1).join('-')),
  ['mobile-1', 'mobile-2', 'desktop-1', 'desktop-2'],
  'integration emits exactly four ordered score lines');
assert.equal((integration.stdout.match(/^PASS Lighthouse /gm) ?? []).length, 1,
  'integration emits exactly one final PASS line');

process.stdout.write(integration.stdout);
console.log('PASS Lighthouse single-Chrome lifecycle contract and bounded integration');
