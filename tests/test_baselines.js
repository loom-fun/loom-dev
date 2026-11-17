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

test('quickstart renders source blocks verbatim, escapes text, and never guesses commands', () => {
  const { loom } = site();
  const m = { repo: 'org/card', revision: 'pinned', quickstart: { 'strix-halo': {
    install: 'pipx install "hrx-loom[hf]==99.4"', fetch: 'loom-fetch exact --output=/future',
    serve: "loom-serve --model=/future/model.json '--device=future' --new_flag=ok",
    blocks: [{kind:'code',text:'pipx install "hrx-loom[hf]==99.4"\nloom-fetch exact --output=/future\nloom-serve --new_flag=ok'},
      {kind:'text',text:'Stock host: systemd-run <unsafe> & --new_flag=ok'},
      {kind:'code',text:'curl -d \'{"model":"exact","reasoning_effort":"none"}\''}]
  } } };
  const gpu = {id:'strix-halo'};
  assert.equal(loom.fetchCmd(m,gpu), m.quickstart['strix-halo'].fetch);
  assert.equal(loom.serveCmd(m,gpu), m.quickstart['strix-halo'].serve);
  assert.equal(loom.installCmd(m,gpu), m.quickstart['strix-halo'].install);
  const html = loom.quickstartHtml(m,gpu);
  assert.ok(html.includes('systemd-run &lt;unsafe&gt; &amp; --new_flag=ok'));
  assert.ok(html.includes('reasoning_effort'));
  assert.ok(html.includes('/blob/pinned/README.md#quick-start'));
  assert.ok(!html.includes('<unsafe>'));
  for (const value of [{}, { 'strix-halo': {preset:'chat',serve_args:[]} }]) {
    const missing = {...m,quickstart:value};
    assert.ok(loom.quickstartHtml(missing,gpu).includes('unavailable'));
    assert.ok(!loom.quickstart(missing,gpu).includes('loom-serve'));
  }
  assert.ok(loom.quickstart(m,{id:'another-gpu'}).includes('unavailable'));
});

test('quickstart source links use independent README pins while frozen summary revision remains intact', () => {
  const { loom } = site();
  const q = { install:'pipx install hrx-loom', fetch:'loom-fetch source', serve:'loom-serve source',
    source_revision:'readme-only-commit', blocks:[{kind:'text',text:'new source notes'}] };
  const m = {repo:'org/card',revision:'frozen-measurement-commit',quickstart:{'strix-halo':q}};
  const before=JSON.stringify(m);
  assert.ok(loom.quickstartHtml(m,{id:'strix-halo'}).includes('/blob/readme-only-commit/README.md'));
  assert.equal(JSON.stringify(m),before);
});

