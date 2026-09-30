import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';
const repo = resolve(import.meta.dirname, '..', '..');
const baseline = execFileSync('git',['-c','safe.directory=' + repo,'show','d5b9203:v2/index.html'],{cwd:repo,encoding:'utf8'});
const server = await startQaServer(resolve(repo,'v2'));
const browser = await chromium.launch();
const rows = [];
try {
  for (const width of [375,1280]) for (const version of ['d5b9203','working']) {
    const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    await page.addInitScript(()=>sessionStorage.setItem('sticky-cta-closed','1'));
    if(version === 'd5b9203') await page.route(server.origin + '/', route=>route.fulfill({status:200,contentType:'text/html',body:baseline}));
    await page.goto(server.origin);
    await page.evaluate(async()=>{
      await document.fonts.ready;
      document.querySelectorAll('img').forEach(image=>{image.loading='eager';});
      await Promise.all([...document.images].map(image=>image.decode()));
      document.querySelectorAll('.fade-in').forEach(node=>node.classList.add('is-visible'));
    });
    const sizes = await page.evaluate(()=>({total:document.documentElement.scrollHeight,...Object.fromEntries(['problems','package','services'].map(id=>[id,document.getElementById(id).getBoundingClientRect().height]))}));
    rows.push({width,version,...sizes}); await page.close();
  }
  for(const width of [375,1280]){
    const [old,current]=rows.filter(row=>row.width===width);
    assert.equal(old.problems,current.problems,'untouched problems geometry');
    assert.equal(old.package,current.package,'untouched package geometry');
    assert.ok(Math.abs((current.total-old.total)-(current.services-old.services)) <= 1,'any total delta is solely the approved service copy change');
  }
  console.log(JSON.stringify(rows,null,2));
  console.log('Baseline attribution: PASS (does not relax the independent visual budgets)');
} finally {await browser.close();await server.close();}
