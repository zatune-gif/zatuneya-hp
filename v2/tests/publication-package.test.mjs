import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPublication, verifyPublication, verifyStagingNoindex, stagingPages } from '../../tools/publication-package.mjs';

const requiredHtml = { '': ['index.html', 'index-v2.html'], v2: ['index.html'] };
const publicFiles = ['index.html', 'index-v2.html', 'assets/site.webmanifest', 'v2/index.html', 'v2/assets/pic.svg'];
const options = { requiredHtml, publicFiles };
const buildFixture = (source, output) => buildPublication(source, output, options);
const verifyFixture = (source, output) => verifyPublication(source, output, options);

async function fixture(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hp-publish-test-'));
  const source = path.join(dir, 'source');
  const output = path.join(dir, '.pages-artifact');
  await mkdir(path.join(source, 'assets'), { recursive: true });
  await mkdir(path.join(source, 'v2', 'assets'), { recursive: true });
  await writeFile(path.join(source, 'index.html'), '<link href="./assets/site.webmanifest"><a href="./index-v2.html">x</a>');
  await writeFile(path.join(source, 'index-v2.html'), '<a href="./v2/index.html">v2</a>');
  await writeFile(path.join(source, 'assets', 'site.webmanifest'), '{}');
  await writeFile(path.join(source, 'v2', 'index.html'), '<meta name="robots" content="noindex,follow"><img src="./assets/pic.svg">');
  await writeFile(path.join(source, 'v2', 'assets', 'pic.svg'), '<svg/>');
  await writeFile(path.join(source, 'package.json'), '{"private":true}');
  await writeFile(path.join(source, 'secretconfig.json'), '{"token":"hidden"}');
  await mkdir(path.join(source, 'docs'));
  await writeFile(path.join(source, 'docs', 'secret.md'), 'private');
  try { await fn({ source, output }); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('copies public URLs byte for byte and excludes internal files', async () => fixture(async ({ source, output }) => {
  await buildFixture(source, output);
  await verifyFixture(source, output);
  assert.equal(await readFile(path.join(output, 'v2', 'index.html'), 'utf8'), '<meta name="robots" content="noindex,follow"><img src="./assets/pic.svg">');
  await assert.rejects(readFile(path.join(output, 'docs', 'secret.md')));
  await assert.rejects(readFile(path.join(output, 'package.json')));
  await assert.rejects(readFile(path.join(output, 'secretconfig.json')));
}));

test('missing local reference fails', async () => fixture(async ({ source, output }) => {
  await writeFile(path.join(source, 'index.html'), '<img src="./assets/missing.png">');
  await assert.rejects(buildFixture(source, output), /missing\.png/);
}));

test('missing local meta refresh target fails', async () => fixture(async ({ source, output }) => {
  await writeFile(path.join(source, 'index.html'), '<meta http-equiv="refresh" content="5;url=./missing.html">');
  await assert.rejects(buildFixture(source, output), /missing\.html/);
}));

test('leaked file and altered noindex bytes fail verification', async () => fixture(async ({ source, output }) => {
  await buildFixture(source, output);
  await writeFile(path.join(output, 'docs.md'), 'private');
  await assert.rejects(verifyFixture(source, output), /unexpected|forbidden/);
  await rm(path.join(output, 'docs.md'));
  await writeFile(path.join(output, 'v2', 'index.html'), '<img src="./assets/pic.svg">');
  await assert.rejects(verifyFixture(source, output), /bytes differ/);
}));

test('source symlink is rejected', async () => fixture(async ({ source, output }) => {
  await symlink(path.join(source, 'index.html'), path.join(source, 'assets', 'linked.html'));
  await assert.rejects(buildFixture(source, output), /symbolic link/);
}));

test('unreviewed HTML is never published', async () => fixture(async ({ source, output }) => {
  await writeFile(path.join(source, 'private-notes.html'), 'internal');
  await assert.rejects(buildFixture(source, output), /unreviewed HTML/);
}));

test('new unreviewed asset fails instead of silently publishing', async () => fixture(async ({ source, output }) => {
  await writeFile(path.join(source, 'assets', 'private-notes.pdf'), 'internal');
  await assert.rejects(buildFixture(source, output), /unreviewed public source file/);
}));

test('four design reference images remain in Git source but outside publication', async () => fixture(async ({ source, output }) => {
  const names = ['comp-desktop-reference.png', 'comp-mobile-reference.png', 'logo-reference.png', 'tool-icons-reference.png'];
  const sourceDir = path.join(source, 'v2', 'assets', 'comp-parts');
  await mkdir(sourceDir);
  for (const name of names) await writeFile(path.join(sourceDir, name), 'reference');
  await buildFixture(source, output);
  for (const name of names) {
    await access(path.join(sourceDir, name));
    await assert.rejects(readFile(path.join(output, 'v2', 'assets', 'comp-parts', name)));
  }
}));

test('missing unlinked required page fails before output replacement', async () => fixture(async ({ source, output }) => {
  await writeFile(path.join(source, 'index.html'), '<p>standalone</p>');
  await rm(path.join(source, 'index-v2.html'));
  await assert.rejects(buildFixture(source, output), /required public HTML missing: index-v2\.html/);
}));

test('unsafe destination equal to source is rejected without deleting data', async () => fixture(async ({ source }) => {
  await assert.rejects(buildFixture(source, source), /unsafe publication destination/);
  await access(path.join(source, 'index.html'));
}));

test('unsafe ancestor destination is rejected without deleting data', async () => fixture(async ({ source }) => {
  const ancestor = path.dirname(source);
  await assert.rejects(buildFixture(source, ancestor), /unsafe publication destination/);
  await access(path.join(source, 'index.html'));
}));

test('symlinked destination parent is rejected', async () => fixture(async ({ source }) => {
  const linkedParent = path.join(path.dirname(source), 'linked-parent');
  await symlink(path.dirname(source), linkedParent, 'junction');
  await assert.rejects(buildFixture(source, path.join(linkedParent, '.pages-artifact')), /unsafe publication destination/);
  await access(path.join(source, 'index.html'));
}));

test('staging gate requires one noindex meta per v2 page', async () => fixture(async ({ source, output }) => {
  await buildFixture(source, output);
  for (const name of stagingPages) {
    await writeFile(path.join(output, 'v2', name), '<html><head><meta name="robots" content="noindex,follow"></head><body></body></html>');
  }
  assert.deepEqual(await verifyStagingNoindex(output), { pages: 16 });
  const page = path.join(output, 'v2', 'index.html');
  await writeFile(page, '<html><head></head><body><img src="./assets/pic.svg"></body></html>');
  await assert.rejects(verifyStagingNoindex(output), /noindex/);
  await writeFile(page, '<html><head><meta name="robots" content="noindex,follow"><meta name="robots" content="noindex,follow"></head></html>');
  await assert.rejects(verifyStagingNoindex(output), /noindex/);
  await writeFile(page, '<html><head><!-- <meta name="robots" content="noindex,follow"> --></head></html>');
  await assert.rejects(verifyStagingNoindex(output), /noindex/);
  await writeFile(page, '<html><head></head><body><meta name="robots" content="noindex,follow"></body></html>');
  await assert.rejects(verifyStagingNoindex(output), /noindex/);
  assert.equal((await readFile(path.join(source, 'v2', 'index.html'), 'utf8')).includes('noindex,follow'), true);
}));
