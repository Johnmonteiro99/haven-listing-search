// Supplement the existing feature suites with 320px, failure recovery and lifecycle checks.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-audit-journeys-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5190';
const axe = path.resolve(__dirname, '../node_modules/axe-core/axe.min.js');
const tilePattern = /https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//;
const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#858c87"/></svg>';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { rows: [], errors: [], console: [], failures: [], lifecycle: [] };
  const page = await browser.newPage();
  let phase = 'responsive';
  page.on('pageerror', e => report.errors.push({ phase, message: e.message }));
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) report.console.push({ phase, type: m.type(), message: m.text() }); });
  page.on('requestfailed', r => report.failures.push({ phase, url: r.url(), error: r.failure()?.errorText }));
  await page.route(tilePattern, r => r.fulfill({ contentType: 'image/svg+xml', body: tile }));
  async function audit(state) {
    await page.addScriptTag({ path: axe });
    const result = await page.evaluate(async () => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      violations: (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) }));
    report.rows.push({ state, ...result });
    await page.screenshot({ path: path.join(output, state + '.png') });
    assert.equal(result.overflow, false, state + ' overflow');
    const unexpected = result.violations.filter(v => !(v.id === 'target-size' && v.targets.every(t => t.some(s => s.includes('haven-map-marker')))));
    assert.deepEqual(unexpected, [], state);
  }
  try {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(base); await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload();
      await page.getByText('12 homes match your search.', { exact: true }).waitFor(); await page.waitForTimeout(500);
      await audit('320-' + theme + '-initial');
      await page.getByRole('button', { name: /View details for/ }).first().click();
      await page.getByRole('dialog').waitFor(); await page.waitForTimeout(450);
      await audit('320-' + theme + '-details');
      await page.keyboard.press('Escape');
      assert(await page.getByRole('button', { name: /View details for/ }).first().evaluate(e => e === document.activeElement));
      await page.locator('#results-heading').evaluate(e => e.scrollIntoView()); await page.waitForTimeout(350);
      await audit('320-' + theme + '-capsule');
      await page.getByRole('button', { name: 'Map', exact: true }).click();
      await page.locator('.haven-map-marker').first().waitFor(); await page.waitForTimeout(600);
      await audit('320-' + theme + '-map');
      await page.getByRole('button', { name: /Select .* on map/ }).first().click();
      await page.getByRole('region', { name: 'Selected property' }).waitFor(); await page.waitForTimeout(300);
      await audit('320-' + theme + '-featured');
      await page.locator('#perspective').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
      await audit('320-' + theme + '-footer');
    }
    phase = 'failures';
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const mode of ['500', 'network', 'invalid-json', '422']) {
      phase = 'injected-' + mode;
      await page.route('**/api/listings?*', async route => {
        if (mode === 'network') return route.abort('failed');
        const status = mode === '500' ? 500 : mode === '422' ? 422 : 200;
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(mode === '422' ? { detail: [{ loc: ['query', 'city'], msg: 'Invalid city' }] } : {}) });
      });
      await page.goto(base); await page.getByRole('button', { name: 'Retry search' }).waitFor();
      assert.equal(await page.getByRole('article').count(), 0);
      if (mode === '422') assert((await page.locator('.results-summary').innerText()).includes('Check your filters:'));
      await page.unroute('**/api/listings?*');
      await page.getByRole('button', { name: 'Retry search' }).click();
      await page.getByText('12 homes match your search.', { exact: true }).waitFor();
      report.rows.push({ state: phase, recovered: true });
    }
    phase = 'delayed-stale';
    await page.route('**/api/listings?*', async route => {
      if (new URL(route.request().url()).searchParams.get('city') !== 'Boston') return route.continue();
      const response = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({ response }).catch(() => {}); // An aborted obsolete request is expected.
    });
    const form = page.getByRole('form', { name: 'Search homes' });
    await form.getByLabel('City', { exact: true }).fill('Boston'); await form.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('[aria-busy="true"]').waitFor();
    await form.getByLabel('City', { exact: true }).fill('Springfield'); await form.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText('4 homes match your search.', { exact: true }).waitFor();
    await page.waitForTimeout(1700); assert.equal(await page.getByText('4 homes match your search.', { exact: true }).count(), 1);
    await page.unroute('**/api/listings?*');
    report.rows.push({ state: phase, staleIgnored: true, loadingVisible: true });
    phase = 'map-lifecycle';
    await page.goto(base); await page.getByRole('article').first().waitFor();
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
    // Collect after GC and compare warmed cycles, not raw transient allocation peaks.
    for (let cycle = 0; cycle < 9; cycle++) {
      await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.locator('.haven-map-marker').first().waitFor(); await page.waitForTimeout(500);
      const map = page.locator('.leaflet-container'); await map.evaluate(e => { window.auditMap = e; });
      await page.getByRole('switch', { name: 'Dark appearance' }).click();
      assert(await map.evaluate(e => e === window.auditMap));
      await page.getByRole('button', { name: 'Grid', exact: true }).click(); assert.equal(await map.count(), 0);
      await page.evaluate(() => { delete window.auditMap; });
      await cdp.send('HeapProfiler.collectGarbage');
      const dom = await cdp.send('Memory.getDOMCounters');
      const metrics = await cdp.send('Performance.getMetrics');
      report.lifecycle.push({ cycle, ...dom, heap: metrics.metrics.find(m => m.name === 'JSHeapUsedSize').value });
    }
    phase = 'tile-failure';
    await page.unroute(tilePattern); await page.route(tilePattern, r => r.abort('failed'));
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.getByText('Some map tiles could not load. Listing markers and cards remain available.', { exact: false }).waitFor();
    assert(await page.locator('.haven-map-marker').count() > 0);
    assert(await page.locator('.leaflet-control-attribution').isVisible());
    await page.getByRole('button', { name: /Select .* on map/ }).first().click();
    await page.getByRole('region', { name: 'Selected property' }).waitFor();
    report.rows.push({ state: phase, markersAndSelectionSurvive: true });
    assert.deepEqual(report.errors, []);
    console.log('Supplemental journeys passed:', report.rows.length);
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Journey evidence:', output); await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
