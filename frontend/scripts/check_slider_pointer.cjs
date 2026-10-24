// Native range regression: external Playwright via NODE_PATH; WebKit is not Safari certification.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-slider-pointer-'));
const report = { cases: [], errors: [] };

async function point(input, value) {
  const box = await input.boundingBox();
  const limit = Number(await input.getAttribute('max'));
  // Coincident thumbs already separate vertically; use each exposed edge of its 44px target.
  const offset = await input.evaluate(el => el.parentElement.classList.contains('handles-together')
    ? (el.classList.contains('dual-price-minPrice') ? 6 : 38) : 22);
  return { x: box.x + 22 + (box.width - 44) * value / limit, y: box.y + offset };
}
function near(actual, expected) {
  // Native engines round subpixel thumb positions differently; allow one $10k step.
  assert(Math.abs(Number(actual) - expected) <= 10000, `${actual} should be within one step of ${expected}`);
}
async function drag(page, input, value, outside = false) {
  const from = await point(input, Number(await input.inputValue())), to = await point(input, value);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  if (outside) await page.mouse.move(to.x, to.y - 60);
  await page.mouse.up();
}
async function hover(page, input) {
  const from = await point(input, 0), to = await point(input, Number(await input.getAttribute('max')));
  await page.mouse.move(from.x, from.y, { steps: 10 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.move(from.x, from.y, { steps: 15 });
}

(async () => {
  try {
    for (const [engine, launcher] of [['chrome', chromium], ['webkit', webkit]]) {
      const browser = await launcher.launch(engine === 'chrome' ? { channel: 'chrome' } : {});
      try {
        for (const width of [1024, 1440]) for (const theme of ['light', 'dark']) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          let requests = 0;
          page.on('pageerror', e => report.errors.push({ engine, message: e.message }));
          page.on('request', r => { if (r.url().includes('/api/listings')) requests++; });
          await page.addInitScript(t => localStorage.setItem('haven-theme', t), theme);
          await page.goto(base); await page.getByRole('article').first().waitFor();
          const opener = page.getByRole('button', { name: /Price range/ });
          await opener.click();
          const panel = page.getByRole('group', { name: 'Price range amounts' });
          const min = panel.getByRole('slider', { name: 'Minimum price slider' });
          const max = panel.getByRole('slider', { name: 'Maximum price slider' });
          const values = () => Promise.all([min.inputValue(), max.inputValue()]);
          const track = panel.locator('.dual-price-track');
          for (const pseudo of ['::before', '::after']) {
            const knob = await track.evaluate((el, pseudo) => {
              const style = getComputedStyle(el, pseudo);
              return { width: style.width, height: style.height, radius: style.borderRadius,
                fill: style.backgroundColor, image: style.backgroundImage, shadow: style.boxShadow };
            }, pseudo);
            assert.equal(knob.width, '22px'); assert.equal(knob.height, '22px'); assert.equal(knob.radius, '50%');
            assert.equal(knob.image, 'none'); assert(!knob.shadow.includes('inset')); assert.notEqual(knob.fill, 'rgba(0, 0, 0, 0)');
          }
          if (width === 1440) {
            await panel.screenshot({ path: path.join(output, `${engine}-${theme}-knobs-rest.png`) });
            await min.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
            assert(await min.evaluate(el => el.matches(':focus-visible')));
            assert.equal(await track.evaluate(el => getComputedStyle(el, '::before').outlineWidth), '3px');
            await panel.screenshot({ path: path.join(output, `${engine}-${theme}-knobs-focus.png`) });
            await panel.getByLabel('Minimum price', { exact: true }).click();
            const thumb = await point(min, 0); await page.mouse.move(thumb.x, thumb.y); await page.waitForTimeout(220);
            assert.equal(await track.evaluate(el => getComputedStyle(el, '::before').scale), '1.045');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await track.evaluate(el => getComputedStyle(el, '::before').scale), '1');
            assert.equal(await track.evaluate(el => getComputedStyle(el, '::before').transitionDuration), '0s');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
          }
          const baselineRequests = requests;
          const initial = await values(); await hover(page, min); assert.deepEqual(await values(), initial);
          await drag(page, min, 400000);
          assert.equal(await opener.getAttribute('aria-expanded'), 'true', 'Thumb press must not blur-close the quick popover');
          near(await min.inputValue(), 400000); assert.equal(await max.inputValue(), '2000000');
          assert(await min.evaluate(el => document.activeElement === el));
          const released = await values(); await hover(page, min); assert.deepEqual(await values(), released);
          await drag(page, max, 1500000, true);
          near(await max.inputValue(), 1500000); near(await min.inputValue(), 400000);
          const outsideRelease = await values(); await hover(page, max); assert.deepEqual(await values(), outsideRelease);
          const beforeKeys = await values();
          await min.focus(); await page.keyboard.press('ArrowRight'); assert.equal(Number(await min.inputValue()), Number(beforeKeys[0]) + 10000);
          await max.focus(); await page.keyboard.press('ArrowLeft'); assert.equal(Number(await max.inputValue()), Number(beforeKeys[1]) - 10000);

          await panel.getByLabel('Minimum price', { exact: true }).fill('1000000');
          await panel.getByLabel('Maximum price', { exact: true }).fill('1000000');
          if (width === 1440) await panel.screenshot({ path: path.join(output, `${engine}-${theme}-knobs-coincident.png`) });
          await drag(page, min, 800000); near(await min.inputValue(), 800000);
          await drag(page, max, 1200000); near(await max.inputValue(), 1200000);
          const separated = await values(); await hover(page, min); assert.deepEqual(await values(), separated);
          assert.equal(requests, baselineRequests, 'Draft interaction must not fetch');
          await page.screenshot({ path: path.join(output, `${engine}-${width}-${theme}.png`) });
          await page.keyboard.press('Escape'); assert.equal(await opener.getAttribute('aria-expanded'), 'false');
          assert(await opener.evaluate(el => document.activeElement === el));
          report.cases.push({ engine, version: browser.version(), width, theme, hover: true, drag: true, release: true,
            independentHandles: true, keyboard: true, requestsUnchanged: true });
          await page.close();
          console.log(`Passed ${engine} ${width}px ${theme}`);
        }
        const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await mobile.goto(base); await mobile.getByRole('article').first().waitFor();
        await mobile.getByRole('button', { name: 'Filters', exact: true }).tap();
        const modal = mobile.getByRole('dialog');
        await modal.locator('.price-histogram figcaption').filter({ hasText: '12 listing records' }).waitFor();
        const minimum = modal.getByRole('slider', { name: 'Minimum price slider' });
        await minimum.scrollIntoViewIfNeeded();
        if (engine === 'chrome') {
          const cdp = await mobile.context().newCDPSession(mobile);
          for (const [label, destination] of [['Minimum', 400000], ['Maximum', 1500000]]) {
            const input = modal.getByRole('slider', { name: label + ' price slider' });
            const from = await point(input, Number(await input.inputValue())), to = await point(input, destination);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
            for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 10, y: from.y, id: 1 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            assert.equal(await input.inputValue(), String(destination));
          }
        } else {
          const thumb = await point(minimum, 0); await mobile.touchscreen.tap(thumb.x, thumb.y);
          assert.equal(await minimum.inputValue(), '0');
        }
        await minimum.focus(); await mobile.keyboard.press('ArrowRight');
        assert.equal(await minimum.inputValue(), engine === 'chrome' ? '410000' : '10000');
        report.cases.push({ engine, mobile: true, touch: engine === 'chrome' ? 'both native touch drags' : 'native touch tap', keyboard: true });
        await mobile.close();
      } finally { await browser.close(); }
    }
    assert.deepEqual(report.errors, []);
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Slider regression evidence:', output);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
