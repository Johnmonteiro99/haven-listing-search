// Optional real-Chrome check using Playwright via NODE_PATH; never downloads provider map tiles.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '../..');
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-filters-'));
const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9e5db"/></svg>';
async function open(page, width) {
  const trigger = page.getByRole('button', { name: width < 768 ? 'Filters' : /More filters/, exact: width < 768 });
  await trigger.focus(); await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog', { name: 'Filters', exact: true });
  await modal.waitFor(); await page.waitForTimeout(300);
  assert.equal(await modal.getByRole('button', { name: 'Close', exact: true }).evaluate(el => el === document.activeElement), true);
  return { trigger, modal };
}
async function audit(page) {
  await page.addScriptTag({ path: path.join(root, 'frontend/node_modules/axe-core/axe.min.js') });
  return page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: tile }));
  const page = await context.newPage();
  const errors = [], requests = [], rows = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/listings')) requests.push(r.url()); });
  try {
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base); await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload();
      await page.getByRole('article').first().waitFor();
      await page.getByLabel('City', { exact: true }).fill('Unsent city');
      const { trigger, modal } = await open(page, width);
      assert.equal(await modal.getByLabel('City', { exact: true }).inputValue(), 'Unsent city');
      const geometry = await modal.evaluate(el => {
        const r = el.getBoundingClientRect(); const content = el.querySelector('.advanced-filter-content');
        const footer = el.querySelector('.advanced-filter-actions').getBoundingClientRect();
        return { width: r.width, height: r.height, overflow: el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth,
          bodyLocked: document.body.style.overflow === 'hidden', scrolling: content.scrollHeight > content.clientHeight,
          footerVisible: footer.top >= r.top && footer.bottom <= r.bottom + 1,
          animation: getComputedStyle(el).animationDuration,
          imageReady: el.querySelector('img').complete && el.querySelector('img').naturalWidth > 0,
          image: el.querySelector('img').currentSrc };
      });
      assert.equal(geometry.overflow, false); assert.equal(geometry.bodyLocked, true); assert.equal(geometry.scrolling, true);
      assert.equal(geometry.footerVisible, true); assert.equal(geometry.imageReady, true); assert(geometry.image.includes(`haven-filters-panel-${theme === 'dark' ? 'night' : 'day'}`));
      assert.equal(geometry.animation, '0.25s');
      if (width < 768) { assert.equal(geometry.width, width); assert.equal(geometry.height, 900); }
      else { assert(geometry.width <= 960); assert(geometry.height <= 900 * .9); }
      await page.keyboard.press('Shift+Tab');
      assert.equal(await modal.getByRole('button', { name: 'Apply filters' }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      for (let i = 0; i < 28; i++) {
        await page.keyboard.press('Tab');
        assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true);
      }
      await modal.getByRole('button', { name: 'Apply filters' }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await modal.getByRole('button', { name: 'Close' }).evaluate(el => el === document.activeElement), true);
      await modal.locator('.advanced-filter-content').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, `${width}-${theme}-top.png`) });
      const violations = await audit(page); assert.deepEqual(violations, []);
      assert.equal(await modal.getByRole('button', { name: 'Rent Coming soon' }).isDisabled(), true);
      for (const name of ['Property type', 'Amenities', 'Lifestyle', 'Listing preferences']) assert.equal(await modal.getByRole('button', { name: name + ' Coming soon' }).isDisabled(), true);
      await modal.getByLabel('Target budget', { exact: true }).fill('0');
      await modal.getByRole('button', { name: 'Apply filters' }).click();
      const alert = modal.getByRole('alert');
      assert.equal(await alert.evaluate(el => el === document.activeElement), true);
      assert.equal(await alert.evaluate(el => { const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; }), true);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-error.png`) });
      await modal.getByRole('button', { name: 'Reset all' }).click();
      assert.equal(await modal.getByLabel('City', { exact: true }).inputValue(), '');
      await modal.locator('.advanced-filter-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.screenshot({ path: path.join(output, `${width}-${theme}-bottom.png`) });
      // Preview requests are independent; neither reset nor cancellation applies the unsent city.
      assert.equal(await page.getByText('12 homes match your search.', { exact: true }).count(), 1);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Unsent city');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      rows.push({ width, theme, geometry, violations });
    }
    // Short touch-sized and landscape/tablet heights retain the same fixed actions.
    for (const [width, height] of [[320, 568], [375, 667], [768, 600]]) {
      await page.setViewportSize({ width, height });
      const { modal } = await open(page, width);
      assert.equal(await modal.evaluate(el => {
        const r = el.getBoundingClientRect(), f = el.querySelector('.advanced-filter-actions').getBoundingClientRect();
        return el.scrollWidth <= el.clientWidth && f.bottom <= innerHeight && f.top >= r.top;
      }), true);
      await modal.getByLabel('Description keyword', { exact: true }).fill('draft');
      assert.equal(await modal.getByLabel('Description keyword', { exact: true }).evaluate(el => {
        const r = el.getBoundingClientRect(), p = el.closest('.advanced-filter-content').getBoundingClientRect();
        return r.top - 7 >= p.top && r.bottom + 7 <= p.bottom;
      }), true);
      await page.screenshot({ path: path.join(output, `${width}x${height}-short.png`) });
      await modal.getByRole('button', { name: 'Close' }).click();
    }
    // Real combined query in Grid, then the same query in Map after a featured selection.
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base); await page.getByRole('article').first().waitFor();
    for (const mode of ['Grid', 'Map']) {
      if (mode === 'Map') {
        await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.locator('.haven-map-marker').first().waitFor();
        await page.getByRole('button', { name: /Select .* on map/ }).first().click();
        await page.getByRole('region', { name: 'Selected property' }).waitFor();
      }
      const { modal } = await open(page, 1440);
      for (const [label, value] of [['City', ' Springfield '], ['Minimum price', '0'], ['Maximum price', '500000'], ['Exact minimum bedrooms', '2'], ['Target budget', '500000'], ['Description keyword', 'CONDO']]) await modal.getByLabel(label, { exact: true }).fill(value);
      const before = requests.length;
      const response = page.waitForResponse(r => r.url().includes('/api/listings') && r.request().method() === 'GET');
      await modal.getByRole('button', { name: 'Apply filters' }).click();
      const result = await (await response).json();
      assert.equal(result.totalCount, 2); await page.getByText('2 homes match your search.', { exact: true }).waitFor();
      assert.equal(requests.length, before + 1);
      const params = Object.fromEntries(new URL(requests.at(-1)).searchParams);
      assert.deepEqual(params, { minPrice: '0', maxPrice: '500000', minBedrooms: '2', city: 'Springfield', keyword: 'CONDO', targetBudget: '500000', page: '1', pageSize: '10' });
      assert.equal(await page.getByRole('button', { name: mode, exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByRole('region', { name: 'Selected property' }).count(), 0);
      if (mode === 'Map') {
        await page.locator('.haven-map-marker').first().waitFor(); assert.equal(await page.locator('.haven-map-marker').count(), 1);
        assert.equal(await page.getByRole('article').count(), 2);
      }
    }
    const { modal } = await open(page, 1440); await modal.getByLabel('City', { exact: true }).fill('No matching city');
    await modal.getByRole('button', { name: 'Apply filters' }).click(); await page.getByText(/No homes match/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Map', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.haven-map-marker').count(), 0);
    // Native theme owner responds to system updates even while the modal is open.
    await page.getByRole('button', { name: 'Auto: use system appearance' }).click(); await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const reduced = await open(page, 1440);
    assert.equal(await reduced.modal.evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert((await reduced.modal.locator('img').getAttribute('src')).includes('haven-filters-panel-night'));
    await page.keyboard.press('Escape'); await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('haven-theme')), 'system');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ rows, requests, errors, realQueries: 'Grid and Map: 2 actual CONDO records, one grouped marker; empty Map clears markers', reducedMotion: true, systemThemeWhileOpen: true }, null, 2));
    console.log(JSON.stringify({ output, responsiveCases: rows.length, axeViolations: 0, realGridMapQueries: true, errors }));
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error('Artifacts:', output); throw error; }
  finally { await browser.close(); }
})();
