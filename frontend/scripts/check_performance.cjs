// Production-preview lab audit. External Playwright via NODE_PATH; no app dependencies added.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.HAVEN_BASE_URL || 'http://127.0.0.1:5190';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-performance-'));
const profiles = process.env.HAVEN_PERF_PROFILE ? [process.env.HAVEN_PERF_PROFILE] : ['desktop', 'mobile'];

/** Observe navigation before React runs. Blocking time is a fixed-window proxy, not Lighthouse TBT/INP. */
function observe() {
  window.audit = { lcp: [], shifts: [], tasks: [], events: [] };
  for (const [type, key] of [['largest-contentful-paint', 'lcp'], ['layout-shift', 'shifts'], ['longtask', 'tasks'], ['event', 'events']]) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.audit[key].push({ startTime: entry.startTime, duration: entry.duration,
          value: entry.value, hadRecentInput: entry.hadRecentInput,
          name: entry.name, interactionId: entry.interactionId,
          element: entry.element?.className, url: entry.url });
      }
    }).observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) });
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { browser: browser.version(), base, samples: [] };
  try {
    for (const profile of profiles) for (const theme of ['light', 'dark']) for (let run = 1; run <= 3; run++) {
      const mobile = profile === 'mobile';
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 900 },
        deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: theme });
      await context.addInitScript(observe);
      const page = await context.newPage();
      const errors = [], failures = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
      page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }); });
      page.on('request', r => requests.push(r.url()));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (mobile) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
          downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8, connectionType: 'cellular4g' });
      }
      await page.goto(base, { waitUntil: 'load' });
      await page.getByText('12 homes match your search.', { exact: true }).waitFor();
      await page.waitForTimeout(5000);
      const metrics = await page.evaluate(() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
        let cls = 0, session = 0, first = 0, last = 0;
        for (const shift of window.audit.shifts.filter(s => !s.hadRecentInput)) {
          if (shift.startTime - last > 1000 || shift.startTime - first > 5000) { session = 0; first = shift.startTime; }
          session += shift.value; last = shift.startTime; cls = Math.max(cls, session);
        }
        const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(r => ({
          url: r.name, type: r.initiatorType, transfer: r.transferSize, encoded: r.encodedBodySize, decoded: r.decodedBodySize, duration: r.duration }));
        return { fcp, lcp: window.audit.lcp.at(-1), cls, observationEnd: performance.now(),
          blockingTimeProxy: window.audit.tasks.filter(t => t.startTime >= fcp).reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0),
          longTasks: window.audit.tasks, resources,
          images: [...document.images].map(i => ({ src: i.currentSrc, loading: i.loading, priority: i.fetchPriority, width: i.naturalWidth, complete: i.complete })),
          transferBytes: resources.reduce((sum, r) => sum + r.transfer, 0),
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(metrics.overflow, false);
      assert(!requests.some(url => /stadiamaps|openstreetmap|ListingMap-/.test(url)), 'No map code/tiles in initial Grid');
      assert.equal(requests.filter(url => url.includes('/api/listings')).length, 1);
      assert.deepEqual(errors, []); assert.deepEqual(failures, []);
      // Measure input dispatch to the second animation frame; this is a lab latency, not field INP.
      const responseTime = await page.locator('form[aria-label="Search homes"] input[name="city"]').evaluate(input => new Promise(resolve => {
        const start = performance.now();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Springfield'); input.dispatchEvent(new Event('input', { bubbles: true }));
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
      }));
      await page.getByLabel('City', { exact: true }).focus();
      await page.evaluate(() => {
        document.addEventListener('keydown', () => {
          const start = performance.now();
          requestAnimationFrame(() => requestAnimationFrame(() => { window.audit.keyToFrame = performance.now() - start; }));
        }, { once: true });
      });
      await page.keyboard.press('x');
      await page.waitForFunction(() => window.audit.keyToFrame !== undefined);
      const keyToFrame = await page.evaluate(() => window.audit.keyToFrame);
      report.samples.push({ profile, theme, run, responseTime, keyToFrame, ...metrics, errors, failures });
      console.log(JSON.stringify({ profile, theme, run, fcp: metrics.fcp, lcp: metrics.lcp?.startTime, cls: metrics.cls,
        blockingTimeProxy: metrics.blockingTimeProxy, transferBytes: metrics.transferBytes, responseTime, keyToFrame }));
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Performance evidence:', output);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
