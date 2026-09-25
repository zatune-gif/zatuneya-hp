import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const publicationDirectory = path.join(repo, '.pages-artifact');
const publicExt = new Set(['.html', '.css', '.js', '.mjs', '.ico', '.txt', '.xml', '.webmanifest', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.mp4', '.webm']);
const rootExact = new Set(['.nojekyll', 'CNAME']);
const blockedNames = /^(?:readme|agents|claude|package(?:-lock)?)\.(?:md|json)$/i;
const publicHtml = {
  '': new Set(['404.html', 'contact.html', 'faq.html', 'index-v2.html', 'index.html', 'privacy.html', 'profile.html', 'service-banso.html', 'service-management.html', 'service-order.html', 'service-training.html', 'services.html', 'thank-you.html', 'tokusho.html', 'works.html']),
  v2: new Set(['404.html', 'contact.html', 'faq.html', 'growth.html', 'index.html', 'lower-page-template.html', 'privacy.html', 'profile.html', 'service-banso.html', 'service-management.html', 'service-training.html', 'services.html', 'thank-you.html', 'tokusho.html', 'tools.html', 'works.html'])
};
export const stagingPages = Object.freeze([...publicHtml.v2]);
const manifest = (await readFile(new URL('./publication-files.txt', import.meta.url), 'utf8')).trim().split(/\r?\n/);
const internalAssets = new Set([
  'v2/assets/comp-parts/README.md',
  'v2/assets/comp-parts/manifest.json',
  'v2/assets/comp-parts/comp-desktop-reference.png',
  'v2/assets/comp-parts/comp-mobile-reference.png',
  'v2/assets/comp-parts/logo-reference.png',
  'v2/assets/comp-parts/tool-icons-reference.png'
]);

async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic link in public source: ${relative}`);
    if (entry.isDirectory()) result.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
    else throw new Error(`unsupported public source: ${relative}`);
  }
  return result;
}

export async function expectedPublicFiles(source, { requiredHtml = publicHtml, publicFiles = manifest } = {}) {
  const chosen = [];
  for (const segment of ['', 'v2']) {
    const base = path.join(source, segment);
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`symbolic link in public source: ${path.posix.join(segment, entry.name)}`);
      if (entry.isDirectory()) {
        if (entry.name === 'assets') chosen.push(...(await filesUnder(path.join(base, entry.name), path.posix.join(segment, entry.name))).filter(name => !internalAssets.has(name)));
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.endsWith('.html') && !publicHtml[segment].has(entry.name)) throw new Error(`unreviewed HTML in publication source: ${path.posix.join(segment, entry.name)}`);
      if (rootExact.has(entry.name) || (publicExt.has(path.extname(entry.name).toLowerCase()) && !blockedNames.test(entry.name))) {
        chosen.push(path.posix.join(segment, entry.name));
      }
    }
  }
  for (const segment of ['', 'v2']) {
    for (const name of requiredHtml[segment]) {
      const required = path.posix.join(segment, name);
      if (!chosen.includes(required)) throw new Error(`required public HTML missing: ${required}`);
    }
  }
  const approved = new Set(publicFiles);
  for (const file of chosen) if (!approved.has(file)) throw new Error(`unreviewed public source file: ${file}`);
  for (const file of publicFiles) if (!chosen.includes(file)) throw new Error(`required public file missing: ${file}`);
  return chosen.sort();
}

export async function verifyStagingNoindex(output, pages = stagingPages) {
  for (const page of pages) {
    const html = await readFile(path.join(output, 'v2', page), 'utf8');
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
    const head = withoutComments.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] ?? '';
    const headMarkup = head.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const robots = [...headMarkup.matchAll(/<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/gi)];
    const valid = robots.filter(match => /\bcontent\s*=\s*["']\s*noindex\s*,\s*follow\s*["']/i.test(match[0]));
    if (robots.length !== 1 || valid.length !== 1) throw new Error(`staging noindex requires one robots meta in v2/${page}; found ${robots.length} robots, ${valid.length} noindex`);
  }
  return { pages: pages.length };
}

function localTarget(raw, owner) {
  const value = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!value || value.startsWith('#') || value.startsWith('//') || /^(?:[a-z][a-z\d+.-]*:)/i.test(value)) return null;
  const cleaned = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  if (!cleaned) return null;
  const siteAbsolute = cleaned.startsWith('/zatuneya-hp/') ? cleaned.slice('/zatuneya-hp/'.length) : cleaned;
  const target = cleaned.startsWith('/') ? siteAbsolute.replace(/^\/+/, '') : path.posix.join(path.posix.dirname(owner), siteAbsolute);
  const normalized = path.posix.normalize(target);
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new Error(`out-of-tree reference in ${owner}: ${value}`);
  return normalized.endsWith('/') || normalized === '.' ? path.posix.join(normalized, 'index.html') : normalized;
}

function references(text, extension) {
  const found = [];
  if (extension === '.html') {
    for (const match of text.matchAll(/\b(?:href|src|poster|action)\s*=\s*["']([^"']+)["']/gi)) found.push(match[1]);
    for (const match of text.matchAll(/<meta\b[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi)) {
      const content = match[0].match(/\bcontent\s*=\s*["'][^"']*?\burl\s*=\s*([^"';\s]+)[^"']*["']/i);
      if (content) found.push(content[1]);
    }
    for (const match of text.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const part of match[1].split(',')) found.push(part.trim().split(/\s+/, 1)[0]);
    }
  }
  if (extension === '.css' || extension === '.html') {
    for (const match of text.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi)) found.push(match[2]);
  }
  return found;
}

export async function verifyPublication(source, output, options) {
  const expected = await expectedPublicFiles(source, options);
  const actual = await filesUnder(output);
  const expectedSet = new Set(expected);
  for (const file of expected) if (!actual.includes(file)) throw new Error(`missing public URL: ${file}`);
  for (const file of actual) if (!expectedSet.has(file)) throw new Error(`unexpected file in publication: ${file}`);
  let refs = 0;
  for (const file of expected) {
    const original = await readFile(path.join(source, file));
    const published = await readFile(path.join(output, file));
    if (!original.equals(published)) throw new Error(`bytes differ: ${file}`);
    const ext = path.extname(file).toLowerCase();
    if (ext !== '.html' && ext !== '.css') continue;
    for (const reference of references(original.toString('utf8'), ext)) {
      const target = localTarget(reference, file);
      if (!target) continue;
      refs++;
      if (!expectedSet.has(target)) throw new Error(`missing local reference: ${file} -> ${reference} (${target})`);
    }
  }
  return { files: expected.length, references: refs, html: expected.filter(name => name.endsWith('.html')).length };
}

function samePath(left, right) {
  const normalized = value => process.platform === 'win32' ? path.normalize(value).toLowerCase() : path.normalize(value);
  return normalized(left) === normalized(right);
}

async function assertSafeDestination(source, output) {
  const absoluteSource = path.resolve(source);
  const absoluteOutput = path.resolve(output);
  const parent = path.dirname(absoluteOutput);
  const fixtureParent = path.dirname(absoluteSource);
  const fixtureAllowed = path.basename(absoluteSource) === 'source' &&
    path.basename(fixtureParent).startsWith('hp-publish-test-') &&
    samePath(path.dirname(fixtureParent), path.resolve(tmpdir()));
  if (!samePath(absoluteSource, repo) && !fixtureAllowed) throw new Error(`unsafe publication destination: ${absoluteOutput}`);
  const allowedParent = samePath(absoluteSource, repo) ? repo : fixtureParent;
  if (path.basename(absoluteOutput) !== '.pages-artifact' || !samePath(parent, allowedParent) || samePath(absoluteOutput, absoluteSource)) {
    throw new Error(`unsafe publication destination: ${absoluteOutput}`);
  }
  if (!samePath(await realpath(absoluteSource), absoluteSource) || !samePath(await realpath(parent), parent)) {
    throw new Error(`unsafe publication destination (linked source or parent): ${absoluteOutput}`);
  }
}

export async function buildPublication(source, output, options) {
  await assertSafeDestination(source, output);
  const files = await expectedPublicFiles(source, options);
  try {
    const destination = await lstat(output);
    if (destination.isSymbolicLink() || !destination.isDirectory()) throw new Error(`unsafe publication destination: ${output}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of files) {
    const target = path.join(output, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, file), target);
  }
  return verifyPublication(source, output, options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const operation = process.argv[2];
  if (!['build', 'verify', 'staging-gate'].includes(operation)) throw new Error('use: node tools/publication-package.mjs build|verify|staging-gate');
  if (path.resolve(publicationDirectory) !== path.join(repo, '.pages-artifact')) throw new Error('unsafe destination');
  const result = operation === 'build' ? await buildPublication(repo, publicationDirectory) : await verifyPublication(repo, publicationDirectory);
  if (operation === 'staging-gate') {
    const staging = await verifyStagingNoindex(publicationDirectory);
    console.info(`publication staging gate: ${staging.pages} v2 HTML have exactly one noindex,follow robots meta`);
  } else console.info(`publication ${operation}: ${result.files} files, ${result.html} HTML, ${result.references} local references verified`);
}
