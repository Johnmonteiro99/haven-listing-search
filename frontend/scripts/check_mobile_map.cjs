// Optional local Chrome check; use an existing Playwright installation through NODE_PATH.
// Fixture tiles prevent repeated provider downloads. This checks Leaflet/UI, not live cartography.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'haven-mobile-map-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
const camera = page => page.locator('.leaflet-container').evaluate(el => ({
  pane: el.querySelector('.leaflet-map-pane').style.transform,
  pins: [...el.querySelectorAll('.haven-map-marker')].map(pin => pin.style.transform),
}));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const rows = [], errors = [];
  let page;
  try {
    for (const [width, height] of [[320,568], [375,667], [390,844], [430,932]]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
        await context.addInitScript(theme => localStorage.setItem('haven-theme', theme), theme);
        await context.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, route => route.fulfill({ contentType: 'image/svg+xml', body:
          `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${theme === 'dark' ? '#171c1c' : '#e4e8df'}"/><path d="M0 90L256 160M80 0L170 256M0 250L220 0" stroke="${theme === 'dark' ? '#343c3b' : '#faf9f5'}" stroke-width="8"/></svg>` }));
        page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        let searches = 0;
        page.on('request', req => { if (new URL(req.url()).pathname === '/api/listings') searches++; });
        await page.goto(base);
        await page.getByRole('article').first().waitFor();
        const initial = searches;
        await page.getByRole('button', { name: 'Map', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.locator('.haven-map-marker').first().waitFor();
        await page.waitForTimeout(600);
        const header = page.locator('.mobile-map-header');
        assert.equal(await header.getByRole('button', { name: 'Map', exact: true }).evaluate(e => e === document.activeElement), true);
        assert.equal(searches, initial);
        // Every shared-location choice must be reachable even near the floating header.
        const sharedPins = page.getByRole('button', { name: /Choose an MLS record/ });
        for (let index = 0; index < await sharedPins.count(); index++) {
          const pin = sharedPins.nth(index);
          await pin.focus(); await page.keyboard.press('Enter');
          const group = page.getByRole('group', { name: 'Choose a listing at this location' });
          await group.getByRole('button').first().waitFor();
          assert.equal(await group.getByRole('button').first().evaluate(e => e === document.activeElement), true);
          assert.ok(await group.getByRole('button').evaluateAll(buttons => buttons.every(el => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          })));
          await page.keyboard.press('Escape');
          assert.equal(await pin.evaluate(e => e === document.activeElement), true);
        }
        const before = await camera(page);
        const marker = page.getByRole('button', { name: /2 listings at 123 Main St/ });
        await marker.focus(); await page.keyboard.press('Space');
        const chooser = page.getByRole('group', { name: 'Choose a listing at this location' });
        await chooser.getByRole('button', { name: /MLS_B \/ B7/ }).click();
        const card = page.locator('.mobile-map-card');
        await card.getByRole('heading', { name: '123 Main Street, Unit 4B' }).waitFor();
        assert.equal(await card.getByRole('heading').evaluate(e => e === document.activeElement), true);
        assert.equal(await page.locator('.haven-map-marker.is-selected').count(), 1);
        await card.getByRole('button', { name: 'Next property', exact: true }).focus();
        await page.keyboard.press('Enter');
        assert.equal(await card.getByRole('button', { name: 'Next property', exact: true }).evaluate(e => e === document.activeElement), true);
        await card.getByRole('button', { name: 'Previous property', exact: true }).tap();
        assert.equal(await card.getByRole('heading').innerText(), '123 Main Street, Unit 4B');
        assert.deepEqual(await camera(page), before);
        assert.equal(searches, initial);
        const details = card.getByRole('button', { name: /View details/ });
        await details.click(); await page.getByRole('dialog').waitFor();
        assert.equal(await page.getByRole('dialog').getByText('B7', { exact: true }).count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await details.evaluate(e => e === document.activeElement), true);
        await page.addScriptTag({ path: path.resolve(__dirname, '../node_modules/axe-core/axe.min.js') });
        const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
        assert.deepEqual(violations.filter(v => v.id !== 'target-size' || v.nodes.some(target => !target.every(s => s.includes('haven-map-marker')))), []);
        const metrics = await page.evaluate(() => {
          const rect = s => document.querySelector(s).getBoundingClientRect();
          const header = rect('.mobile-map-header'), card = rect('.mobile-map-card'), dock = rect('.mobile-map-dock');
          const close = rect('.mobile-map-close'), next = rect('.mobile-map-next');
          return { overflow: document.documentElement.scrollWidth > innerWidth, headerBottom: header.bottom,
            cardTop: card.top, cardBottom: card.bottom, dockTop: dock.top, dockBottom: dock.bottom,
            imageControlsOverlap: close.bottom > next.top,
            mapControlsBottom: rect('.map-toolbar').bottom,
            targets: [...document.querySelectorAll('.mobile-map-header button, .mobile-map-card button, .mobile-map-dock button, .map-toolbar button')].map(el => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })) };
        });
        assert.equal(metrics.overflow, false); assert.ok(metrics.cardTop > metrics.headerBottom);
        assert.ok(metrics.cardBottom < metrics.dockTop); assert.ok(metrics.dockBottom < height);
        assert.equal(metrics.imageControlsOverlap, false);
        assert.ok(metrics.mapControlsBottom < metrics.cardTop);
        assert.ok(metrics.targets.every(t => t.w >= 44 && t.h >= 44), JSON.stringify(metrics.targets));
        await card.evaluate(el => el.scrollTop = 0);
        await page.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
        await header.getByRole('switch').click();
        assert.equal(await card.getByRole('heading').innerText(), '123 Main Street, Unit 4B');
        assert.deepEqual(await camera(page), before); assert.equal(searches, initial);
        await card.getByRole('button', { name: 'Close selected property' }).click();
        assert.equal(await page.getByRole('button', { name: /Browse homes on this page/ }).evaluate(e => e === document.activeElement), true);
        await page.getByRole('button', { name: 'Next page', exact: true }).click();
        await page.getByRole('button', { name: /2 on page 2 of 2/ }).waitFor();
        assert.equal(await page.locator('.mobile-map-card').count(), 0);
        assert.equal(await page.locator('.haven-map-marker').count(), 2);
        assert.equal(searches, initial + 1);
        await header.getByRole('button', { name: 'Filters', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Filters' });
        await dialog.getByLabel('City', { exact: true }).fill('Discard me');
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        assert.equal(await header.getByRole('searchbox').inputValue(), '');
        assert.equal(await header.getByRole('button', { name: 'Filters', exact: true }).evaluate(e => e === document.activeElement), true);
        await header.getByRole('searchbox').fill('Springfield');
        await header.getByRole('button', { name: 'Filters', exact: true }).click();
        assert.equal(await dialog.getByLabel('City', { exact: true }).inputValue(), 'Springfield');
        await dialog.locator('.price-histogram figcaption').filter({ hasText: '4 listing records' }).waitFor();
        const beforeApply = searches;
        await dialog.getByRole('button', { name: 'Apply filters' }).click();
        await page.getByRole('button', { name: /4 on page 1 of 1/ }).waitFor();
        assert.equal(searches, beforeApply + 1);
        await header.getByRole('searchbox').fill('No such city');
        await header.getByRole('searchbox').press('Enter');
        await page.getByRole('heading', { name: 'A fresh start.' }).waitFor();
        await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
        await page.getByRole('button', { name: /10 on page 1 of 2/ }).waitFor();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.getByRole('button', { name: /Browse homes on this page/ }).click();
        assert.equal(await page.locator('.map-pane').evaluate(el => getComputedStyle(el).animationName), 'none');
        await header.getByRole('button', { name: 'Grid', exact: true }).click();
        assert.equal(await page.locator('html.mobile-map-mode').count(), 0);
        assert.equal(await page.getByRole('article').count(), 10);
        assert.equal(await page.getByRole('button', { name: 'Grid', exact: true }).evaluate(e => e === document.activeElement), true);
        rows.push({ width, height, theme, metrics, violations });
        console.log(`Passed ${width}x${height} ${theme}`);
        await context.close();
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ rows, errors, tiles: 'fixtures, not live provider' }, null, 2));
    console.log(`Browser evidence: ${output}`);
  } catch (error) {
    if (page && !page.isClosed()) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error((await page.locator('body').innerText()).slice(-1800)); }
    console.error(`Evidence: ${output}`); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
