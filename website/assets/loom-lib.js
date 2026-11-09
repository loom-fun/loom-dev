// Shared data helpers, renderers and SVG charts. Models come from loom-data.js (generated from summaries/).

const LOOM = (() => {
  const METRICS = [
    { key: 'decode', group: 'decode', label: 'decode', detail: 'short prompt', short: 'dec', x: 'short' },
    { key: 'decode_2k', group: 'decode', label: 'decode', detail: '2k context', short: 'dec 2k', x: '2k' },
    { key: 'decode_32k', group: 'decode', label: 'decode', detail: '32k context', short: 'dec 32k', x: '32k' },
    { key: 'prefill_1k', group: 'prefill', label: 'prefill', detail: '1k document', short: 'pre 1k', x: '1k' },
    { key: 'prefill_2k', group: 'prefill', label: 'prefill', detail: '2k document', short: 'pre 2k', x: '2k' },
    { key: 'prefill_8k', group: 'prefill', label: 'prefill', detail: '8k document', short: 'pre 8k', x: '8k' },
    { key: 'prefill_16k', group: 'prefill', label: 'prefill', detail: '16k document', short: 'pre 16k', x: '16k' },
    { key: 'prefill_32k', group: 'prefill', label: 'prefill', detail: '32k document', short: 'pre 32k', x: '32k' },
    { key: 'streams4', group: 'streams', label: '4 streams', detail: 'aggregate decode', short: '4×dec', x: '4×' },
  ];
  const METRIC = Object.fromEntries(METRICS.map(m => [m.key, m]));
  const DECODE = METRICS.filter(m => m.group === 'decode');
  const PREFILL = METRICS.filter(m => m.group === 'prefill');

  const FEATURES = {
    tool_calling: ['tools', 'tool calling'],
    thinking: ['think', 'thinking'],
    reasoning_effort: ['effort', 'reasoning effort'],
    image_input: ['image', 'image input'],
    audio: ['audio', 'audio'],
    speculative_decoding: ['spec', 'speculative decoding'],
    sampling: ['sample', 'per-request sampling'],
    concurrency: ['conc', 'concurrency'],
    context: ['ctx', 'full context'],
    max_output_tokens: ['maxout', 'max output tokens'],
    api: ['api', 'openai api'],
  };
  const FLAGS = [
    ['T', 'tool_calling', 'tool calling'],
    ['V', 'image_input', 'vision'],
    ['R', 'thinking', 'thinking'],
    ['S', 'speculative_decoding', 'speculative decoding'],
    ['P', 'sampling', 'per-request sampling'],
  ];

  const GATES = {
    kernel_tests: ['kern', 'generated kernels vs reference implementations'],
    golden: ['gold', 'llama.cpp reference on the same GGUF: greedy tokens, top-5 log-probs'],
    compare: ['cmp', 'greedy output vs the reference, token by token'],
    vision: ['vis', 'image input vs llama.cpp with the same projector'],
    consistency: ['cons', 'concurrent requests = the same requests run alone'],
    spec: ['spec', 'speculative decoding on = speculative decoding off'],
    agent: ['agent', 'multi-turn tool-calling loop vs llama.cpp'],
    agent_think_off: ['ag-off', 'the tool-calling loop with thinking off'],
    sampling: ['samp', 'temperature, top_k and seed behave as specified'],
    needle: ['ndl', 'needle-in-a-haystack up to half the context'],
    needle_full: ['ndl-f', 'needle-in-a-haystack at the full context'],
    decision: ['dec', 'decision answers vs llama.cpp'],
  };

  const geomean = xs => xs.length ? Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length) : null;
  const median = xs => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b), h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  };

  function enrich(s) {
    const metrics = s.performance.metrics;
    const pair = k => metrics[k] && metrics[k].speedup != null ? { ...METRIC[k], ...metrics[k] } : null;
    const measured = METRICS.map(m => pair(m.key)).filter(Boolean);
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
      org: s.weights.checkpoint.repo.split('/')[0],
      measured,
      pair,
      score: geomean(measured.map(m => m.speedup)),
      decodeScore: byGroup('decode'),
      prefillScore: byGroup('prefill'),
      streamsScore: byGroup('streams'),
      decodeTok: val('decode'),
      prefillTok: val('prefill_2k'),
      streamsTok: val('streams4'),
      wins: measured.filter(m => m.speedup > 1.005).length,
      losses: measured.filter(m => m.speedup < 0.995).length,
      best: measured.reduce((a, b) => (!a || b.speedup > a.speedup ? b : a), null),
      worst: measured.reduce((a, b) => (!a || b.speedup < a.speedup ? b : a), null),
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

  // --- formatting ---
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
  const rk = m => String(m.rank).padStart(2, '0');
  const href = m => `models.html#${encodeURIComponent(m.id)}`;
  const AVATARS = (window.LOOM_DATA && window.LOOM_DATA.avatars) || {};
  const avatar = (m, cls = '') => AVATARS[m.org]
    ? `<img class="av ${cls}" src="${esc(AVATARS[m.org])}" alt="" title="${esc(m.org)}" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="av av-na ${cls}" title="${esc(m.org)}">${esc(m.org.charAt(0).toUpperCase())}</span>`;

  // --- inline marks ---
  // Diverging ratio bar centred on 1.0: left half when the reference is faster.
  function ratioBar(r) {
    if (r == null) return '<span class="rb"></span>';
    const w = r >= 1 ? Math.min(1, (r - 1) / 0.8) * 50 : Math.min(1, (1 - r) / 0.5) * 50;
    return `<span class="rb"><i class="${r >= 1 ? 'pos' : 'neg'}" style="width:${w.toFixed(1)}%"></i></span>`;
  }
  const gateStrip = m => Object.values(m.gates.status).filter(s => s !== 'n/a')
    .map(s => `<i class="g g-${s}"></i>`).join('');
  const flags = m => FLAGS.map(([l, k, label]) => {
    const on = m.features[k] === 'yes';
    return `<i class="flag ${on ? 'on' : ''}" title="${label}: ${on ? 'yes' : 'no'}">${on ? l : '·'}</i>`;
  }).join('');
  const sub = m => [esc(m.org), esc(m.quant), gb(m.sizeBytes),
    m.serve.context_tokens ? `${ctx(m.serve.context_tokens)} ctx` : null,
    m.service.kind !== 'chat' ? esc(m.service.kind) : null].filter(Boolean).join(' · ');

  // Nine-bar speedup profile, one bar per metric, up when Loom is faster.
  function profile(m, { w = 92, h = 26 } = {}) {
    const n = METRICS.length, bw = w / n, mid = h / 2, cap = Math.log(2);
    const bars = METRICS.map((x, i) => {
      const p = m.pair(x.key), cx = i * bw;
      if (!p) return `<rect x="${(cx + bw / 2 - 1).toFixed(1)}" y="${mid - 1}" width="2" height="2" class="pf-na"/>`;
      const v = Math.max(-1, Math.min(1, Math.log(p.speedup) / cap)) * (mid - 1);
      const y = v >= 0 ? mid - v : mid, hh = Math.max(1, Math.abs(v));
      return `<rect x="${(cx + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${hh.toFixed(1)}" class="${v >= 0 ? 'pf-up' : 'pf-dn'}"><title>${x.label} ${x.detail}: ${times(p.speedup)}</title></rect>`;
    }).join('');
    const sep = [3, 8].map(i => `<line x1="${i * bw}" x2="${i * bw}" y1="2" y2="${h - 2}" class="pf-sep"/>`).join('');
    return `<svg class="pf" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="per-metric speedup profile">${sep}<line x1="0" x2="${w}" y1="${mid}" y2="${mid}" class="pf-mid"/>${bars}</svg>`;
  }

  // Two-engine curve across a metric group (absolute tok/s), for cards and the drawer.
  function curve(m, group, { w = 260, h = 70, axes = false } = {}) {
    const xs = group === 'prefill' ? PREFILL : DECODE;
    const pts = xs.map(x => m.pair(x.key));
    const vals = pts.filter(Boolean).flatMap(p => [p.loom, p.llamacpp]);
    if (!vals.length) return `<div class="curve-na">${group} not measured</div>`;
    const padL = axes ? 46 : 4, padR = axes ? 12 : 4, padT = axes ? 12 : 6, padB = axes ? 22 : 6;
    const lo = 0, hi = Math.max(...vals) * 1.1;
    const X = i => padL + (xs.length === 1 ? 0 : i * (w - padL - padR) / (xs.length - 1));
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
    const line = (k, cls) => {
      const segs = []; let cur = [];
      pts.forEach((p, i) => { if (p) cur.push(`${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      return segs.map(s => `<polyline points="${s.join(' ')}" class="${cls}"/>`).join('');
    };
    const dots = (k, cls) => pts.map((p, i) => p ? `<rect x="${(X(i) - 2.5).toFixed(1)}" y="${(Y(p[k]) - 2.5).toFixed(1)}" width="5" height="5" class="${cls}"><title>${xs[i].label} ${xs[i].detail} · ${k === 'loom' ? 'loom' : 'llama.cpp'} ${num(p[k])} tok/s</title></rect>` : '').join('');
    let grid = '';
    if (axes) {
      const step = niceStep(hi / 4);
      for (let v = 0; v <= hi; v += step) grid += `<line x1="${padL}" x2="${w - padR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="ax-grid"/><text x="${padL - 6}" y="${(Y(v) + 3).toFixed(1)}" class="ax-t" text-anchor="end">${v >= 1000 ? num(v) : +v.toFixed(1)}</text>`;
      grid += xs.map((x, i) => `<text x="${X(i).toFixed(1)}" y="${h - 6}" class="ax-t" text-anchor="middle">${x.x}</text>`).join('');
    }
    return `<svg class="curve${axes ? ' axes' : ''}" viewBox="0 0 ${w} ${h}"${axes ? '' : ' preserveAspectRatio="none"'} style="aspect-ratio:${w}/${h}">${grid}${line('llamacpp', 'c-ref')}${line('loom', 'c-loom')}${dots('llamacpp', 'd-ref')}${dots('loom', 'd-loom')}</svg>`;
  }

  function niceStep(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }

  // --- collection card ---
  function card(m) {
    const d = m.pair('decode'), pf = m.pair('prefill_2k');
    return `
      <a class="mcard" href="${href(m)}" data-id="${esc(m.id)}">
        <div class="mc-top"><span class="mc-rank">#${rk(m)}</span><span class="mc-score ${m.score < 1 ? 'lo' : ''}">${times(m.score)}</span></div>
        <div class="mc-name">${avatar(m)}<span>${esc(m.name)}</span></div>
        <div class="mc-sub">${sub(m)}</div>
        <div class="mc-marks"><span class="flags">${flags(m)}</span><span class="strip">${gateStrip(m)}</span><span class="mc-gt">${m.gatesPass}/${m.gatesApplicable}</span></div>
        <div class="mc-charts">
          <div><span class="mc-l">prefill tok/s · 1k→32k</span>${curve(m, 'prefill', { w: 200, h: 54 })}</div>
          <div><span class="mc-l">decode tok/s · short→32k</span>${curve(m, 'decode', { w: 120, h: 54 })}</div>
        </div>
        <div class="mc-nums">
          <span><b>${d ? num(d.loom) : '—'}</b><small>${d ? num(d.llamacpp) : '—'}</small>decode</span>
          <span><b>${pf ? num(pf.loom) : '—'}</b><small>${pf ? num(pf.llamacpp) : '—'}</small>prefill 2k</span>
          <span><b>${m.wins}/${m.measured.length}</b><small>&nbsp;</small>wins</span>
          <span class="mc-pf">${profile(m, { w: 72, h: 22 })}</span>
        </div>
      </a>`;
  }

  // --- leaderboard table ---
  const ratioCell = r => `<span class="${r != null && r < 1 ? 'lo' : ''}">${times(r)}</span>`;
  const tokCell = p => p ? `<b>${num(p.loom)}</b><small>${num(p.llamacpp)}</small>` : '<span class="faint">—</span>';
  const COLUMNS = [
    { key: 'rank', label: '#', get: m => m.rank, cls: 'num', asc: true },
    { key: 'name', label: 'model', get: m => m.name.toLowerCase(), cls: 'name', asc: true },
    { key: 'profile', label: 'profile <span class="th-sub">dec · pre · 4×</span>', get: m => m.wins, cls: 'pfc hide-s' },
    { key: 'gates', label: 'gates', get: m => m.gatesApplicable ? m.gatesPass / m.gatesApplicable : 0, cls: 'gates hide-m' },
    { key: 'decodeTok', label: 'decode<span class="th-sub">tok/s</span>', get: m => m.decodeTok || 0, cls: 'num tok hide-s' },
    { key: 'prefillTok', label: 'prefill 2k<span class="th-sub">tok/s</span>', get: m => m.prefillTok || 0, cls: 'num tok hide-s' },
    { key: 'streamsTok', label: '4 streams<span class="th-sub">tok/s</span>', get: m => m.streamsTok || 0, cls: 'num tok hide-m' },
    { key: 'decodeScore', label: 'dec ×', get: m => m.decodeScore || 0, cls: 'num sx hide-l' },
    { key: 'prefillScore', label: 'pre ×', get: m => m.prefillScore || 0, cls: 'num sx hide-l' },
    { key: 'streamsScore', label: '4× ×', get: m => m.streamsScore || 0, cls: 'num sx hide-l' },
    { key: 'score', label: 'overall', get: m => m.score || 0, cls: 'ratio' },
  ];
  function cell(col, m) {
    switch (col.key) {
      case 'rank': return rk(m);
      case 'name': return `<span class="nm">${avatar(m, 'av-lg')}<span><b title="${esc(m.name)}">${esc(m.name)}</b><small>${sub(m)}</small></span></span>`;
      case 'profile': return profile(m);
      case 'gates': return `<span class="strip">${gateStrip(m)}</span><small>${m.gatesPass}/${m.gatesApplicable}</small>`;
      case 'decodeTok': return tokCell(m.pair('decode'));
      case 'prefillTok': return tokCell(m.pair('prefill_2k'));
      case 'streamsTok': return tokCell(m.pair('streams4'));
      case 'decodeScore': return ratioCell(m.decodeScore);
      case 'prefillScore': return ratioCell(m.prefillScore);
      case 'streamsScore': return ratioCell(m.streamsScore);
      case 'score': return `${ratioBar(m.score)}<b>${times(m.score)}</b>`;
    }
  }

  // Pager buttons: prev, page numbers, next, and the range shown.
  function pagerHtml(page, pages, from, to, total) {
    const btn = (p, label, cls = '') => `<button type="button" data-p="${p}" class="${cls}"${p < 0 || p >= pages ? ' disabled' : ''}>${label}</button>`;
    const nums = Array.from({ length: pages }, (_, i) => btn(i, i + 1, i === page ? 'on' : ''));
    return `${btn(page - 1, '← prev', 'step')}${nums.join('')}${btn(page + 1, 'next →', 'step')}<span class="pg-range">${from}–${to} of ${total}</span>`;
  }

  // Sortable leaderboard table. `onOpen(m)` is called when a row is chosen. With `pageSize`, rows are shown that many
  // at a time with a pager after the table.
  function mountTable(el, list, { onOpen, sortKey = 'score', onSort, pageSize } = {}) {
    let key = sortKey, dir = -1, rows = list, page = 0;
    let pager = null;
    if (pageSize) {
      pager = document.createElement('div');
      pager.className = 'pager';
      (el.closest('.tbl-wrap') || el).after(pager);
      pager.addEventListener('click', e => {
        const b = e.target.closest('button[data-p]');
        if (!b || b.disabled) return;
        page = +b.dataset.p;
        render();
        el.closest('.tbl-wrap').scrollIntoView({ block: 'nearest' });
      });
    }
    const render = () => {
      const col = COLUMNS.find(c => c.key === key);
      const sorted = [...rows].sort((a, b) => {
        const x = col.get(a), y = col.get(b);
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
      const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
      page = Math.min(page, pages - 1);
      const shown = pageSize ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted;
      el.innerHTML = `
        <thead><tr>${COLUMNS.map(c => `<th class="${c.cls}${c.key === key ? ' on' : ''}" data-k="${c.key}">${c.label}${c.key === key ? `<i class="arr">${dir < 0 ? '↓' : '↑'}</i>` : ''}</th>`).join('')}</tr></thead>
        <tbody>${shown.map(m => `<tr data-id="${esc(m.id)}" tabindex="0">${COLUMNS.map(c => `<td class="${c.cls}">${cell(c, m)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      if (!sorted.length) el.querySelector('tbody').innerHTML = `<tr class="empty"><td colspan="${COLUMNS.length}">no model matches · <a href="submit.html">port one →</a></td></tr>`;
      if (pager) {
        pager.hidden = pages < 2;
        pager.innerHTML = pagerHtml(page, pages, page * pageSize + 1, page * pageSize + shown.length, sorted.length);
      }
    };
    const sortBy = (k, d) => {
      if (k === key && d == null) dir = -dir;
      else { key = k; dir = d != null ? d : (COLUMNS.find(c => c.key === k).asc ? 1 : -1); }
      page = 0;
      render();
      if (onSort) onSort(key, dir);
    };
    el.addEventListener('click', e => {
      const th = e.target.closest('th');
      if (th) { sortBy(th.dataset.k); return; }
      const tr = e.target.closest('tr[data-id]');
      if (tr && onOpen) onOpen(models.find(m => m.id === tr.dataset.id));
    });
    el.addEventListener('keydown', e => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter' && onOpen) onOpen(models.find(m => m.id === tr.dataset.id));
    });
    render();
    return { update: l => { rows = l; page = 0; render(); }, sortBy };
  }

  // --- index-wide numbers ---
  function stats() {
    const all = models.flatMap(m => m.measured.map(x => ({ ...x, m })));
    const best = all.reduce((a, b) => (!a || b.speedup > a.speedup ? b : a), null);
    const gp = models.reduce((s, m) => s + m.gatesPass, 0), ga = models.reduce((s, m) => s + m.gatesApplicable, 0);
    return {
      models: models.length,
      orgs: new Set(models.map(m => m.org)).size,
      runs: all.length,
      wins: all.filter(x => x.speedup > 1.005).length,
      median: median(all.map(x => x.speedup)),
      best,
      bytes: models.reduce((s, m) => s + m.sizeBytes, 0),
      gatesPass: gp, gatesApplicable: ga,
      tools: models.filter(m => m.tools).length,
      vision: models.filter(m => m.vision).length,
      spec: models.filter(m => m.spec).length,
      verified: models.filter(m => m.verified).length,
      maxCtx: Math.max(...models.map(m => m.serve.context_tokens || 0)),
      generated: window.LOOM_DATA ? window.LOOM_DATA.generated : null,
    };
  }

  const quickstart = m => [
    `weaver serve huggingface://${m.repo}`,
    '',
    '# OpenAI-compatible, on :8080',
    `curl -s localhost:8080${m.service.endpoint} -H 'content-type: application/json' \\`,
    `  -d '{"messages":[{"role":"user","content":"hello"}]}'`,
  ].join('\n');

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
    }), { threshold: 0.05 });
    els.forEach(e => io.observe(e));
  }

  return {
    METRICS, METRIC, DECODE, PREFILL, FEATURES, FLAGS, GATES, models, stats, median, geomean,
    pct, times, num, gb, ctx, esc, hf, rk, href, niceStep, avatar,
    ratioBar, gateStrip, flags, sub, profile, curve, card, mountTable, quickstart, copyButtons, reveal,
  };
})();
