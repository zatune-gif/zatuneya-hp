import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const safeDirectoryArguments = ['-c', `safe.directory=${repositoryRoot}`];

function assertIgnoreStatus(pathname, shouldBeIgnored, message) {
  const result = spawnSync('git', [...safeDirectoryArguments, 'check-ignore', '--no-index', '-q', '--', pathname], {
    cwd: repositoryRoot,
    stdio: 'ignore'
  });
  assert.equal(result.error, undefined, `git check-ignore runs for ${pathname}`);
  assert.equal(result.status, shouldBeIgnored ? 0 : 1, message);
}

for (const manifest of ['package.json', 'package-lock.json']) {
  assertIgnoreStatus(manifest, false, `${manifest} is not ignored`);
  execFileSync('git', [...safeDirectoryArguments, 'ls-files', '--error-unmatch', manifest], {
    cwd: repositoryRoot,
    stdio: 'ignore'
  });
}
assertIgnoreStatus('node_modules/qa-gitignore-sentinel.js', true, 'node_modules remains ignored');
assertIgnoreStatus('shoot.mjs', true, 'the local screenshot helper remains ignored');
assertIgnoreStatus('.worktrees/qa-gitignore-sentinel', true, 'local worktrees remain ignored');

console.log('PASS package manifests are tracked and not ignored; node_modules, shoot.mjs, and local worktrees remain ignored');
