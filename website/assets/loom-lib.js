// Shared data helpers and renderers. Models come from loom-data.js (generated from summaries/).

const LOOM = (() => {
  const METRICS = [
    { key: 'decode', group: 'decode', label: 'decode', detail: 'short prompt', short: 'dec' },
    { key: 'decode_2k', group: 'decode', label: 'decode', detail: '2k context', short: 'dec 2k' },
    { key: 'decode_32k', group: 'decode', label: 'decode', detail: '32k context', short: 'dec 32k' },
    { key: 'prefill_1k', group: 'prefill', label: 'prefill', detail: '1k document', short: 'pre 1k' },
    { key: 'prefill_2k', group: 'prefill', label: 'prefill', detail: '2k document', short: 'pre 2k' },
    { key: 'prefill_8k', group: 'prefill', label: 'prefill', detail: '8k document', short: 'pre 8k' },
    { key: 'prefill_16k', group: 'prefill', label: 'prefill', detail: '16k document', short: 'pre 16k' },
    { key: 'prefill_32k', group: 'prefill', label: 'prefill', detail: '32k document', short: 'pre 32k' },
    { key: 'streams4', group: 'streams', label: '4 streams', detail: 'aggregate decode', short: '4×dec' },
  ];
  const METRIC = Object.fromEntries(METRICS.map(m => [m.key, m]));

  const FEATURES = {
    tool_calling: 'tool calling',
    thinking: 'thinking',
    reasoning_effort: 'reasoning effort',
    image_input: 'image input',
    audio: 'audio',
    speculative_decoding: 'speculative decoding',
    sampling: 'sampling',
    concurrency: 'concurrency',
    context: 'full context',
    max_output_tokens: 'max output tokens',
    api: 'openai api',
  };
  // Capability flags shown in tables: letter, feature key, label.
  const FLAGS = [
    ['T', 'tool_calling', 'tool calling'],
    ['V', 'image_input', 'vision'],
    ['R', 'thinking', 'thinking'],
    ['S', 'speculative_decoding', 'speculative decoding'],
    ['P', 'sampling', 'per-request sampling'],
  ];

  const GATES = {
    kernel_tests: 'generated kernels vs reference implementations',
    golden: 'llama.cpp reference on the same GGUF: greedy tokens, top-5 log-probs',
    compare: 'greedy output vs the reference, token by token',
    vision: 'image input vs llama.cpp with the same projector',
    consistency: 'concurrent requests = the same requests run alone',
    spec: 'speculative decoding on = speculative decoding off',
    agent: 'multi-turn tool-calling loop vs llama.cpp',
    agent_think_off: 'the tool-calling loop with thinking off',
    sampling: 'temperature, top_k and seed behave as specified',
    needle: 'needle-in-a-haystack up to half the context',
    needle_full: 'needle-in-a-haystack at the full context',
    decision: 'decision answers vs llama.cpp',
  };

  const geomean = xs => xs.length ? Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length) : null;

  function enrich(s) {
    const metrics = s.performance.metrics;
    const measured = METRICS.filter(m => metrics[m.key] && metrics[m.key].speedup != null)
      .map(m => ({ ...m, ...metrics[m.key] }));
    const byGroup = g => geomean(measured.filter(m => m.group === g).map(m => m.speedup));
    const g = s.gates.summary;
    const applicable = g.pass + g.fail + g.unknown;
    const val = k => (metrics[k] || {}).loom;
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
      decodeTok: val('decode'),
      prefillTok: val('prefill_2k'),
      gatesApplicable: applicable,
      gatesPass: g.pass,
      verified: applicable > 0 && g.fail === 0 && g.unknown === 0,
      vision: s.features.image_input === 'yes',
      tools: s.features.tool_calling === 'yes',
      spec: s.features.speculative_decoding === 'yes',
      thinking: s.features.thinking === 'yes',
    };
  }

  const models = (window.LOOM_DATA ? window.LOOM_DATA.models : []).map(enrich)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  models.forEach((m, i) => { m.rank = i + 1; });

  const pct = x => {
    if (x == null) return '—';
    const p = Math.round((x - 1) * 100);
    return p === 0 ? '±0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`;
  };
  const times = x => x == null ? '—' : `${x.toFixed(2)}×`;
  const num = x => x == null ? '—' : x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1);
  const gb = b => b == null ? '—' : `${(b / 1e9).toFixed(b < 1e10 ? 1 : 0)} GB`;
  const ctx = t => t == null ? '—' : t >= 1024 ? `${Math.round(t / 1024)}k` : `${t}`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hf = repo => `https://huggingface.co/${repo}`;
  // Diverging ratio bar centred on 1.0: left half when the reference is faster.
  function ratioBar(r) {
    if (r == null) return '<span class="rb"></span>';
    const w = r >= 1 ? Math.min(1, (r - 1) / 0.8) * 50 : Math.min(1, (1 - r) / 0.5) * 50;
    return `<span class="rb"><i class="${r >= 1 ? 'pos' : 'neg'}" style="width:${w.toFixed(1)}%"></i></span>`;
  }

  function gateStrip(m) {
    return Object.values(m.gates.status).filter(s => s !== 'n/a')
      .map(s => `<i class="g g-${s}"></i>`).join('');
  }

  function flags(m) {
    return FLAGS.map(([l, k, label]) => {
      const on = m.features[k] === 'yes';
      return `<i class="flag ${on ? 'on' : ''}" title="${label}: ${on ? 'yes' : 'no'}">${on ? l : '·'}</i>`;
    }).join('');
  }

  const sub = m => [esc(m.quant), gb(m.sizeBytes),
    m.serve.context_tokens ? `${ctx(m.serve.context_tokens)} ctx` : null,
    m.service.kind !== 'chat' ? esc(m.service.kind) : null].filter(Boolean).join(' · ');

  const COLUMNS = [
    { key: 'rank', label: '#', get: m => m.rank, cls: 'num' },
    { key: 'name', label: 'model', get: m => m.name.toLowerCase(), cls: 'name' },
    { key: 'size', label: 'size', get: m => m.sizeBytes, cls: 'num hide-s' },
    { key: 'ctx', label: 'ctx', get: m => m.serve.context_tokens || 0, cls: 'num hide-s' },
    { key: 'flags', label: 'T V R S P', get: m => FLAGS.filter(f => m.features[f[1]] === 'yes').length, cls: 'flags hide-s' },
    { key: 'gates', label: 'gates', get: m => m.gatesApplicable ? m.gatesPass / m.gatesApplicable : 0, cls: 'gates hide-m' },
    { key: 'decode', label: 'decode tok/s', get: m => m.decodeTok || 0, cls: 'num hide-m' },
    { key: 'prefill', label: 'prefill 2k', get: m => m.prefillTok || 0, cls: 'num hide-m' },
    { key: 'score', label: 'vs llama.cpp', get: m => m.score || 0, cls: 'ratio' },
  ];

  function cell(col, m) {
    switch (col.key) {
      case 'rank': return String(m.rank).padStart(2, '0');
      case 'name': return `<b>${esc(m.name)}</b><small>${sub(m)}</small>`;
      case 'size': return gb(m.sizeBytes);
      case 'ctx': return ctx(m.serve.context_tokens);
      case 'flags': return flags(m);
      case 'gates': return `<span class="strip">${gateStrip(m)}</span><small>${m.gatesPass}/${m.gatesApplicable}</small>`;
      case 'decode': return m.decodeTok ? num(m.decodeTok) : '—';
      case 'prefill': return m.prefillTok ? num(m.prefillTok) : '—';
      case 'score': return `${ratioBar(m.score)} ${times(m.score)}`;
    }
  }

  // Sortable leaderboard table. `onOpen(m)` is called when a row is chosen.
  function mountTable(el, list, { onOpen, sortKey = 'score' } = {}) {
    let key = sortKey, dir = key === 'name' || key === 'rank' ? 1 : -1, rows = list;
    const render = () => {
      const col = COLUMNS.find(c => c.key === key);
      const sorted = [...rows].sort((a, b) => {
        const x = col.get(a), y = col.get(b);
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
      el.innerHTML = `
        <thead><tr>${COLUMNS.map(c => `<th class="${c.cls}" data-k="${c.key}">${c.label}${c.key === key ? (dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
        <tbody>${sorted.map(m => `<tr data-id="${esc(m.id)}" tabindex="0">${COLUMNS.map(c => `<td class="${c.cls}">${cell(c, m)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      if (!sorted.length) el.querySelector('tbody').innerHTML = `<tr class="empty"><td colspan="${COLUMNS.length}">no model matches · <a href="submit.html">publish one →</a></td></tr>`;
    };
    el.addEventListener('click', e => {
      const th = e.target.closest('th');
      if (th) {
        const k = th.dataset.k;
        if (k === key) dir = -dir; else { key = k; dir = k === 'name' || k === 'rank' ? 1 : -1; }
        render();
        return;
      }
      const tr = e.target.closest('tr[data-id]');
      if (tr && onOpen) onOpen(models.find(m => m.id === tr.dataset.id));
    });
    el.addEventListener('keydown', e => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter' && onOpen) onOpen(models.find(m => m.id === tr.dataset.id));
    });
    render();
    return { update: list2 => { rows = list2; render(); } };
  }

  function stats() {
    const all = models.flatMap(m => m.measured);
    return {
      models: models.length,
      orgs: new Set(models.map(m => m.baseRepo.split('/')[0])).size,
      runs: all.length,
      tools: models.filter(m => m.tools).length,
      vision: models.filter(m => m.vision).length,
      spec: models.filter(m => m.spec).length,
      verified: models.filter(m => m.verified).length,
      maxCtx: Math.max(...models.map(m => m.serve.context_tokens || 0)),
      generated: window.LOOM_DATA ? window.LOOM_DATA.generated : null,
    };
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
        const code = btn.closest('.code').querySelector('code');
        const text = [...code.childNodes].map(n => n.classList && n.classList.contains('p') ? '' : n.textContent).join('');
        try {
          await navigator.clipboard.writeText(text.trim());
          btn.textContent = 'copied';
          setTimeout(() => { btn.textContent = 'copy'; }, 1400);
        } catch (e) { btn.textContent = 'select + ctrl-c'; }
      });
    });
  }

  function reveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.1 });
    els.forEach(e => io.observe(e));
  }

  return {
    METRICS, METRIC, FEATURES, FLAGS, GATES, models, stats, pct, times, num, gb, ctx, esc, hf,
    ratioBar, gateStrip, flags, sub, mountTable, quickstart, copyButtons, reveal,
  };
})();
