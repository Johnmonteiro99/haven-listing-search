// Optional local Chrome audit; use an existing Playwright installation via NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-cards-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
const axePath = path.resolve(__dirname, '../node_modules/axe-core/axe.min.js');
const settle = page => page.waitForTimeout(600);
async function styles(card) {
  return card.evaluate(e => {
    const image = e.querySelector('img'), button = e.querySelector('button'), arrow = button.querySelector('span');
    const s = node => getComputedStyle(node);
    return { card: s(e).transform, image: s(image).transform, arrow: s(arrow).transform,
      surface: s(e).backgroundColor, edge: s(e).borderTopColor, background: s(button).backgroundColor, text: s(button).color, underline: s(button).textDecorationLine,
      outline: s(e).outlineWidth, border: s(button).borderTopWidth, target: button.getBoundingClientRect().height,
      transition: [e, image, button, arrow].map(n => s(n).transitionDuration),
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
}
async function audit(page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
  })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
  assert.deepEqual(violations, []);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(theme => localStorage.setItem('haven-theme', theme), theme);
      const page = await context.newPage();
      let requests = 0;
      page.on('request', r => { if (r.url().includes('/api/listings')) requests++; });
      await page.goto(base);
      const card = page.locator('.listing-grid .listing-card').first();
      await card.waitFor(); await card.scrollIntoViewIfNeeded(); await page.evaluate(() => document.fonts.ready);
      await card.locator('img').evaluate(img => img.decode());
      const button = card.getByRole('button');
      const address = await card.locator('h3').innerText();
      const next = page.locator('.listing-grid .listing-card').nth(1);
      const before = await card.boundingBox(), neighbor = await next.boundingBox();
      await card.hover(); await settle(page);
      const hovered = await styles(card), lifted = await card.boundingBox();
      assert.equal(hovered.card, 'matrix(1, 0, 0, 1, 0, -4)');
      assert.equal(hovered.image, 'matrix(1.035, 0, 0, 1.035, 0, 0)');
      assert.equal(hovered.arrow, 'matrix(1, 0, 0, 1, 2, -2)');
      assert.equal(hovered.underline, 'none');
      if (theme === 'dark') {
        assert.equal(hovered.surface, 'rgb(27, 30, 33)');
        assert.equal(hovered.edge, 'rgb(140, 121, 92)');
      }
      assert.equal(lifted.height, before.height); assert.deepEqual(await next.boundingBox(), neighbor);
      assert.ok(hovered.target >= 44); assert.equal(hovered.overflow, false);
      await audit(page);
      await page.screenshot({ path: path.join(output, `grid-${theme}-hover.png`) });
      await page.mouse.move(0, 0); await button.focus(); await settle(page);
      assert.equal((await styles(card)).outline, '3px');
      await page.screenshot({ path: path.join(output, `grid-${theme}-focus.png`) });
      const requestCount = requests;
      for (const key of ['Enter', 'Space']) {
        await page.keyboard.press(key);
        await page.getByRole('dialog', { name: address, exact: true }).waitFor();
        assert.equal(await page.getByRole('dialog').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await button.evaluate(e => e === document.activeElement), true);
      }
      assert.equal(requests, requestCount);
      // The stretched action also opens once when clicking the image, with no parent handler.
      const imageBox = await card.locator('img').boundingBox();
      await page.mouse.click(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
      await page.getByRole('dialog', { name: address, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close property details' }).click();
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await card.hover(); await settle(page);
      const reduced = await styles(card);
      for (const key of ['card', 'image', 'arrow']) assert.equal(reduced[key], 'none');
      assert.deepEqual(reduced.transition, ['0s', '0s', '0s', '0s']);
      await audit(page);
      report.push({ theme, hovered, reduced }); await context.close();
      for (const width of [375, 390, 768, 1024]) {
        const touch = await browser.newContext({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true });
        await touch.addInitScript(theme => localStorage.setItem('haven-theme', theme), theme);
        const p = await touch.newPage(); await p.goto(base);
        const c = p.locator('.listing-grid .listing-card').first(); await c.waitFor(); await c.scrollIntoViewIfNeeded();
        await c.hover(); await settle(p);
        const state = await styles(c);
        assert.equal(state.card, 'none'); assert.equal(state.image, 'none'); assert.equal(state.arrow, 'none');
        assert.equal(state.border, '1px'); assert.ok(state.target >= 44); assert.equal(state.overflow, false);
        await p.screenshot({ path: path.join(output, `touch-${width}-${theme}.png`) });
        await audit(p); report.push({ width, theme, state }); await touch.close();
      }
      console.log(`Passed ${theme}: hover, focus, keyboard, image click, reduced motion and four touch widths`);
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Browser evidence: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
