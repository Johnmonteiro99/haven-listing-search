// Optional real-browser checks. Requires both local servers, Google Chrome, and an
// externally available Playwright installation (via NODE_PATH if needed).
// No browser automation dependency is added to the application.
const {
  chromium
} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-details-'));
const baseUrl = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });
  try {
    const context = await browser.newContext({
      hasTouch: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const apiRequests = [];
    page.on('request', r => {
      if (r.url().includes('/api/listings')) apiRequests.push(r.url());
    });
    await page.goto(baseUrl);
    await page.getByRole('article').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const api = await (await page.request.get(`${baseUrl}/api/listings`)).json();
    const facts = api.items[0];
    const rows = [];
    for (const width of [375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({
        width,
        height: 900
      });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => {
          localStorage.setItem('haven-theme', theme);
        }, theme);
        await page.reload();
        await page.getByRole('article').first().waitFor();
        const opener = page.getByRole('button', {
          name: `View details for ${facts.address} (${facts.source}, ${facts.id})`,
          exact: true
        });
        await opener.focus();
        await page.keyboard.press(theme === 'light' ? 'Enter' : 'Space');
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.equal(await page.getByRole('button', {
          name: 'Close property details'
        }).evaluate(e => e === document.activeElement), true);
        assert.equal(await dialog.getByRole('heading', {
          name: facts.address,
          exact: true
        }).count(), 1);
        assert.equal(await dialog.getByText(facts.description, {
          exact: true
        }).count(), 1);
        assert.equal(await dialog.locator('time').getAttribute('datetime'), facts.listedDate);
        assert.equal(await dialog.locator('.property-score strong').innerText(), facts.relevanceScore.toFixed(1));
        await dialog.locator('img').evaluate(img => img.decode());
        const bounds = await dialog.evaluate(d => {
          const s = d.querySelector('.property-scroll');
          const b = d.getBoundingClientRect();
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            overflow: d.scrollWidth > d.clientWidth || s.scrollWidth > s.clientWidth,
            scrollable: s.scrollHeight > s.clientHeight,
            bodyLocked: document.body.style.overflow === 'hidden',
            modal: d.matches(':modal'),
            documentOverflow: document.documentElement.scrollWidth > innerWidth
          };
        });
        assert.equal(bounds.overflow, false);
        assert.equal(bounds.documentOverflow, false);
        assert.equal(bounds.bodyLocked, true);
        assert.equal(bounds.modal, true);
        assert.equal(Math.round(bounds.width), width < 768 ? width : 640);
        // Forward and reverse traversal must stay within the modal or native browser chrome.
        await page.getByRole('button', {
          name: 'Close property details'
        }).focus();
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('.property-dialog')), true);
        }
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('.property-dialog')), true);
        }
        await dialog.getByText('How this score works', {
          exact: true
        }).focus();
        await page.keyboard.press('Enter');
        assert.equal(await dialog.locator('details').getAttribute('open'), '');
        await page.addScriptTag({
          path: root + '/frontend/node_modules/axe-core/axe.min.js'
        });
        const violations = await page.evaluate(async () => (await axe.run(document.querySelector('.property-dialog'), {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
          }
        })).violations.map(v => ({
          id: v.id,
          nodes: v.nodes.map(n => n.target)
        })));
        assert.deepEqual(violations, []);
        await dialog.locator('.property-scroll').evaluate(e => e.scrollTop = 0);
        await page.screenshot({
          path: path.join(output, `${width}-${theme}.png`)
        });
        const before = apiRequests.length;
        await dialog.getByRole('switch').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'light' ? 'dark' : 'light');
        assert.equal(await dialog.getByRole('heading', {
          name: facts.address,
          exact: true
        }).count(), 1);
        assert.equal(apiRequests.length, before);
        await page.keyboard.press('Escape');
        await dialog.waitFor({
          state: 'detached'
        });
        assert.equal(await opener.evaluate(e => e === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        rows.push({
          viewportWidth: width,
          theme,
          ...bounds,
          axeViolations: violations.length
        });
        console.log(`Passed ${width}px ${theme}`);
      }
    }
    // Pointer activation across the illustration, not only the visible button text.
    await page.getByRole('article').first().click({
      position: {
        x: 30,
        y: 30
      }
    });
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', {
      name: 'Close property details'
    }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    // Reduced motion and keyboard focus visibility.
    await page.emulateMedia({
      reducedMotion: 'reduce'
    });
    await page.getByRole('button', {
      name: /View details/
    }).first().focus();
    await page.keyboard.press('Enter');
    const reduced = await page.getByRole('dialog').getByRole('switch').evaluate(e => getComputedStyle(e).transitionDuration);
    assert.equal(reduced, '0s');
    const outline = await page.getByRole('button', {
      name: 'Close property details'
    }).evaluate(e => ({
      width: getComputedStyle(e).outlineWidth,
      style: getComputedStyle(e).outlineStyle
    }));
    assert.equal(outline.width, '3px');
    assert.equal(outline.style, 'solid');
    await page.keyboard.press('Escape');
    await page.emulateMedia({
      reducedMotion: 'no-preference'
    });

    // Applied scoring, page preservation, and a second source record.
    await page.setViewportSize({
      width: 1440,
      height: 900
    });
    await page.getByRole('button', {
      name: 'Next page'
    }).click();
    await page.getByText(/Showing 11–12 of 12/).waitFor();
    await page.getByLabel('City', {
      exact: true
    }).fill('Unsubmitted city');
    const pageTwoOpener = page.getByRole('button', {
      name: /View details/
    }).last();
    const pageTwoLabel = await pageTwoOpener.getAttribute('aria-label');
    await pageTwoOpener.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByRole('switch').click();
    await page.keyboard.press('Escape');
    assert.equal(await pageTwoOpener.evaluate(e => e === document.activeElement), true);
    assert.equal(await pageTwoOpener.getAttribute('aria-label'), pageTwoLabel);
    assert.equal(await page.getByLabel('City', {
      exact: true
    }).inputValue(), 'Unsubmitted city');
    assert.equal(await page.getByText(/Showing 11–12 of 12/).count(), 1);
    await page.getByLabel('City', {
      exact: true
    }).fill('Springfield');
    await page.getByRole('button', {
      name: /More filters/
    }).click();
    await page.getByLabel('Target budget', {
      exact: true
    }).fill('500000');
    await page.getByRole('dialog').getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByText('4 homes match your search.').waitFor();
    const sourceOpener = page.getByRole('button', {
      name: /\(MLS_B, B7\)/
    });
    await sourceOpener.click();
    const weighted = page.getByRole('dialog');
    assert.equal(await weighted.getByText(/\$500,000 target budget/).count(), 1);
    await weighted.locator('summary').click();
    assert.equal(await weighted.getByText(/Budget proximity contributes 70%/).isVisible(), true);
    await page.keyboard.press('Escape');
    // Short mobile touch screen: scroll to the complete record while Close stays visible.
    await page.setViewportSize({
      width: 375,
      height: 667
    });
    await sourceOpener.scrollIntoViewIfNeeded();
    const touchBox = await sourceOpener.boundingBox();
    await page.touchscreen.tap(touchBox.x + touchBox.width / 2, touchBox.y + touchBox.height / 2);
    const mobile = page.getByRole('dialog');
    await mobile.waitFor();
    await mobile.locator('summary').click();
    await mobile.locator('.property-scroll').evaluate(e => e.scrollTop = e.scrollHeight);
    assert.equal(await mobile.locator('.property-provenance time').isVisible(), true);
    const closeBox = await mobile.getByRole('button', {
      name: 'Close property details'
    }).boundingBox();
    assert.equal(closeBox.y >= 0 && closeBox.y + closeBox.height <= 667, true);
    assert.equal(closeBox.height >= 44, true);
    await page.addScriptTag({
      path: root + '/frontend/node_modules/axe-core/axe.min.js'
    });
    const mobileViolations = await page.evaluate(async () => (await axe.run(document.querySelector('.property-dialog'), {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
      }
    })).violations.map(v => v.id));
    assert.deepEqual(mobileViolations, []);
    await page.screenshot({
      path: path.join(output, '375-short-content.png')
    });
    await page.touchscreen.tap(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await sourceOpener.evaluate(e => e === document.activeElement), true);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({
      rows,
      errors,
      reduced,
      outline
    }, null, 2));
    console.log(JSON.stringify({
      rows,
      errors,
      reduced,
      outline
    }, null, 2));
    console.log(`Browser evidence: ${output}`);
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
