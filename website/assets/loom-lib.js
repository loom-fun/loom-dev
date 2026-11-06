// Shared data helpers for every page. Models come from loom-data.js (generated from summaries/).

const LOOM = (() => {
  const METRICS = [
    { key: 'decode', group: 'decode', label: 'Decode', detail: 'short prompt', unit: 'tok/s' },
    { key: 'decode_2k', group: 'decode', label: 'Decode', detail: '2k context', unit: 'tok/s' },
    { key: 'decode_32k', group: 'decode', label: 'Decode', detail: '32k context', unit: 'tok/s' },
    { key: 'prefill_1k', group: 'prefill', label: 'Prefill', detail: '1k document', unit: 'tok/s' },
    { key: 'prefill_2k', group: 'prefill', label: 'Prefill', detail: '2k document', unit: 'tok/s' },
    { key: 'prefill_8k', group: 'prefill', label: 'Prefill', detail: '8k document', unit: 'tok/s' },
    { key: 'prefill_16k', group: 'prefill', label: 'Prefill', detail: '16k document', unit: 'tok/s' },
    { key: 'prefill_32k', group: 'prefill', label: 'Prefill', detail: '32k document', unit: 'tok/s' },
    { key: 'streams4', group: 'streams', label: '4 streams', detail: 'aggregate decode', unit: 'tok/s' },
  ];
  const METRIC = Object.fromEntries(METRICS.map(m => [m.key, m]));

  const FEATURES = {
    tool_calling: { label: 'Tool calling', icon: 'build' },
    thinking: { label: 'Thinking', icon: 'psychology' },
    image_input: { label: 'Vision', icon: 'visibility' },
    speculative_decoding: { label: 'Speculative decoding', icon: 'bolt' },
    sampling: { label: 'Sampling', icon: 'casino' },
    reasoning_effort: { label: 'Reasoning effort', icon: 'tune' },
    audio: { label: 'Audio', icon: 'graphic_eq' },
    concurrency: { label: 'Concurrency', icon: 'stacks' },
    context: { label: 'Full context', icon: 'notes' },
    max_output_tokens: { label: 'Max output tokens', icon: 'straighten' },
    api: { label: 'OpenAI API', icon: 'api' },
  };
  const HIGHLIGHT_FEATURES = ['tool_calling', 'image_input', 'thinking', 'speculative_decoding', 'sampling', 'reasoning_effort', 'audio'];

  const GATES = {
    kernel_tests: 'Unit tests of the generated kernels against reference implementations',
    golden: 'llama.cpp reference recorded on the same GGUF: greedy tokens and top-5 log-probs',
    compare: 'Greedy output vs the llama.cpp reference, token by token',
    vision: 'Image input vs llama.cpp with the same projector',
    consistency: 'Concurrent requests give the same output as the same requests run alone',
    spec: 'Speculative decoding on gives exactly the output of speculative decoding off',
    agent: 'Multi-turn tool-calling loop vs llama.cpp',
    agent_think_off: 'The tool-calling loop with thinking off',
    sampling: 'temperature, top_k and seed behave as specified',
    needle: 'Needle-in-a-haystack at up to half the context, compared with llama.cpp',
    needle_full: 'Needle-in-a-haystack at the full context is served',
    decision: 'Decision answers vs llama.cpp on the same prompts',
  };

  const geomean = xs => xs.length ? Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length) : null;

  function enrich(s) {
    const metrics = s.performance.metrics;
    const measured = METRICS.filter(m => metrics[m.key] && metrics[m.key].speedup != null)
      .map(m => ({ ...m, ...metrics[m.key] }));
    const byGroup = g => geomean(measured.filter(m => m.group === g).map(m => m.speedup));
    const best = measured.reduce((b, m) => (!b || m.speedup > b.speedup ? m : b), null);
    const g = s.gates.summary;
    const applicable = g.pass + g.fail + g.unknown;
    return {
      ...s,
      id: s.checkpoint,
      quant: s.weights.checkpoint.quant,
      sizeBytes: s.weights.checkpoint.size,
      baseRepo: s.weights.checkpoint.repo,
      measured,
      score: geomean(measured.map(m => m.speedup)),
      decodeScore: byGroup('decode'),
      prefillScore: byGroup('prefill'),
      streamsScore: byGroup('streams'),
      best,
      wins: measured.filter(m => m.speedup > 1).length,
      gatesApplicable: applicable,
      verified: applicable > 0 && g.fail === 0 && g.unknown === 0,
      vision: s.features.image_input === 'yes',
      tools: s.features.tool_calling === 'yes',
      spec: s.features.speculative_decoding === 'yes',
      thinking: s.features.thinking === 'yes',
    };
  }

  const models = (window.LOOM_DATA ? window.LOOM_DATA.models : []).map(enrich)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const pct = x => {
    if (x == null) return '—';
    const p = Math.round((x - 1) * 100);
    return p === 0 ? '±0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`;
  };
  const times = x => x == null ? '—' : `${x.toFixed(2)}×`;
  const num = x => x == null ? '—' : x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(1);
  const gb = b => b == null ? '—' : `${(b / 1e9).toFixed(b < 1e10 ? 1 : 0)} GB`;
  const ctx = t => t == null ? '—' : t >= 1024 ? `${Math.round(t / 1024)}k` : `${t}`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hf = repo => `https://huggingface.co/${repo}`;

  // Diverging scale: cool slate below parity, warm thread colors above.
  function heat(x) {
    if (x == null) return 'transparent';
    if (x < 1) {
      const t = Math.min(1, (1 - x) / 0.5);
      return `rgba(110, 130, 190, ${0.12 + t * 0.5})`;
    }
    const t = Math.min(1, (x - 1) / 0.8);
    return `hsla(${(338 + t * 64) % 360}, 100%, ${60 + t * 2}%, ${0.2 + t * 0.7})`;
  }

  function stats() {
    const all = models.flatMap(m => m.measured);
    const top = all.reduce((b, m) => (!b || m.speedup > b.speedup ? m : b), null);
    return {
      models: models.length,
      runs: all.length,
      wins: all.filter(m => m.speedup > 1).length,
      bestSpeedup: top ? top.speedup : null,
      bestDecode: Math.max(...models.map(m => (m.performance.metrics.decode || {}).speedup || 0)),
      medianScore: (() => {
        const xs = models.map(m => m.score).filter(Boolean).sort((a, b) => a - b);
        return xs.length ? xs[Math.floor(xs.length / 2)] : null;
      })(),
      verified: models.filter(m => m.verified).length,
      generated: window.LOOM_DATA ? window.LOOM_DATA.generated : null,
    };
  }

  const sub = m => [esc(m.quant), gb(m.sizeBytes),
    m.serve.context_tokens ? `${ctx(m.serve.context_tokens)} ctx` : null,
    m.service.kind !== 'chat' ? esc(m.service.kind) : null].filter(Boolean).join(' · ');

  function gateChip(m) {
    const g = m.gates.summary;
    if (m.verified) return '<span class="chip verified"><span class="material-symbols-outlined">verified</span>All gates pass</span>';
    if (g.fail) return `<span class="chip fail"><span class="material-symbols-outlined">error</span>${g.fail} gate${g.fail > 1 ? 's' : ''} failed</span>`;
    return `<span class="chip"><span class="material-symbols-outlined">rule</span>${g.pass}/${m.gatesApplicable} gates pass</span>`;
  }

  function quickstart(m) {
    const out = m.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const mem = m.serve.memory_bytes || '<bytes>';
    return [
      'pip install "hrx-loom[hf]"',
      `loom-fetch https://huggingface.co/${m.repo}/resolve/main/model.json \\\n  --materialize=copy --output=${out}`,
      `loom-serve --model=${out}/model.json --device=${m.serve.device} \\\n  --memory_bytes=${mem}`,
    ].join('\n');
  }

  function copyButtons(root = document) {
    root.querySelectorAll('[data-copy]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        const target = btn.dataset.copy ? document.getElementById(btn.dataset.copy) : btn.closest('.code').querySelector('code');
        try {
          await navigator.clipboard.writeText(target.innerText.trim());
          btn.classList.add('copied');
          btn.querySelector('.material-symbols-outlined').textContent = 'check';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('.material-symbols-outlined').textContent = 'content_copy';
          }, 1400);
        } catch (e) { /* clipboard blocked on file:// in some browsers */ }
      });
    });
  }

  function reveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  }

  return { METRICS, METRIC, FEATURES, HIGHLIGHT_FEATURES, GATES, models, stats, pct, times, num, gb, ctx, esc, hf, heat, sub, gateChip, quickstart, copyButtons, reveal };
})();
