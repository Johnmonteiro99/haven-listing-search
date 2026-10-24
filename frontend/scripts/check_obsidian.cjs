// Dark-theme visual checks and exact light screenshot comparison. All provider tiles are fixtures.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
const baseline = process.argv[2] === 'baseline';
const errorsOnly = process.argv[2] === 'errors';
const output = fs.mkdtempSync(path.join(os.tmpdir(), baseline ? 'haven-noir-before-' : 'haven-noir-after-'));
const before = process.env.HAVEN_NOIR_BASELINE;
async function settle(page) {
  await page.waitForTimeout(500);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map(i => i.decode().catch(() => {}))); });
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const rows = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, r => {
    const dark = r.request().url().includes('_dark');
    return r.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${dark ? '#17191b' : '#e9e5db'}"/><path d="M0 0H256V256H0Z M128 0V256 M0 128H256" fill="none" stroke="${dark ? '#363a3d' : '#d2d2c7'}"/></svg>` });
  });
  async function shot(width, theme, state) {
    await settle(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const name = `${width}-${theme}-${state}.png`;
    await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
    let findings = [];
    if (!baseline && theme === 'dark') {
      await page.addScriptTag({ path: path.join(root, 'frontend/node_modules/axe-core/axe.min.js') });
      findings = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      assert.deepEqual(findings.filter(v => v.id !== 'target-size' || v.targets.some(t => !t.every(s => s.includes('haven-map-marker')))), []);
    }
    if (!baseline && theme === 'light' && before) {
      const old = fs.readFileSync(path.join(before, name)), current = fs.readFileSync(path.join(output, name));
      assert.equal(crypto.createHash('sha256').update(current).digest('hex'), crypto.createHash('sha256').update(old).digest('hex'), `Light changed: ${name}`);
    }
    rows.push({ width, theme, state, findings });
  }
  try {
    for (const width of [375,390,768,1024,1280,1440]) for (const theme of ['light','dark']) {
      if (errorsOnly && theme !== 'dark') continue;
      if (baseline && theme === 'dark' && width !== 1440) continue;
      await page.setViewportSize({ width, height: 900 }); await page.goto(base);
      await page.evaluate(t => localStorage.setItem('haven-theme',t),theme); await page.reload(); await page.getByRole('article').first().waitFor();
      if (errorsOnly) {
        await page.getByRole('button',{name:width<768?'Filters':/More filters/,exact:width<768}).click();
        const modal = page.getByRole('dialog');
        await modal.getByLabel('Target budget',{exact:true}).fill('0');
        await modal.getByRole('button',{name:'Apply filters',exact:true}).click();
        assert.equal(await modal.getByRole('alert').evaluate(el=>el===document.activeElement),true);
        await shot(width,theme,'filters-error');
        console.log(`Passed ${width}px error state`); continue;
      }
      await page.evaluate(() => window.scrollTo(0,0)); await shot(width,theme,'page');
      await page.getByRole('button',{name:'Map',exact:true}).click(); await page.locator('.haven-map-marker').first().waitFor();
      await page.locator('.results-workspace').evaluate(el => el.scrollIntoView({block:'start'})); await shot(width,theme,'map');
      await page.getByRole('button',{name:/Select .* on map/}).first().click(); await page.getByRole('region',{name:'Selected property'}).waitFor(); await shot(width,theme,'selected');
      await page.getByRole('button',{name:width<768?'Filters':/More filters/,exact:width<768}).click();
      await page.locator('.price-histogram figcaption').filter({hasText:'12 listing records'}).waitFor();
      await page.getByRole('dialog').locator('.advanced-filter-content').evaluate(el=>{el.scrollTop=0;}); await shot(width,theme,'filters');
      await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      await page.locator('#perspective').evaluate(el=>el.scrollIntoView({block:'start'})); await shot(width,theme,'footer');
      console.log(`Passed ${width}px ${theme}`);
    }
    assert.deepEqual(errors,[]); fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({rows,errors,lightComparison:before||'baseline'},null,2)); console.log(JSON.stringify({output,states:rows.length}));
  } catch(e) { await page.screenshot({path:path.join(output,'failure.png')});console.error('Evidence:',output);throw e; }
  finally {await browser.close();}
})();
