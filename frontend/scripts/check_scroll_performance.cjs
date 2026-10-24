// Local scroll diagnostics; external Playwright via NODE_PATH. No app dependency or runtime hook.
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

/** Test-only observer. RAF gaps are scheduling evidence, not proof of presented/dropped GPU frames. */
function observeScroll() {
  const audit = window.scrollAudit = { active: null, observers: [], listeners: [], commits: [], visibility: [], phases: [] };
  const NativeIO = window.IntersectionObserver, NativeRO = window.ResizeObserver;
  for (const [name, Native] of [['IntersectionObserver', NativeIO], ['ResizeObserver', NativeRO]]) {
    window[name] = class extends Native {
      constructor(callback, options) {
        const record = { kind: name, calls: [], disconnected: false };
        super((entries, observer) => {
          record.calls.push({ t: performance.now(), targets: entries.map(e => e.target.className) });
          callback(entries, observer);
        }, options);
        audit.observers.push(record); this.record = record;
      }
      disconnect() { this.record.disconnected = true; super.disconnect(); }
    };
  }
  // Count commits and state/prop reference changes, not inferred component render calls.
  const previousFibers = new WeakMap();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(),
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    onScheduleFiberRoot() {}, onCommitFiberUnmount() {},
    onCommitFiberRoot(_id, root) {
      const changed = [];
      function visit(fiber) {
        if (!fiber) return;
        if (typeof fiber.type === 'function') {
          const before = previousFibers.get(fiber) || (fiber.alternate && previousFibers.get(fiber.alternate));
          if (!before || before.props !== fiber.memoizedProps || before.state !== fiber.memoizedState) changed.push(fiber.type.displayName || fiber.type.name || 'anonymous');
          const current = { props: fiber.memoizedProps, state: fiber.memoizedState };
          previousFibers.set(fiber, current); if (fiber.alternate) previousFibers.set(fiber.alternate, current);
        }
        visit(fiber.child); visit(fiber.sibling);
      }
      visit(root.current);
      audit.commits.push({ t: performance.now(), changed });
    },
  };
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  const registrations = [];
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (['scroll', 'wheel', 'touchmove'].includes(type)) registrations.push({ target: this, type, listener, options, active: true });
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    for (const record of registrations) if (record.target === this && record.type === type && record.listener === listener) record.active = false;
    return remove.call(this, type, listener, options);
  };
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list => {
    if (audit.active) audit.active.tasks.push(...list.getEntries().map(e => ({ t: e.startTime, duration: e.duration })));
  }).observe({ type: 'longtask' });
  if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
    if (audit.active) audit.active.shifts.push(...list.getEntries().map(e => ({ value: e.value, recentInput: e.hadRecentInput })));
  }).observe({ type: 'layout-shift' });
  // Use the original listener method so test instrumentation is not counted as application listeners.
  add.call(window, 'scroll', () => { if (audit.active) audit.active.scrollEvents++; }, { passive: true });
  add.call(document, 'wheel', e => {
    if (audit.active) audit.active.wheels.push({ t: performance.now(), deltaY: e.deltaY, deltaMode: e.deltaMode });
  }, { passive: true });
  const watchVisibility = () => new MutationObserver(() => {
    const visible = document.documentElement.classList.contains('has-sticky-search');
    if (audit.visibility.at(-1)?.visible !== visible) audit.visibility.push({ t: performance.now(), y: scrollY, visible });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  if (document.documentElement) watchVisibility();
  else add.call(document, 'DOMContentLoaded', watchVisibility, { once: true });
  let raf = 0;
  audit.start = label => {
    cancelAnimationFrame(raf);
    const phase = audit.active = { label, supportedEntries: PerformanceObserver.supportedEntryTypes, start: performance.now(), startY: scrollY, frames: [], tasks: [], shifts: [], wheels: [], scrollEvents: 0 };
    let last;
    function tick(t) { if (last !== undefined) phase.frames.push(t - last); last = t; raf = requestAnimationFrame(tick); }
    raf = requestAnimationFrame(tick);
  };
  audit.stop = () => {
    cancelAnimationFrame(raf);
    const phase = audit.active; audit.active = null;
    phase.end = performance.now(); phase.endY = scrollY;
    phase.commits = audit.commits.filter(c => c.t >= phase.start);
    phase.observers = audit.observers.map(r => ({ kind: r.kind, disconnected: r.disconnected, calls: r.calls.filter(c => c.t >= phase.start) }));
    phase.visibility = audit.visibility.filter(c => c.t >= phase.start);
    phase.listeners = registrations.filter(r => r.active).map(r => ({ type: r.type, target: r.target === window ? 'window' : r.target.className || r.target.nodeName,
      passive: typeof r.options === 'object' ? r.options?.passive : undefined }));
    audit.phases.push(phase); return phase;
  };
}
module.exports = { observeScroll };

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-scroll-'));
  const report = { samples: [], errors: [] };
  const engines = process.env.HAVEN_SCROLL_ENGINE ? [process.env.HAVEN_SCROLL_ENGINE] : ['chrome', 'webkit'];
  const runs = Number(process.env.HAVEN_SCROLL_RUNS || 2);
  try {
    for (const engine of engines) {
      const browser = await (engine === 'chrome' ? chromium : webkit).launch(engine === 'chrome' ? { channel: 'chrome' } : {});
      try {
        for (const build of ['production', 'development']) for (const theme of ['light', 'dark']) for (let run = 1; run <= runs; run++) {
          const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
          await page.addInitScript(observeScroll);
          await page.addInitScript(t => localStorage.setItem('haven-theme', t), theme);
          page.on('pageerror', e => report.errors.push(e.message));
          // Keep external network/provider variability out of renderer comparisons; not a cartographic benchmark.
          await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.stadiamaps\.com)\//, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#727a75"/></svg>' }));
          await page.goto(`http://127.0.0.1:${build === 'production' ? 5190 : 5185}`);
          await page.getByRole('article').first().waitFor(); await page.evaluate(() => document.fonts.ready);
          // Warm image decoding before the repeatable scroll window; cold/lazy behavior is tested separately.
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
            await Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 1500))]);
            scrollTo(0, 0);
          });
          await page.waitForTimeout(600);
          const cdp = engine === 'chrome' ? await page.context().newCDPSession(page) : null;
          let layers = [];
          if (cdp) { await cdp.send('Performance.enable'); await cdp.send('LayerTree.enable'); cdp.on('LayerTree.layerTreeDidChange', e => { layers = e.layers || []; }); }
          const sample = { engine, version: browser.version(), build, theme, run, phases: [] };
          async function measure(label, action) {
            const before = cdp ? await cdp.send('Performance.getMetrics') : null;
            const trace = [];
            if (cdp && run === 1) {
              cdp.on('Tracing.dataCollected', collect);
              await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,cc,gpu', transferMode: 'ReportEvents' });
            }
            function collect(e) { trace.push(...e.value); }
            await page.evaluate(name => scrollAudit.start(name), label);
            await action(); await page.waitForTimeout(180);
            const phase = await page.evaluate(() => scrollAudit.stop());
            if (cdp) {
              const after = await cdp.send('Performance.getMetrics');
              const old = Object.fromEntries(before.metrics.map(m => [m.name, m.value]));
              phase.metrics = Object.fromEntries(after.metrics.filter(m => /Duration|Count/.test(m.name)).map(m => [m.name, m.value - (old[m.name] || 0)]));
              if (run === 1) {
                const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
                await cdp.send('Tracing.end'); await complete; cdp.off('Tracing.dataCollected', collect);
                const filename = `${engine}-${build}-${theme}-${label}.trace.json`;
                fs.writeFileSync(path.join(output, filename), JSON.stringify({ traceEvents: trace })); phase.trace = filename;
                phase.traceCosts = {};
                for (const event of trace) if (['Layout', 'UpdateLayoutTree', 'Paint', 'CompositeLayers', 'RasterTask', 'FunctionCall', 'EventDispatch', 'TimerFire', 'FireAnimationFrame', 'DrawFrame', 'DroppedFrame'].includes(event.name)) {
                  const item = phase.traceCosts[event.name] ||= { count: 0, ms: 0, maxMs: 0 };
                  item.count++; item.ms += (event.dur || 0) / 1000; item.maxMs = Math.max(item.maxMs, (event.dur || 0) / 1000);
                }
              }
            }
            sample.phases.push(phase);
          }
          async function wheel(delta, count, x = 60, y = 600) {
            await page.mouse.move(x, y);
            for (let i = 0; i < count; i++) { await page.mouse.wheel(0, delta); await page.waitForTimeout(20); }
          }
          await measure('grid-slow', () => wheel(55, 55));
          await measure('grid-fast', async () => { await wheel(-550, 7); await wheel(550, 7); });
          await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
          await measure('keyboard', async () => { for (let i = 0; i < 5; i++) { await page.keyboard.press('PageDown'); await page.waitForTimeout(180); } });
          const threshold = await page.locator('.search-panel').evaluate(el => el.getBoundingClientRect().bottom + scrollY + 8);
          await measure('capsule-threshold', async () => {
            for (const delta of [-4, 4, 4, -4, -4, 4]) { await page.evaluate(y => scrollTo(0, y), threshold + delta); await page.waitForTimeout(280); }
          });
          await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
          await page.getByRole('button', { name: 'Map', exact: true }).click();
          await page.locator('.haven-map-marker').first().waitFor(); await page.waitForTimeout(700);
          const markers = await page.locator('.haven-map-marker').elementHandles();
          await measure('map-left-slow', () => wheel(55, 50));
          await page.locator('.results-workspace').evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY + 200)); await page.waitForTimeout(300);
          const camera = await page.locator('.leaflet-map-pane').getAttribute('style');
          await measure('map-wheel-over-map', () => wheel(55, 16, 1100, 400));
          assert.equal(await page.locator('.leaflet-map-pane').getAttribute('style'), camera, 'Wheel must not zoom/pan the map');
          assert(sample.phases.at(-1).endY > sample.phases.at(-1).startY, 'Wheel over map must scroll the page');
          assert((await Promise.all(markers.map(m => m.evaluate(el => el.isConnected)))).every(Boolean), 'Scroll must not recreate markers');
          await measure('map-fast', () => wheel(-500, 7));
          await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
          await measure('footer', async () => { await wheel(-35, 8); await wheel(35, 8); await page.waitForTimeout(5200); });
          if (cdp) {
            sample.layers = [];
            for (const layer of layers) try { sample.layers.push({ width: layer.width, height: layer.height, drawsContent: layer.drawsContent, ...(await cdp.send('LayerTree.compositingReasons', { layerId: layer.layerId })) }); } catch { /* A transient animation layer may already be gone. */ }
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          report.samples.push(sample); await page.close();
          console.log(`Measured ${engine} ${build} ${theme} run ${run}`);
          fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report));
        }
      } finally { await browser.close(); }
    }
    assert.deepEqual(report.errors, []);
  } finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report)); console.log('Scroll evidence:', output); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
