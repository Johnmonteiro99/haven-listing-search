// Optional Chrome regression check. Use an existing Playwright installation via NODE_PATH.
// All provider tile requests are intercepted: repeated audits must not scrape OSM tiles.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const baseUrl = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5185';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-map-'));
const root = path.resolve(__dirname, '../..');
const tile = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9e5db"/><path d="M0 0H256V256H0Z M128 0V256 M0 128H256" fill="none" stroke="#d2d2c7"/></svg>');

async function audit(page) {
  await page.addScriptTag({ path: path.join(root, 'frontend/node_modules/axe-core/axe.min.js') });
  return page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
  })).violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) })));
}

// Accurate spatial pins may be dense. Retain their raw finding for explicit review;
// do not waive any other controls or WCAG rules.
function reviewFindings(violations) {
  const blocking = violations.filter(issue => issue.id !== 'target-size' ||
    issue.nodes.some(target => !target.every(selector => selector.includes('haven-map-marker'))));
  assert.deepEqual(blocking, []);
}

async function camera(page) {
  return page.locator('.leaflet-container').evaluate(container => ({
    pane: container.querySelector('.leaflet-map-pane').style.transform,
    markers: [...container.querySelectorAll('.haven-map-marker')].map(marker => marker.style.transform),
  }));
}

// Compare natural grid rows, never impose a fixed card height to satisfy alignment.
async function checkCardRows(page, theme) {
  const rows = await page.locator('.listing-grid').evaluateAll(grids => grids.flatMap(grid => {
    const groups = new Map();
    for (const item of grid.children) {
      const card = item.querySelector('.listing-card');
      if (!card) continue;
      const box = item.getBoundingClientRect(), action = card.querySelector('.listing-open').getBoundingClientRect();
      const key = Math.round(box.top);
      const group = groups.get(key) || [];
      group.push({ height: card.getBoundingClientRect().height, actionBottom: action.bottom,
        imageHeight: card.querySelector('.listing-image-frame').getBoundingClientRect().height,
        background: getComputedStyle(card).backgroundColor, border: getComputedStyle(card).borderTopColor,
        secondary: getComputedStyle(card.querySelector('.listing-location')).color,
        clipped: [...card.querySelectorAll('h3, .listing-location, .listing-facts, .listing-source, .listing-open')]
          .some(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) });
      groups.set(key, group);
    }
    return [...groups.values()];
  }));
  for (const row of rows) {
    for (const metric of ['height', 'actionBottom', 'imageHeight']) {
      const values = row.map(card => card[metric]);
      assert.ok(Math.max(...values) - Math.min(...values) < 1.5, `${metric} alignment`);
    }
    for (const card of row) {
      assert.equal(card.clipped, false);
      if (theme === 'dark') {
        assert.equal(card.background, 'rgb(17, 19, 21)');
        assert.equal(card.border, 'rgb(52, 55, 58)');
        assert.equal(card.secondary, 'rgb(185, 189, 193)');
      }
    }
  }
}

