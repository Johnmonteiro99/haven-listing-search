// Real local API data; map-provider traffic is always intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-price-distribution-'));
const root = path.resolve(__dirname, '../..');
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const requests = [], rows = [], errors = [];
  page.on('request', r => { if (r.url().includes('/api/listings')) requests.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>' }));
  const caption = () => page.locator('.price-histogram figcaption');
  try {
    for (const width of [375, 390, 768, 1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(base);
      await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload(); await page.getByRole('article').first().waitFor();
      await page.getByRole('button', { name: width < 768 ? 'Filters' : /More filters/, exact: width < 768 }).click();
      const modal = page.getByRole('dialog'); await caption().filter({ hasText: '12 listing records' }).waitFor();
      const bars = modal.locator('.price-histogram-bars span'); assert.equal(await bars.count(), 20);
      assert.equal(await bars.evaluateAll(els => els.reduce((sum, el) => sum + Number(el.dataset.count), 0)), 12);
      const before = requests.length;
      const minimum = modal.getByRole('slider', { name: 'Minimum price slider' });
      const maximum = modal.getByRole('slider', { name: 'Maximum price slider' });
      assert.equal(await minimum.inputValue(), '0'); assert.equal(await maximum.inputValue(), '2000000');
      assert.equal(await modal.getByLabel('Minimum price', { exact: true }).inputValue(), '');
      assert.equal(await modal.getByLabel('Maximum price', { exact: true }).inputValue(), '');
      await minimum.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await modal.getByLabel('Minimum price', { exact: true }).inputValue(), '10000');
      await maximum.focus(); await page.keyboard.press('ArrowLeft');
      assert.equal(await modal.getByLabel('Maximum price', { exact: true }).inputValue(), '1990000');
      await modal.getByLabel('Minimum price', { exact: true }).fill('450000');
      await modal.getByLabel('Maximum price', { exact: true }).fill('500000');
      await page.waitForTimeout(350); assert.equal(requests.length, before);
      assert((await modal.locator('.price-histogram-bars span[data-selected="false"][data-count]:not([data-count="0"])').count()) > 0);
      const chart = modal.locator('.price-histogram-bars');
      const styles = await chart.evaluate(el => {
        const background = getComputedStyle(el).backgroundColor;
        return [...el.children].filter(bar => Number(bar.dataset.count) > 0).map(bar => {
          const style = getComputedStyle(bar);
          return { selected: bar.dataset.selected, background: style.backgroundColor, opacity: Number(style.opacity),
            border: style.borderStyle, radius: style.borderTopLeftRadius, height: bar.getBoundingClientRect().height, container: background };
        });
      });
      assert(styles.some(bar => bar.selected === 'true') && styles.some(bar => bar.selected === 'false'));
      assert(styles.every(bar => bar.background !== 'rgba(0, 0, 0, 0)' && bar.border === 'none' && bar.radius === '3px' && bar.height > 0));
      for (const bar of styles) {
        const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const bg = rgb(bar.container), fg = rgb(bar.background).map((value, i) => value * bar.opacity + bg[i] * (1 - bar.opacity));
        const luminance = values => values.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        const a = luminance(bg), b = luminance(fg);
        bar.contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        assert(bar.contrast >= 3, `Populated bar contrast ${bar.contrast}`);
      }
      const miniHeight = (await chart.boundingBox()).height;
      assert.equal(miniHeight, 62);
      await chart.screenshot({ path: path.join(output, `${width}-${theme}-selected-mini.png`) });
      const counts = modal.locator('.price-distribution-counts summary');
      await counts.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(260);
      assert.equal((await chart.boundingBox()).height, 96);
      assert.equal(await modal.locator('.price-distribution-counts li').count(), 20);
      await chart.screenshot({ path: path.join(output, `${width}-${theme}-selected-expanded.png`) });
      await counts.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(260);
      assert.equal((await chart.boundingBox()).height, miniHeight);
      assert.equal(requests.length, before);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await maximum.focus(); await page.keyboard.press('Home');
      assert.equal(await modal.getByLabel('Maximum price', { exact: true }).inputValue(), '450000');
      await minimum.focus(); await page.keyboard.press('ArrowLeft');
      assert.equal(await modal.getByLabel('Minimum price', { exact: true }).inputValue(), '440000');
      await modal.getByRole('button', { name: 'Clear price range' }).click();
      await minimum.scrollIntoViewIfNeeded();
      const box = await minimum.boundingBox(); const start = box.x + 22, usable = box.width - 44, y = box.y + 22;
      await page.mouse.move(start, y); await page.mouse.down(); await page.mouse.move(start + usable * .25, y, { steps: 8 }); await page.mouse.up();
      const dragged = Number(await modal.getByLabel('Minimum price', { exact: true }).inputValue()); assert(dragged >= 480000 && dragged <= 520000, `Drag produced ${dragged}`);
      const maxBox = await maximum.boundingBox();
      const maxStart = maxBox.x + maxBox.width - 22, maxY = maxBox.y + 22;
      await page.mouse.move(maxStart, maxY); await page.mouse.down();
      await page.mouse.move(maxBox.x + 22 + (maxBox.width - 44) * .8, maxY, { steps: 8 }); await page.mouse.up();
      const draggedMax = Number(await modal.getByLabel('Maximum price', { exact: true }).inputValue());
      assert(draggedMax >= 1580000 && draggedMax <= 1620000, `Maximum drag produced ${draggedMax}`);
      assert.equal(Number(await modal.getByLabel('Minimum price', { exact: true }).inputValue()), dragged);
      await modal.getByLabel('Minimum price', { exact: true }).fill('2500000.25');
      await modal.getByLabel('Maximum price', { exact: true }).fill('4000000.75');
      assert((await minimum.getAttribute('aria-valuetext')).includes('above slider range'));
      assert.equal(await modal.getByLabel('Minimum price', { exact: true }).inputValue(), '2500000.25');
      await modal.getByRole('button', { name: 'Clear price range' }).click();
      await modal.locator('.advanced-filter-content').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, `${width}-${theme}-histogram.png`) });
      await page.addScriptTag({ path: path.join(root, 'frontend/node_modules/axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, []);
      await modal.getByLabel('City', { exact: true }).fill('springFIELD');
      await caption().filter({ hasText: '4 listing records' }).waitFor();
      await modal.getByRole('button', { name: '2+' }).click(); await modal.getByLabel('Description keyword', { exact: true }).fill('CONDO');
      await caption().filter({ hasText: '2 listing records' }).waitFor();
      await modal.getByLabel('Minimum price', { exact: true }).fill('900000');
      await modal.getByLabel('Maximum price', { exact: true }).fill('1000000');
      await page.waitForTimeout(350); assert((await caption().innerText()).includes('2 listing records'));
      const latest = new URL(requests.at(-1)); assert.equal(latest.searchParams.get('minPrice'), null); assert.equal(latest.searchParams.get('maxPrice'), null); assert.equal(latest.searchParams.get('targetBudget'), null);
      assert.equal(await page.getByText('12 homes match your search.', { exact: true }).count(), 1);
      await modal.getByLabel('City', { exact: true }).fill('Boston'); await modal.getByText('No price data available for this search.', { exact: true }).waitFor();
      await modal.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), '');
      assert.equal(await page.getByRole('button', { name: 'Grid', exact: true }).getAttribute('aria-pressed'), 'true');
      rows.push({ width, theme, records: 12, cityRecords: 4, condoRecords: 2, emptyBoston: true, styles, violations }); console.log(`Passed ${width}px ${theme}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.getByRole('button', { name: /More filters/ }).click();
    assert.equal(await page.getByRole('dialog').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.getByRole('dialog').locator('.dual-price-slider').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await caption().waitFor();
    assert(await page.locator('.price-histogram-bars, .price-histogram-bars span').evaluateAll(elements => elements.every(el => getComputedStyle(el).transitionDuration === '0s')));
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ rows, errors, requests }, null, 2)); console.log(JSON.stringify({ output, cases: rows.length, errors }));
  } catch (e) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error('Evidence:', output); throw e; }
  finally { await browser.close(); }
})();