test('card SDK, output path, flags and request mutations reach rendered site without frontend edits', () => {
  const { spawnSync } = require('node:child_process');
  const script = `import sys,types,json,pathlib
stub=types.ModuleType('huggingface_hub');stub.HfApi=stub.hf_hub_download=None;sys.modules['huggingface_hub']=stub
import summarize_info as S
text=pathlib.Path('tests/quickstart_cards/unsloth-Qwen3-0.6B.md').read_text()
text=text.replace('0.2.0','99.4.1').replace('--output=Qwen3-0.6B','--output=/future/path').replace('--model=Qwen3-0.6B','--model=/future/path').replace('--pool_backing=fixed','--new_flag=next')
text+='\\n'+'\x60\x60\x60bash\\ncurl --data '+json.dumps({'model':'exact-selector','reasoning_effort':'none'})+'\\n\x60\x60\x60\\n'
print(json.dumps(S.quickstart(text)))`;
  const result = spawnSync('python3',['-c',script],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const { loom } = site();
  const m={repo:'test/card',quickstart:JSON.parse(result.stdout)};
  for (const id of Object.keys(m.quickstart)) {
    const html=loom.quickstartHtml(m,{id});
    assert.ok(html.includes('99.4.1'));
    assert.ok(html.includes('--output=/future/path'));
    assert.ok(html.includes('--model=/future/path'));
    assert.ok(html.includes('exact-selector'));
    if (id !== 'gfx1201-16gb') assert.ok(html.includes('--new_flag=next'));
  }
});


test('staging source snapshots render new flag notes and request fences with their README provenance', () => {
  const { loom } = site('?org=loom-fun-staging', 'loom-data-staging.js');
  let checked = 0;
  for (const m of loom.all) {
    for (const [id,q] of Object.entries(m.quickstart || {})) {
      if (!q.blocks?.some(b => b.text.includes('performance measurements use this setting'))) continue;
      assert.match(q.source_revision, /^[0-9a-f]{40}$/);
      const html = loom.quickstartHtml(m,{id});
      assert.ok(html.includes('copies of the fetched package files'));
      assert.ok(html.includes(`/blob/${q.source_revision}/README.md#quick-start`));
      if (m.service.kind === 'chat') {
        const request = q.blocks.find(b => b.kind === 'code' && b.text.startsWith('curl '));
        assert.ok(request);
        assert.ok(html.includes(loom.esc(request.text)));
      }
      checked++;
    }
  }
  assert.ok(checked > 0);
});


test('vLLM sources stay distinct and are excluded from every llama comparison choice', () => {
  const { loom } = site('?gpu=radeon-r9700&org=loom-fun-staging','loom-data-staging.js');
  loom.setGpu('radeon-r9700');
  for (const mode of ['rocm','vulkan','best']) {
    loom.setBaseline(mode);
    const m=loom.models.find(m => m.weights.checkpoint.file.endsWith('.safetensors'));
    assert.ok(m);
    assert.equal(m.comparisonAvailable,false);
    assert.equal(m.score,null);
    assert.equal(m.measured.length,0);
    assert.equal(m.pair('decode'),null);
    assert.equal(m.bench.metrics.decode.loom,77.5);
    assert.equal(m.bench.metrics.decode.llamacpp,null);
    assert.equal(m.bench.metrics.decode.baselineSource,null);
    assert.equal(m.performance.devlab.metrics.decode.baseline,10.9);
    assert.equal(m.performance.devlab.metrics.decode.baseline_from.source.run,'43920731237');
    assert.equal(m.bench.source.run,'44162729495');
    for (const key of ['decode_32k','prefill_8k','prefill_16k','prefill_32k']) {
      assert.equal(m.bench.metrics[key].baseline,null);
      assert.equal(m.bench.metrics[key].speedup,null);
    }
    const panel=loom.referencePanel(m);
    assert.ok(panel.includes('vLLM · vllm/0.18.0'));
    assert.match(panel,/Loom measurement:.*44162729495/);
    assert.match(panel,/Reference measurement:.*43920731237/);
    assert.ok(panel.includes('/blob/01bbfe132163df667ebeb6f614dda0e28336e086/README.md'));
    assert.ok(!panel.includes('llama.cpp ROCm'));
    assert.ok(!loom.card(m).includes('10.9'));
    assert.ok(!loom.card(m).includes('mc-rank'));
    assert.equal(loom.rk(m),'—');
    assert.ok(!loom.curve(m,'decode').includes('polyline'));
    assert.notEqual(loom.stats().best?.m.id,m.id);
    assert.ok(loom.quickstartHtml(m).includes('hrx-loom[hf]==0.2.0'));
    const synthetic={...m.performance,baselines:{vulkan:{metrics:{decode:{llamacpp:9999}}}}};
    assert.equal(loom.bench(synthetic).metrics.decode.speedup,null);
  }
});

test('legacy safetensors with unrecorded reference engine never invent llama or baseline provenance', () => {
  const { loom } = site('?gpu=radeon-r9700');loom.setGpu('radeon-r9700');
  for (const mode of ['rocm','vulkan','best']) {
    loom.setBaseline(mode);
    const m=loom.models.find(m => m.weights.checkpoint.file.endsWith('.safetensors'));
    assert.equal(m.comparisonAvailable,false);
    assert.equal(m.score,null);
    assert.equal(m.measured.length,0);
    assert.equal(m.pair('decode'),null);
    const panel=loom.referencePanel(m);
    assert.ok(panel.includes('Reference engine not recorded in this frozen snapshot'));
    assert.ok(panel.includes('Reference measurement: source not recorded'));
    assert.ok(!panel.includes('vLLM'));
    assert.ok(!panel.includes('llama.cpp ROCm'));
  }
});

test('actual model drawer takes the compact provenance and quickstart path for excluded references', () => {
  const { loom,context } = site('?gpu=radeon-r9700&org=loom-fun-staging','loom-data-staging.js');
  loom.setGpu('radeon-r9700');
  const source=fs.readFileSync(path.join(root,'docs/assets/explore.js'),'utf8');
  const drawer=source.slice(source.indexOf('  function drawer(m) {'),source.indexOf('\n  let current = null;'));
  const render=vm.runInContext(`(function(LOOM,el,esc,quickstartHtml,m){${drawer};drawer(m);})`,context);
  for (const mode of ['rocm','vulkan','best']) {
    loom.setBaseline(mode);
    const m=loom.models.find(m => m.weights.checkpoint.file.endsWith('.safetensors'));
    const nodes={dr:{innerHTML:'',querySelectorAll:()=>[]},drPath:{textContent:''}};
    render(loom,id=>{assert.ok(nodes[id],`unexpected generic comparison element ${id}`);return nodes[id]},loom.esc,loom.quickstartHtml,m);
    const html=nodes.dr.innerHTML;
    assert.ok(html.includes('vLLM · vllm/0.18.0'));
    assert.match(html,/Loom measurement:.*44162729495/);
    assert.match(html,/Reference measurement:.*43920731237/);
    assert.ok(html.includes('curl http://127.0.0.1:8080/v1/chat/completions'));
    assert.ok(html.includes('Pinned source card and full measurements'));
    assert.ok(!html.includes('llama.cpp ROCm'));
    assert.ok(!html.includes('drDecode'));
  }
});