async function layout(page) {
  return page.evaluate(() => {
    const map = document.querySelector('.map-pane');
    const results = document.querySelector('.map-results');
    const grid = document.querySelector('.listing-grid');
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      mapWidth: map?.getBoundingClientRect().width,
      mapX: map?.getBoundingClientRect().x,
      resultsWidth: results?.getBoundingClientRect().width,
      resultsX: results?.getBoundingClientRect().x,
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let page;
  try {
    const context = await browser.newContext({ hasTouch: true });
    let tileRequests = 0;
    await context.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, route => {
      tileRequests++;
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: tile });
    });
    page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(error.message); console.error('Browser error:', error.message); });
    const listingRequests = [];
    page.on('request', request => { if (request.url().includes('/api/listings')) listingRequests.push(request.url()); });
    const rows = [];
    // Phone overlays have their own flow in check_mobile_map.cjs.
    for (const width of [768, 1024, 1280, 1440]) {
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(baseUrl);
        await page.evaluate(theme => localStorage.setItem('haven-theme', theme), theme);
        const beforeGrid = tileRequests;
        await page.reload();
        await page.getByRole('article').first().waitFor();
        await page.getByRole('article').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${width}-${theme}-grid.png`) });
        await checkCardRows(page, theme);
        const grid = await layout(page);
        assert.equal(grid.gridColumns, width >= 1200 ? 3 : width >= 768 ? 2 : 1);
        assert.equal(grid.overflow, false);
        assert.equal(tileRequests, beforeGrid);
        const gridViolations = await audit(page);
        assert.deepEqual(gridViolations, []);
        const mapToggle = page.getByRole('button', { name: 'Map', exact: true });
        await mapToggle.focus();
        await page.keyboard.press('Enter');
        await page.locator('.haven-map-marker').first().waitFor();
        await page.waitForTimeout(550); // Observe the complete 400ms layout transition.
        const opened = await layout(page);
        assert.equal(opened.overflow, false);
        if (width >= 1200) {
          assert.equal(opened.gridColumns, 2);
          assert.equal(opened.mapX > opened.resultsX + opened.resultsWidth, true);
          const share = opened.mapWidth / (opened.mapWidth + opened.resultsWidth);
          assert.equal(share > .56 && share < .6, true);
        } else {
          assert.equal(Math.abs(opened.mapWidth - opened.resultsWidth) < 12, true);
        }
        assert.equal(await page.getByText('Showing 10 of 12 matching properties.').count(), 1);
        assert.equal(await page.locator('.haven-map-marker').count(), 6);
        await page.getByRole('complementary', { name: 'Property map' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${width}-${theme}-map.png`) });
        await checkCardRows(page, theme);
        const mapViolations = await audit(page);
        reviewFindings(mapViolations);
        const marker = page.getByRole('button', { name: /2 listings at 123 Main St/ });
        await marker.focus();
        await page.keyboard.press('Space');
        const choice = page.getByRole('group', { name: 'Choose a listing at this location' });
        await choice.waitFor();
        await page.waitForTimeout(30);
        assert.equal(await choice.getByRole('button').first().evaluate(button => button === document.activeElement), true);
        await page.keyboard.press('Escape');
        assert.equal(await choice.count(), 0);
        assert.equal(await marker.evaluate(e => e === document.activeElement), true);
        await page.keyboard.press('Space');
        await choice.waitFor();
        await choice.getByRole('button', { name: /MLS_B \/ B7/ }).click();
        await page.getByRole('heading', { name: 'Selected property', exact: true }).waitFor();
        const featured = page.getByRole('region', { name: 'Selected property' });
        assert.equal(await featured.getByRole('heading', { name: '123 Main Street, Unit 4B' }).count(), 1);
        const markerFeaturedText = await featured.getByRole('article').innerText();
        assert.equal(await page.getByRole('heading', { name: 'Selected property', exact: true }).evaluate(e => e === document.activeElement), true);
        assert.equal(await page.locator('.haven-map-marker.is-selected').count(), 1);
        assert.equal((await layout(page)).overflow, false);
        await page.waitForFunction(() => document.querySelector('.map-featured-content').getAnimations().every(animation => animation.playState === 'finished'));
        await checkCardRows(page, theme);
        if (theme === 'dark') assert.equal(await featured.getByRole('article').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(17, 19, 21)');
        const violations = await audit(page);
        // WCAG 2.5.8 explicitly permits geographically accurate, densely placed map pins.
        // Every record also has an equivalent, large native card button on this page.
        // Keep raw findings in the report; never waive other targets or other rule failures.
        reviewFindings(violations);
        const cardTargets = await page.locator('.map-results .listing-open').evaluateAll(buttons =>
          buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
        assert.equal(cardTargets.every(target => target.width >= 44 && target.height >= 44), true, JSON.stringify(cardTargets));
        await featured.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${width}-${theme}-selected.png`) });
        const calls = listingRequests.length;
        await page.getByRole('switch').click();
        assert.equal(await featured.count(), 1);
        assert.equal(listingRequests.length, calls);
        await page.getByRole('button', { name: /Close selection/ }).click();
        assert.equal(await page.locator('.haven-map-marker.is-selected').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Fit visible listings', exact: true }).evaluate(e => e === document.activeElement), true);
        const beforeCardCamera = await camera(page);
        const beforeCardRequests = listingRequests.length;
        const compact = page.getByRole('button', { name: /Select.*\(MLS_B, B7\).*on map/ });
        await compact.focus(); await page.keyboard.press('Enter');
        assert.equal(await featured.getByRole('article').innerText(), markerFeaturedText);
        assert.deepEqual(await camera(page), beforeCardCamera);
        assert.equal(listingRequests.length, beforeCardRequests);
        assert.equal(await page.locator('.map-featured-content').evaluate(e => getComputedStyle(e).animationDuration), '0.25s');
        await page.getByRole('button', { name: /Select.*\(MLS_A, A1\).*on map/ }).focus();
        await page.keyboard.press('Enter');
        assert.equal(await featured.getByRole('heading', { name: '123 Main St, Apt 4B', exact: true }).count(), 1);
        assert.deepEqual(await camera(page), beforeCardCamera);
        assert.equal(listingRequests.length, beforeCardRequests);
        await page.getByRole('region', { name: 'Selected property' }).getByRole('button', { name: /View details/ }).click();
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('region', { name: 'Selected property' }).getByRole('button', { name: /View details/ }).evaluate(e => e === document.activeElement), true);
        await page.getByRole('button', { name: 'Next page' }).click();
        await page.getByText(/Showing 11–12 of 12/).waitFor();
        await page.locator('.haven-map-marker').first().waitFor();
        assert.equal(await page.getByRole('region', { name: 'Selected property' }).count(), 0);
        assert.equal(await page.locator('.haven-map-marker').count(), 2);
        assert.equal(await page.getByRole('button', { name: 'Map', exact: true }).getAttribute('aria-pressed'), 'true');
        const gridToggle = page.getByRole('button', { name: 'Grid', exact: true });
        await gridToggle.focus(); await page.keyboard.press('Space');
        assert.equal(await page.locator('.leaflet-container').count(), 0);
        assert.equal(await gridToggle.evaluate(e => e === document.activeElement), true);
        rows.push({ width, theme, grid, opened, gridAxeViolations: gridViolations, mapAxeViolations: mapViolations, axeViolations: violations, reviewedMapPinException: violations.length > 0 });
        console.log(`Passed ${width}px ${theme}`);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.locator('.leaflet-container').waitFor();
    await page.getByRole('button', { name: /^Select.*on map$/ }).first().click();
    const motion = await page.evaluate(() => ({
      transition: getComputedStyle(document.querySelector('.results-workspace')).transitionDuration,
      animation: getComputedStyle(document.querySelector('.map-pane')).animationName,
      featuredAnimation: getComputedStyle(document.querySelector('.map-featured-content')).animationName,
    }));
    assert.deepEqual(motion, { transition: '0s', animation: 'none', featuredAnimation: 'none' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.getByRole('button', { name: /^Select.*on map$/ }).first().click();
    await page.getByRole('button', { name: /^More filters/ }).click();
    const filterDialog = page.getByRole('dialog');
    await filterDialog.locator('.price-histogram figcaption').filter({ hasText: '12 listing records' }).waitFor();
    const beforeFilterEdit = listingRequests.length;
    await filterDialog.getByLabel('City', { exact: true }).fill('Springfield');
    assert.equal(listingRequests.length, beforeFilterEdit);
    await filterDialog.locator('.price-histogram figcaption').filter({ hasText: '4 listing records' }).waitFor();
    assert.equal(await page.getByText('12 homes match your search.', { exact: true }).count(), 1);
    const beforeApply = listingRequests.length;
    await filterDialog.getByRole('button', { name: 'Apply filters' }).click();
    await page.getByText('4 homes match your search.').waitFor();
    assert.equal(await page.getByRole('region', { name: 'Selected property' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Map', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(listingRequests.length, beforeApply + 1);
    assert.equal((await layout(page)).overflow, false);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    const frames = await page.evaluate(() => new Promise(resolve => {
      const samples = []; const start = performance.now();
      function sample() {
        const pane = document.querySelector('.map-pane');
        samples.push({ width: pane.getBoundingClientRect().width, opacity: Number(getComputedStyle(pane).opacity), transform: getComputedStyle(pane).transform });
        if (performance.now() - start < 450) requestAnimationFrame(sample);
        else resolve(samples);
      }
      requestAnimationFrame(sample);
    }));
    assert.equal(new Set(frames.map(frame => frame.opacity.toFixed(2))).size > 2, true);
    assert.equal(new Set(frames.map(frame => Math.round(frame.width))).size, 1);
    await page.locator('.haven-map-marker').first().waitFor();
    const beforeZoom = await page.locator('.haven-map-marker').first().getAttribute('style');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.notEqual(await page.locator('.haven-map-marker').first().getAttribute('style'), beforeZoom);
    const beforePan = await page.locator('.haven-map-marker').first().evaluate(e => e.getBoundingClientRect().x);
    await page.getByRole('region', { name: 'Interactive property map' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    assert.notEqual(await page.locator('.haven-map-marker').first().evaluate(e => e.getBoundingClientRect().x), beforePan);
    await page.getByRole('button', { name: 'Fit visible listings' }).click();
    // Deliberately pan away: selecting even an off-screen property must preserve the camera.
    await page.getByRole('region', { name: 'Interactive property map' }).focus();
    for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(350);
    const pannedCamera = await camera(page);
    const selectionRequests = listingRequests.length;
    await page.getByRole('button', { name: /Select.*\(MLS_A, A1\).*on map/ }).focus();
    await page.keyboard.press('Enter');
    const featuredFrames = await page.locator('.map-featured-content').evaluate(element => new Promise(resolve => {
      const samples = []; const start = performance.now();
      function sample() {
        samples.push(Number(getComputedStyle(element).opacity));
        if (performance.now() - start < 300) requestAnimationFrame(sample);
        else resolve(samples);
      }
      requestAnimationFrame(sample);
    }));
    assert.equal(featuredFrames.some(value => value > 0 && value < 1), true);
    assert.equal(featuredFrames.at(-1), 1);
    assert.deepEqual(await camera(page), pannedCamera);
    await page.getByRole('button', { name: /Select.*\(MLS_B, B8\).*on map/ }).click();
    assert.deepEqual(await camera(page), pannedCamera);
    assert.equal(listingRequests.length, selectionRequests);
    assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Springfield');
    await page.getByRole('button', { name: /Close selection/ }).click();
    assert.deepEqual(await camera(page), pannedCamera);
    assert.equal(await page.getByRole('button', { name: /Select.*\(MLS_B, B8\).*on map/ }).evaluate(e => e === document.activeElement), true);
    // Force tile failure in an isolated page; successful layout audits never hit the provider.
    await context.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, route => route.abort());
    const offline = await context.newPage();
    await offline.goto(baseUrl);
    await offline.getByRole('article').first().waitFor();
    await offline.getByRole('button', { name: 'Map', exact: true }).click();
    await offline.getByText(/Some map tiles could not load/).waitFor();
    assert.equal(await offline.getByRole('article').count(), 10);
    await offline.getByRole('button', { name: 'Grid', exact: true }).click();
    assert.equal(await offline.locator('.leaflet-container').count(), 0);
    await offline.close();
    assert.deepEqual(pageErrors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ rows, motion, frames, featuredFrames, pageErrors, tiles: 'intercepted' }, null, 2));
    console.log(`Browser evidence: ${output}`);
  } catch (error) {
    if (page) {
      console.error((await page.locator('body').innerText()).slice(-3000));
      await page.screenshot({ path: path.join(output, 'failure.png') });
      console.error(`Failure evidence: ${output}`);
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
