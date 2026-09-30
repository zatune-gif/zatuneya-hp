// Diagnostic control: plain native links and buttons, no website CSS or scripts.
// Browser preference reference: https://developer.apple.com/documentation/webkit/wkpreferences/tabfocuseslinks
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
for (const [name, engine] of Object.entries({chromium,firefox,webkit})) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<a id="link" href="#destination">Plain link</a><button id="button">Plain button</button><p id="destination">Destination</p>');
    const sequence = [];
    for(let i=0;i<4;i++) { await page.keyboard.press('Tab'); sequence.push(await page.evaluate(()=>document.activeElement.id || document.activeElement.tagName)); }
    assert.ok(sequence.includes('button'), name + ' native button reachable');
    if(name !== 'webkit') assert.ok(sequence.includes('link'), name + ' native link reachable');
    await page.locator('#link').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>location.hash),'#destination', name + ' native focused link activates');
    console.log(JSON.stringify({engine:name,nativeTabSequence:sequence,nativeLinksIncluded:sequence.includes('link'),focusedLinkEnter:'PASS'}));
  } finally {await browser.close();}
}
