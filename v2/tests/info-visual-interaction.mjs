import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';
import { resolve } from 'node:path';
const server = await startQaServer(resolve(import.meta.dirname, '..'));
const browser = await chromium.launch();
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({viewport:{width,height:800},reducedMotion:'reduce'});
    await page.goto(server.origin + '/faq.html');
    const styles = await page.locator('.faq-trigger').first().evaluate(el => ({bg:getComputedStyle(el).backgroundColor,font:parseFloat(getComputedStyle(el).fontSize),border:getComputedStyle(el).borderWidth,height:el.getBoundingClientRect().height,icon:getComputedStyle(el.querySelector('.faq-trigger__icon'),'::before').content}));
    console.log(JSON.stringify({width,styles}));
    assert.equal(styles.bg, 'rgb(255, 255, 255)', 'FAQ is white, not native button gray');
    assert.ok(styles.font >= 16 && styles.height >= 44 && styles.border === '0px', 'FAQ typography/control style');
    assert.equal(styles.icon, '"+"', 'FAQ has explicit expand symbol');
    assert.equal(await page.locator('.faq-trigger').count(), 6, 'six current questions without subsidy promotion');
    const button = page.locator('.faq-trigger').first();
    await button.focus(); await page.keyboard.press('Enter');
    assert.equal(await button.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#faq-answer-1').isVisible(),true);
    await page.keyboard.press('Space');
    assert.equal(await button.getAttribute('aria-expanded'),'false');
    await page.goto(server.origin + '/contact.html');
    const fallback = page.locator('.lpi-form-alternatives');
    assert.equal(await fallback.isVisible(),true);
    assert.ok(await fallback.locator('a[href^="https://docs.google.com/forms/"]').count());
    assert.ok(await fallback.locator('a[href^="mailto:"]').count());
    const rects = await page.evaluate(() => ({fallback:document.querySelector('.lpi-form-alternatives').getBoundingClientRect().bottom,frame:document.querySelector('.lpi-form-details').getBoundingClientRect().top}));
    assert.ok(rects.fallback <= rects.frame,'direct alternatives precede optional embed');
    assert.equal(await page.locator('.fc-error-note').count(),0,'no internal developer spec');
    assert.equal(await page.locator('.lpi-form-details').getAttribute('open'),null,'blocked third-party content cannot create a default blank panel');
    await page.goto(server.origin + '/thank-you.html');
    const completionText = await page.locator('main').innerText();
    assert.equal((completionText.match(/送信が完了しました/g) || []).length, 1, 'one completion announcement');
    assert.equal((completionText.match(/ありがとうございます/g) || []).length, 1, 'one thank-you message');
    assert.ok(!/営業日|無料相談/.test(completionText), 'no inconsistent response deadline or renewed sales action');
    assert.equal(await page.locator('#sticky-cta').isVisible(), false, 'completion dock stays hidden');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    assert.equal(await page.locator('#sticky-cta').isVisible(), false, 'completion dock stays hidden on scroll');
    const icon = await page.locator('.status-icon svg').evaluate(el => ({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,fill:getComputedStyle(el).fill}));
    assert.ok(icon.width === 40 && icon.height === 40 && icon.fill === 'none', 'status check is a 40px monoline icon, never a giant filled SVG');
    await page.close();
  }
  console.log('Information-page visual interaction: 36 PASS');
} finally {await browser.close();await server.close();}
