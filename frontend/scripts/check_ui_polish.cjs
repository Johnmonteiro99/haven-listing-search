// Local Chrome polish checks. Provider tiles are fixtures, never live external requests.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-polish-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const rows = [], errors = []; let calls = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/listings')) calls++; });
  await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#868d87"/></svg>' }));
  try {
    for (const width of [375, 390, 768, 1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(base);
      await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload(); await page.getByRole('article').first().waitFor();
      let before = calls;
      if (width >= 768) {
        const input = page.getByRole('textbox', { name: 'Minimum bedrooms', exact: true });
        assert.equal(await input.inputValue(), '');
        const down = page.getByRole('button', { name: 'Decrease minimum bedrooms' });
        const up = page.getByRole('button', { name: 'Increase minimum bedrooms' });
        assert.equal(await down.isDisabled(), true);
        await up.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space');
        assert.equal(await input.inputValue(), '2');
        await input.focus(); await page.keyboard.press('ArrowDown'); assert.equal(await input.inputValue(), '1');
        await down.focus(); await page.keyboard.press('Enter'); assert.equal(await input.inputValue(), '');
        assert.equal(await down.isDisabled(), true);
        await input.fill('6');
        assert.equal(await input.evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 3; }), true);
        assert.equal(calls, before);
        await page.getByRole('button', { name: /More filters/ }).click();
        const d = page.getByRole('dialog'); assert.equal(await d.getByLabel('Exact minimum bedrooms', { exact: true }).inputValue(), '6');
        await d.getByRole('button', { name: 'Close', exact: true }).click(); await input.fill('');
        assert.equal(await page.getByText('12 homes match your search.', { exact: true }).count(), 1);
        before = calls;
      }
      const switcher = page.getByRole('switch', { name: 'Dark appearance' });
      const wasDark = await switcher.getAttribute('aria-checked');
      await switcher.focus(); await page.keyboard.press('Space');
      await page.waitForFunction(t => document.documentElement.dataset.theme === t, wasDark === 'true' ? 'light' : 'dark');
      await page.keyboard.press('Enter'); await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme);
      assert.equal(await page.evaluate(() => localStorage.getItem('haven-theme')), theme);
      assert.equal(calls, before);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-controls.png`) });
      const mapToggle = page.getByRole('button', { name: 'Map', exact: true });
      await mapToggle.focus(); await page.keyboard.press('Space'); await page.locator('.haven-map-marker').first().waitFor(); await page.waitForTimeout(500);
      assert.equal(await mapToggle.getAttribute('aria-pressed'), 'true'); assert.equal(calls, before);
      const cards = await page.locator('.map-results .listing-card').evaluateAll(els => els.map(el => {
        const s = getComputedStyle(el); return { background: s.backgroundColor, border: parseFloat(s.borderTopWidth), radius: parseFloat(s.borderRadius), padding: parseFloat(getComputedStyle(el.querySelector('.listing-body')).paddingLeft) };
      }));
      assert(cards.every(c => c.border >= 1 && c.radius >= 6 && c.padding >= 12 && c.background !== 'rgba(0, 0, 0, 0)'));
      const geometry = await page.locator('.map-pane').evaluate(el => ({ position: getComputedStyle(el).position, height: el.getBoundingClientRect().height }));
      if (width >= 1200) {
        assert.equal(geometry.position, 'sticky');
        const elevation = await page.locator('.map-pane').evaluate(el => {
          const style = getComputedStyle(el);
          return { border: style.borderTopWidth, radius: style.borderTopLeftRadius, shadow: style.boxShadow };
        });
        assert.equal(elevation.border, '1px'); assert.equal(elevation.radius, '10px'); assert.notEqual(elevation.shadow, 'none');
        await page.locator('.results-workspace').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 350));
        assert(Math.abs((await page.locator('.map-pane').boundingBox()).y - await page.locator('.map-pane').evaluate(el => parseFloat(getComputedStyle(el).top))) < 2);
        assert.equal(await page.locator('.map-results').evaluate(el => el.scrollTop), 0);
        const leftFirst = await page.locator('.map-results .listing-card').first().boundingBox();
        await page.evaluate(() => window.scrollBy(0, 400));
        assert(Math.abs((await page.locator('.map-pane').boundingBox()).y - await page.locator('.map-pane').evaluate(el => parseFloat(getComputedStyle(el).top))) < 2);
        assert((await page.locator('.map-results .listing-card').first().boundingBox()).y < leftFirst.y - 390);
        await page.locator('.results-workspace').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().bottom + scrollY - 250));
        assert.equal(await page.evaluate(() => document.querySelector('.map-pane').getBoundingClientRect().bottom <= document.querySelector('.results-workspace').getBoundingClientRect().bottom + 1), true);
      } else assert.notEqual(geometry.position, 'sticky');
      await page.locator('.results-workspace').evaluate(el => el.scrollIntoView({ block: 'start' }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-map.png`) });
      rows.push({ width, theme, cards: cards.length, geometry }); console.log(`Passed ${width}px ${theme}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await page.evaluate(() => [...document.querySelectorAll('.view-toggle button,.theme-toggle,.theme-thumb,.theme-thumb svg')].map(el => getComputedStyle(el).transitionDuration));
    assert(motion.every(v => v === '0s'));
    await page.getByRole('button', { name: 'Auto: use system appearance' }).click();
    await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('haven-theme')), 'system');
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ rows, errors, motion }, null, 2)); console.log(JSON.stringify({ output, cases: rows.length }));
  } catch (e) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error(output); throw e; }
  finally { await browser.close(); }
})();
