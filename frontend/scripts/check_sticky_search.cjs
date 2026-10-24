// Local Chrome capsule audit. External map tiles are always intercepted fixtures.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-capsule-'));
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const rows = [], errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/listings') requests.push(request.url()); });
  await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#727a75"/></svg>' }));
  const capsule = page.getByRole('navigation', { name: 'Search and results controls' });
  const city = capsule.getByRole('textbox', { name: 'Search a city' });
  async function reveal() {
    await page.locator('.search-panel').evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().bottom + 20));
    await capsule.waitFor({ state: 'visible' }); await page.waitForTimeout(280);
  }
  async function audit() {
    await page.addScriptTag({ path: path.resolve(__dirname, '../node_modules/axe-core/axe.min.js') });
    const violations = await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations.filter(v => v.id !== 'target-size' || v.nodes.some(target => !target.every(selector => selector.includes('haven-map-marker')))), []);
    return violations;
  }
  async function submit(action, expected) {
    const before = requests.length;
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/listings');
    await action(); const result = await response;
    const params = Object.fromEntries(new URL(result.url()).searchParams);
    const data = await result.json(); assert.equal(data.page, 1);
    for (const [key, value] of Object.entries(expected)) assert.equal(params[key], value);
    await page.waitForFunction(count => document.querySelector('.results-summary').textContent.includes(`${count} homes match`), data.totalCount);
    await page.waitForTimeout(350); assert.equal(requests.length, before + 1);
    assert.equal(await capsule.getByRole('button', { name: 'Map', exact: true }).getAttribute('aria-pressed'), 'true');
    return data;
  }
  try {
    for (const width of [375, 390, 768, 1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(base);
      await page.evaluate(t => localStorage.setItem('haven-theme', t), theme); await page.reload();
      await page.getByRole('article').first().waitFor(); await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
      assert.equal(await capsule.count(), 0);
      const formGeometry = await page.locator('.search-panel').evaluate(el => ({ height: el.offsetHeight, width: el.offsetWidth, y: el.getBoundingClientRect().top + scrollY }));
      const before = requests.length;
      await page.locator('#search-city').fill('Springfield'); await reveal();
      assert.equal(await city.inputValue(), 'Springfield');
      assert.equal(await city.getAttribute('placeholder'), 'Search a city...');
      await city.fill('Arlington'); assert.equal(await page.locator('#search-city').inputValue(), 'Arlington');
      await city.fill('Springfield'); assert.equal(requests.length, before);
      assert.equal(await page.getByRole('group', { name: 'Results view', exact: true }).count(), 1);
      assert.deepEqual(await page.locator('.search-panel').evaluate(el => ({ height: el.offsetHeight, width: el.offsetWidth, y: el.getBoundingClientRect().top + scrollY })), formGeometry);
      const geometry = await capsule.evaluate(el => {
        const box = el.getBoundingClientRect(), shell = el.querySelector(innerWidth < 768 ? '.capsule-form' : '.sticky-search-inner');
        const style = getComputedStyle(shell, '::before');
        return { x: box.x, top: box.top, width: box.width, height: box.height, bottom: box.bottom,
          background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius,
          input: getComputedStyle(el.querySelector('input')).backgroundColor,
          transparentWrapper: getComputedStyle(el).backgroundColor,
          overflow: document.documentElement.scrollWidth > innerWidth,
          targets: [...el.querySelectorAll('button,input')].map(c => ({ width: c.offsetWidth, height: c.offsetHeight })) };
      });
      assert.equal(geometry.overflow, false); assert(geometry.width <= 1040 && geometry.width < width);
      assert(Math.abs((width - geometry.width) / 2 - geometry.x) < 1);
      assert.equal(geometry.top, width < 768 ? 12 : 16); assert.equal(geometry.height, width < 768 ? 122 : 68);
      assert.equal(geometry.transparentWrapper, 'rgba(0, 0, 0, 0)'); assert.equal(geometry.radius, '999px');
      assert.equal(geometry.background, theme === 'light' ? 'rgb(251, 250, 247)' : 'rgb(17, 19, 21)');
      assert.equal(geometry.input, theme === 'light' ? 'rgb(242, 240, 234)' : 'rgb(27, 29, 31)');
      assert(geometry.targets.every(t => t.width >= 44 && t.height >= 44));
      const violations = await audit();
      await page.screenshot({ path: path.join(output, `${width}-${theme}-grid.png`) });
      await city.focus(); await page.keyboard.press('Tab');
      const filters = capsule.getByRole('button', { name: 'Advanced filters' });
      assert.equal(await filters.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      const advanced = page.getByRole('dialog', { name: 'Filters', exact: true });
      assert.equal(await advanced.getByLabel('City', { exact: true }).inputValue(), 'Springfield');
      await advanced.getByLabel('City', { exact: true }).fill('Discard this'); await page.keyboard.press('Escape');
      assert.equal(await filters.evaluate(el => el === document.activeElement), true); assert.equal(await city.inputValue(), 'Springfield');
      await page.waitForTimeout(350); const beforeMap = requests.length;
      await capsule.getByRole('button', { name: 'Map', exact: true }).click();
      await page.locator('.haven-map-marker').first().waitFor(); await page.waitForTimeout(600);
      await page.locator('.results-workspace').evaluate(el => el.scrollIntoView({ block: 'start' }));
      if (width >= 1200) await page.mouse.wheel(0, 300);
      await page.waitForTimeout(280);
      const mapTop = (await page.locator('.map-pane').boundingBox()).y;
      const bottom = (await capsule.boundingBox()).y + (await capsule.boundingBox()).height;
      if (width >= 1200) assert(Math.abs(mapTop - bottom - 24) < 2);
      const camera = await page.locator('.leaflet-map-pane').getAttribute('style');
      await page.getByRole('button', { name: /Select .* on map/ }).first().click();
      await page.getByRole('region', { name: 'Selected property' }).waitFor();
      assert.equal(await page.locator('.leaflet-map-pane').getAttribute('style'), camera);
      await page.getByRole('button', { name: /Close selection/ }).click();
      assert.equal(requests.length, beforeMap);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-map.png`) });
      await page.getByRole('button', { name: 'Next page' }).click(); await page.locator('.page-summary').filter({ hasText: 'Page 2 of 2' }).waitFor(); await page.waitForTimeout(280);
      assert.equal(await page.locator('#results-heading').evaluate(el => el === document.activeElement), true);
      assert((await page.locator('#results-heading').boundingBox()).y >= (await capsule.boundingBox()).y + (await capsule.boundingBox()).height);
      await submit(() => city.press('Enter'), { city: 'Springfield', page: '1' });
      await filters.click();
      for (const [label, value] of [['Minimum price', '100000'], ['Maximum price', '500000'], ['Exact minimum bedrooms', '2'], ['Target budget', '500000'], ['Description keyword', 'CONDO']]) await advanced.getByLabel(label, { exact: true }).fill(value);
      const applied = page.waitForResponse(r => r.url().includes('minPrice=100000') && r.url().includes('targetBudget=500000'));
      await advanced.getByRole('button', { name: 'Apply filters' }).click(); await applied; await page.waitForTimeout(350);
      assert.equal(await capsule.locator('.capsule-filter-count').innerText(), '5');
      await city.fill('springFIELD');
      await submit(() => capsule.getByRole('button', { name: 'Search', exact: true }).click(), {
        city: 'springFIELD', minPrice: '100000', maxPrice: '500000', minBedrooms: '2', targetBudget: '500000', keyword: 'CONDO', page: '1',
      });
      const beforeTheme = requests.length;
      await page.getByRole('switch', { name: 'Dark appearance' }).click(); await reveal();
      assert.equal(await city.inputValue(), 'springFIELD'); assert.equal(await capsule.locator('.capsule-filter-count').innerText(), '5');
      assert.equal(await capsule.getByRole('button', { name: 'Map', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(requests.length, beforeTheme);
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100); assert.equal(await capsule.count(), 0);
      assert.equal(await page.locator('#search-city').inputValue(), 'springFIELD');
      rows.push({ width, theme, geometry, violations }); console.log(`Passed ${width}px ${theme}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await page.getByRole('article').first().waitFor(); await reveal();
    assert.equal(await capsule.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await capsule.locator('.sticky-search-inner').evaluate(el => getComputedStyle(el, '::before').animationName), 'none');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ rows, errors }, null, 2)); console.log(`Browser evidence: ${output}`);
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error(output); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
