// Optional local Chrome visual/accessibility audit. Use external Playwright via NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-footer-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const rows = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const width of [375, 390, 768, 1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(base);
      await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload();
      const section = page.locator('#perspective'); await section.scrollIntoViewIfNeeded();
      await section.locator('.editorial-slideshow').hover();
      await section.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
      const geometry = await section.evaluate(section => {
        const copy = section.querySelector('.perspective-copy'), image = section.querySelector('.perspective-image');
        const s = section.getBoundingClientRect(), c = copy.getBoundingClientRect(), i = image.getBoundingClientRect();
        return { width: s.width, height: s.height, copyWidth: c.width, imageWidth: i.width,
          clearImageHeight: s.bottom - c.bottom,
          glass: getComputedStyle(copy, '::before').backgroundColor,
          blur: getComputedStyle(copy, '::before').backdropFilter,
          overflow: document.documentElement.scrollWidth > innerWidth,
          clipped: [...copy.querySelectorAll('p,h2,h3')].some(el => { const r = el.getBoundingClientRect(); return r.left < c.left || r.right > c.right + 1 || r.bottom > c.bottom; }),
          imageSources: [...image.querySelectorAll('img')].map(img => img.getAttribute('src')) };
      });
      assert.equal(geometry.overflow, false); assert.equal(geometry.clipped, false);
      assert.equal(geometry.imageWidth, geometry.width);
      assert.equal(await section.getByRole('heading', { level: 3 }).count(), 1);
      assert.equal(await section.locator('.editorial-track').count(), 1);
      assert.equal(await section.locator('.editorial-segment, .editorial-playback').count(), 0);
      assert.equal(await section.locator('.editorial-track').evaluate(el => getComputedStyle(el).height), '3px');
      assert(geometry.height < (width < 768 ? 680 : 460), 'Footer remains compact without fixed height');
      if (width >= 1024) assert(geometry.copyWidth + 64 < geometry.width / 2, 'Middle of composition is clear');
      if (width < 768) assert(geometry.clearImageHeight >= 190, 'Mobile keeps an open image area');
      await page.addScriptTag({ path: path.resolve(__dirname, '../node_modules/axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document.querySelector('#perspective'), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, []);
      await section.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
      // Contrast support must remain useful where backdrop-filter is unavailable.
      await page.addStyleTag({ content: '.perspective-copy::before { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' });
      if (width === 1440) await section.screenshot({ path: path.join(output, `${width}-${theme}-no-blur.png`) });
      for (const title of ['Thoughtful filters', 'Clearer decisions', 'Relevance scoring']) {
        await section.getByRole('button', { name: 'Next feature' }).click();
        assert.equal(await section.getByRole('heading', { level: 3 }).innerText(), title);
        assert.equal((await section.boundingBox()).height, geometry.height);
      }
      rows.push({ width, theme, geometry, violations }); console.log(`Passed ${width}px ${theme}`);
    }
    const section = page.locator('#perspective');
    const progress = section.locator('.editorial-progress');
    const currentTitle = () => section.getByRole('heading', { level: 3 }).innerText();
    const animation = () => progress.evaluate(el => {
      const animation = el.getAnimations()[0];
      return { time: animation.currentTime, state: animation.playState, duration: animation.effect.getTiming().duration };
    });
    await page.reload(); await section.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
    const beforeHeight = (await section.boundingBox()).height;
    await page.waitForTimeout(2000);
    const midway = await animation();
    assert.equal(midway.duration, 5000); assert(midway.time > 1500 && midway.time < 4000);
    await section.locator('.editorial-slideshow').hover();
    await page.waitForTimeout(100);
    const paused = await animation();
    await page.waitForTimeout(1200);
    assert.equal((await animation()).time, paused.time);
    assert.equal(await currentTitle(), 'Relevance scoring');
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('.editorial-slide[aria-hidden=false] h3').textContent === 'Thoughtful filters');
    assert((await animation()).time < 500, 'New slide resets the progress animation');
    assert.equal((await section.boundingBox()).height, beforeHeight);
    const target = section.getByRole('button', { name: 'Next feature' });
    await target.focus(); await page.keyboard.press('Enter');
    assert.equal(await currentTitle(), 'Clearer decisions');
    assert.equal(await target.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    assert.equal(await target.evaluate(el => document.activeElement === el), true);
    await page.waitForTimeout(5200); assert.equal(await currentTitle(), 'Clearer decisions');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('.editorial-slide[aria-hidden=false] h3').textContent === 'Relevance scoring');
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
    const offscreen = await animation();
    assert.equal(offscreen.state, 'paused');
    await page.waitForTimeout(1000); assert.equal((await animation()).time, offscreen.time);
    await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    assert.equal((await animation()).state, 'running');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload(); await section.scrollIntoViewIfNeeded();
    await section.getByRole('button', { name: 'Next feature' }).click();
    assert.equal(await currentTitle(), 'Thoughtful filters');
    await page.mouse.move(0, 0); await page.keyboard.press('Tab');
    await page.waitForTimeout(5200); assert.equal(await currentTitle(), 'Thoughtful filters');
    assert.equal(await progress.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await section.locator('.editorial-slide[aria-hidden=false]').evaluate(el => getComputedStyle(el).animationName), 'none');
    const before = await page.locator('#perspective').boundingBox();
    await page.getByRole('switch', { name: 'Dark appearance' }).click();
    await page.locator('#perspective').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
    const after = await page.locator('#perspective').boundingBox();
    assert.equal(before.height, after.height); assert.equal(before.width, after.width);
    assert(await page.locator('#perspective img').evaluateAll(images => images.every(img => getComputedStyle(img).transitionDuration === '0s')));
    const touch = await browser.newPage({ viewport: { width: 375, height: 900 }, hasTouch: true, isMobile: true });
    await touch.goto(base);
    const touchSection = touch.locator('#perspective'); await touchSection.scrollIntoViewIfNeeded();
    await touchSection.getByRole('button', { name: 'Next feature' }).tap();
    await touchSection.getByRole('heading', { level: 2 }).tap();
    await touch.waitForTimeout(5200);
    assert.equal(await touchSection.getByRole('heading', { level: 3 }).innerText(), 'Clearer decisions');
    await touch.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ rows, errors }, null, 2));
    console.log(`Browser evidence: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
