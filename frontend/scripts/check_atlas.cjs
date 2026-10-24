// Atlas-specific interaction/geometry checks; all tile traffic uses an explicit neutral fixture.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-atlas-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const rows = [], errors = []; let calls = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/listings')) calls++; });
  await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, route => {
    const dark = route.request().url().includes('_dark');
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${dark ? '#1a1c1e' : '#e9e5db'}"/><path d="M0 0H256V256H0Z M128 0V256 M0 128H256" fill="none" stroke="${dark ? '#333638' : '#d2d2c7'}"/></svg>` });
  });
  try {
    for (const width of [375, 390, 768, 1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(base);
      await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload();
      await page.getByRole('article').first().waitFor(); const before = calls;
      await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.locator('.haven-map-marker').first().waitFor();
      await page.waitForTimeout(500); await page.locator('.results-workspace').evaluate(el => el.scrollIntoView({ block: 'start' }));
      const map = page.locator('.listing-map'), panel = page.locator('.map-results');
      const geometry = await page.evaluate(() => {
        const m = document.querySelector('.listing-map').getBoundingClientRect(), p = document.querySelector('.map-results').getBoundingClientRect();
        return { map: { x: m.x, y: m.y, width: m.width, height: m.height }, panel: { x: p.x, y: p.y, width: p.width, height: p.height }, overflow: document.documentElement.scrollWidth > innerWidth,
          panelColor: getComputedStyle(document.querySelector('.map-results')).backgroundColor,
          controlSizes: [...document.querySelectorAll('.map-toolbar button')].map(b => ({ w: b.offsetWidth, h: b.offsetHeight, radius: getComputedStyle(b).borderRadius })) };
      });
      assert.equal(geometry.overflow, false); assert(geometry.controlSizes.every(b => b.w >= 44 && b.h >= 44 && b.radius === '50%'));
      if (width >= 1200) {
        assert(geometry.map.x > geometry.panel.x + geometry.panel.width); assert(geometry.map.width > geometry.panel.width);
        assert.equal(await panel.evaluate(el => getComputedStyle(el).overflowY), 'visible');
        assert.equal(await map.evaluate(el => getComputedStyle(el.closest('.map-pane')).position), 'sticky');
        const initialTransform = await map.locator('.leaflet-map-pane').getAttribute('style');
        const box = await panel.boundingBox(); await page.mouse.move(box.x + 100, box.y + 250); await page.mouse.wheel(0, 300); await page.waitForTimeout(400);
        const scroll = await page.evaluate(() => scrollY); assert(scroll > 0);
        assert.equal(await panel.evaluate(el => el.scrollTop), 0);
        const stickyTop = await map.evaluate(el => parseFloat(getComputedStyle(el.closest('.map-pane')).top) + 1);
        assert(Math.abs((await map.boundingBox()).y - stickyTop) < 2);
        assert.equal(await map.locator('.leaflet-map-pane').getAttribute('style'), initialTransform);
        const mb = await map.boundingBox(); const pb = await panel.boundingBox();
        await page.mouse.move(mb.x + mb.width - 200, mb.y + mb.height / 2); await page.mouse.down();
        await page.mouse.move(mb.x + mb.width - 310, mb.y + mb.height / 2 + 30, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(400);
        assert.notEqual(await map.locator('.leaflet-map-pane').getAttribute('style'), initialTransform);
        assert.equal(await page.evaluate(() => scrollY), scroll); assert.deepEqual(await panel.boundingBox(), pb);
      } else {
        assert(Math.abs(geometry.map.width - geometry.panel.width) < 2); assert(geometry.panel.y >= geometry.map.y + geometry.map.height - 10);
      }
      const zoom = page.getByRole('button', { name: 'Zoom in', exact: true }); await zoom.focus(); await page.keyboard.press('Enter');
      assert.equal(await zoom.evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 3; }), true);
      await page.getByRole('button', { name: 'Fit visible listings' }).click();
      await page.waitForTimeout(200);
      await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].every(tile => tile.complete));
      if (width >= 1200) {
        const fittedMap = await map.boundingBox();
        const markerBounds = await page.locator('.haven-map-marker').evaluateAll(markers => markers.map(m => {
          const r = m.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }));
        assert(markerBounds.every(r => r.left >= fittedMap.x && r.right <= fittedMap.x + fittedMap.width && r.top >= fittedMap.y && r.bottom <= fittedMap.y + fittedMap.height));
      }
      assert.equal(calls, before);
      const prices = await page.locator('.haven-map-marker').allTextContents(); assert(prices.some(p => /^\$\d/.test(p.trim())));
      await panel.evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, `${width}-${theme}-canvas.png`) });
      await page.getByRole('button', { name: /Select .* on map/ }).first().click();
      await page.getByRole('region', { name: 'Selected property' }).waitFor(); await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-featured.png`) });
      await page.getByRole('button', { name: /Close selection/ }).click(); assert.equal(await page.getByRole('button', { name: 'Map', exact: true }).getAttribute('aria-pressed'), 'true');
      console.log(`Passed ${width}px ${theme}`);
      assert.equal(calls, before); rows.push({ width, theme, geometry, prices });
    }
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ rows, errors, tiles: 'fixtures, not provider evidence' }, null, 2)); console.log(JSON.stringify({ output, cases: rows.length, errors }));
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error(output); throw error; }
  finally { await browser.close(); }
})();
