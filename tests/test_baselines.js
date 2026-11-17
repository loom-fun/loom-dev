// Run with node --test tests/test_baselines.js (no browser or dependencies required).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function site(query = '', dataFile = 'loom-data.js') {
  const events = {}, listeners = {};
  const location = new URL('http://localhost:8199/models.html' + query);
  const document = {
    currentScript: { src: 'http://localhost:8199/assets/data-source.js' },
    write() {}, querySelectorAll: () => [], getElementById: () => null,
    addEventListener: (name, fn) => (listeners[name] ||= []).push(fn),
    dispatchEvent: event => { for (const fn of listeners[event.type] || []) fn(event); },
  };
  const context = vm.createContext({ window: null, document, location, URL, URLSearchParams,
    history: { pushState: (_s, _t, url) => { location.href = new URL(url, location).href; }, replaceState() {} },
    addEventListener: (name, fn) => { events[name] = fn; },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  });
  context.window = context;
  for (const file of ['data-source.js', dataFile, 'loom-lib.js'])
    vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets', file), 'utf8'), context);
  const loom = vm.runInContext('LOOM', context);
  return { loom, context, location, events, listeners };
}

test('max selects each workload independently, handles missing cells, and holds Loom fixed', () => {
  const { loom } = site();
  const perf = { metrics: {
    decode: { loom: 100, llamacpp: 50, speedup: 2 },
    prefill_1k: { loom: 1000, llamacpp: 800, speedup: 1.25 },
    streams4: { loom: 200, llamacpp: null, speedup: null },
    decode_2k: { loom: 90, llamacpp: 30, speedup: 3 },
    decode_32k: { loom: 80, llamacpp: null, speedup: null },
  }, baselines: { vulkan: { metrics: {
    decode: { llamacpp: 80 }, prefill_1k: { llamacpp: 600 }, streams4: { llamacpp: 160 },
  } } } };
  const original = JSON.stringify(perf);
  loom.setBaseline('best');
  const m = loom.bench(perf).metrics;
  assert.equal(m.decode.llamacpp, 80); assert.equal(m.decode.backend, 'vulkan');
  assert.equal(m.prefill_1k.llamacpp, 800); assert.equal(m.prefill_1k.backend, 'rocm');
  assert.equal(m.streams4.speedup, 1.25); assert.equal(m.decode_2k.speedup, 3);
  assert.equal(m.decode_32k.speedup, null); assert.equal(m.decode.loom, 100);
  loom.setBaseline('vulkan');
  assert.equal(loom.bench(perf).metrics.decode_2k.speedup, null);
  assert.equal(JSON.stringify(perf), original);
});

test('real published and staging models recompute for every GPU and backend without mutating source data', () => {
  for (const file of ['loom-data.js', 'loom-data-staging.js']) {
    const { loom } = site('', file);
    const models = loom.models, before = JSON.stringify(loom.all);
    let vulkanWins = 0, rocmWins = 0;
    for (const gpu of loom.GPUS) {
      loom.setGpu(gpu.id);
      for (const mode of ['rocm', 'vulkan', 'best']) {
        loom.setBaseline(mode);
        assert.equal(loom.models, models);
        for (const m of models) {
          for (const p of m.measured) {
            assert.ok(Number.isFinite(p.speedup) && p.speedup > 0);
            assert.equal(p.speedup, p.loom / p.llamacpp);
            if (mode === 'best') {
              if (p.backend === 'vulkan') vulkanWins++; else rocmWins++;
            }
          }
          assert.ok(!/NaN|Infinity/.test(loom.card(m)));
        }
      }
    }
    assert.ok(vulkanWins > 0 && rocmWins > 0);
    assert.equal(JSON.stringify(loom.all), before);
  }
});

test('URL carries baseline, org, GPU and model hash; Back restores the selection', () => {
  const { loom, location, listeners, events, context } = site('?baseline=vulkan&org=loom-fun-staging#Qwen3-8B');
  assert.equal(loom.BASELINE, 'vulkan');
  assert.match(loom.href(loom.models[0]), /baseline=vulkan/);
  assert.match(loom.href(loom.models[0]), /org=loom-fun-staging/);
  for (const fn of listeners.DOMContentLoaded.slice(1)) fn(); // mountGpu, excluding data-source's page band
  loom.setBaseline('best');
  loom.setGpu(loom.GPUS[1].id);
  assert.equal(location.hash, '#Qwen3-8B');
  assert.equal(location.searchParams.get('baseline'), 'best');
  assert.equal(location.searchParams.get('gpu'), loom.GPUS[1].id);
  location.search = '?baseline=vulkan'; events.popstate();
  assert.equal(loom.BASELINE, 'vulkan'); assert.equal(loom.GPU.id, loom.GPUS[0].id);
  loom.setBaseline('unknown'); assert.equal(loom.BASELINE, 'rocm');
  assert.equal(location.searchParams.has('baseline'), false);
  assert.equal(context.LOOM_LINK('https://huggingface.co/loom-fun'), 'https://huggingface.co/loom-fun');
});
