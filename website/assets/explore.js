// Explore page: filterable model grid and a detail drawer routed by the URL hash.

(() => {
  const { models, METRICS, FEATURES, HIGHLIGHT_FEATURES, GATES, pct, times, num, gb, ctx, esc, hf, quickstart } = LOOM;
  const state = { q: '', filters: new Set(), sort: 'score' };
  const el = id => document.getElementById(id);
  const badgeCls = x => x == null ? 'flat' : x >= 1.005 ? 'up' : x <= 0.995 ? 'down' : 'flat';
  const rank = new Map(models.map((m, i) => [m.id, i + 1]));

  const SORTS = {
    score: m => -(m.score || 0),
    decodeScore: m => -(m.decodeScore || 0),
    prefillScore: m => -(m.prefillScore || 0),
    streamsScore: m => -(m.streamsScore || 0),
    decodeAbs: m => -((m.performance.metrics.decode || {}).loom || 0),
    small: m => m.sizeBytes,
    large: m => -m.sizeBytes,
    newest: m => -Date.parse(m.performance.date),
  };

  // One row per group on a card: the headline metric if measured, else the first measured one.
  function headline(m) {
    return ['decode', 'prefill_2k', 'streams4'].map(key => {
      const group = LOOM.METRIC[key].group;
      return m.measured.find(x => x.key === key) || m.measured.find(x => x.group === group);
    }).filter(Boolean);
  }

  function pairRow(x, full) {
    const max = Math.max(x.loom, x.llamacpp);
    const right = full
      ? `<div class="pair-nums"><b>${num(x.loom)}</b> vs ${num(x.llamacpp)} tok/s<br><span class="badge ${badgeCls(x.speedup)}">${pct(x.speedup)}</span></div>`
      : `<span class="badge ${badgeCls(x.speedup)}">${pct(x.speedup)}</span>`;
    return `
      <div class="pair-row">
        <div class="pair-label">${x.label}<small>${x.detail}</small></div>
        <div class="pair-bars" title="Loom ${num(x.loom)} · llama.cpp ${num(x.llamacpp)} ${x.unit}">
          <div class="pair-bar loom" style="width:${(x.loom / max) * 100}%"></div>
          <div class="pair-bar llama" style="width:${(x.llamacpp / max) * 100}%"></div>
        </div>
        ${right}
      </div>`;
  }

  function chips(m, limit) {
    const out = [LOOM.gateChip(m)];
    HIGHLIGHT_FEATURES.filter(f => m.features[f] === 'yes').forEach(f =>
      out.push(`<span class="chip"><span class="material-symbols-outlined">${FEATURES[f].icon}</span>${FEATURES[f].label}</span>`));
    return out.slice(0, limit).join('');
  }

  const sub = LOOM.sub;

  function card(m) {
    return `
      <article class="model-card card" data-id="${esc(m.id)}" tabindex="0">
        <div class="mc-head">
          <div>
            <div class="mc-name">${esc(m.name)}</div>
            <div class="mc-sub">${sub(m)}</div>
          </div>
          <div class="mc-score"><div class="v ${m.score >= 1 ? 'grad' : ''}">${times(m.score)}</div><div class="l">overall</div></div>
        </div>
        <div class="mc-chips">${chips(m, 5)}</div>
        <div class="pairs">${headline(m).map(x => pairRow(x, false)).join('')}</div>
        <div class="pair-legend"><span><i style="background:var(--thread)"></i>Loom</span><span><i style="background:var(--llama)"></i>llama.cpp ROCm</span><span style="margin-left:auto" class="mono">#${rank.get(m.id)} · ${m.wins}/${m.measured.length} wins</span></div>
      </article>`;
  }

  function render() {
    const q = state.q.toLowerCase();
    const list = models
      .filter(m => !q || [m.name, m.checkpoint, m.quant, m.repo, m.baseRepo].join(' ').toLowerCase().includes(q))
      .filter(m => [...state.filters].every(f => m[f]))
      .sort((a, b) => SORTS[state.sort](a) - SORTS[state.sort](b));
    el('count').textContent = `${list.length} of ${models.length} models`;
    el('grid').innerHTML = list.length ? list.map(card).join('') : `
      <div class="empty" style="grid-column:1/-1">
        <span class="material-symbols-outlined">search_off</span>
        <p>No model matches yet. Maybe yours should be the first? <a class="grad" href="submit.html">Submit one</a>.</p>
      </div>`;
  }

  function drawer(m) {
    const p = m.performance;
    const kpi = (v, l) => `<div class="kpi"><div class="v ${v != null && v >= 1 ? 'grad' : ''}">${times(v)}</div><div class="l">${l}</div></div>`;
    const featureRows = Object.keys(FEATURES).filter(f => f in m.features).map(f => {
      const on = m.features[f] === 'yes';
      return `<div class="feat ${on ? '' : 'no'}"><span class="material-symbols-outlined">${on ? FEATURES[f].icon : 'block'}</span>${FEATURES[f].label}</div>`;
    }).join('');
    const ICON = { pass: 'check_circle', fail: 'cancel', unknown: 'help', 'n/a': 'remove' };
    const LABEL = { pass: 'pass', fail: 'fail', unknown: 'no evidence', 'n/a': 'not applicable' };
    const gates = Object.entries(m.gates.status).map(([g, st]) => `
      <div class="gate ${st === 'n/a' ? 'na' : st}">
        <span class="material-symbols-outlined">${ICON[st]}</span>
        <code>${g}</code>
        <span class="d">${LABEL[st]} · ${esc(GATES[g] || '')}</span>
      </div>`).join('');
    const src = p.source;
    const drafting = p.drafting.loom ? `Speculative decoding on both engines (Loom: ${esc(p.drafting.loom)}; llama.cpp: ${esc(p.drafting.llamacpp)}).` : 'Speculative decoding off on both engines.';
    const na = METRICS.filter(x => !m.measured.find(y => y.key === x.key)).map(x => `${x.label.toLowerCase()} ${x.detail}`);

    el('drawerBody').innerHTML = `
      <button class="drawer-close" id="drawerClose" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
      <span class="eyebrow">#${rank.get(m.id)} on Loom Dev · ${esc(m.service.kind)}</span>
      <h2>${esc(m.name)}</h2>
      <div class="mc-sub">${esc(m.quant)} · ${gb(m.sizeBytes)} · ${ctx(m.serve.context_tokens)} context · ${m.serve.rows || '—'} concurrent rows · ${esc(m.license || 'license not stated')}</div>
      <div class="mc-chips" style="margin-top:14px">${chips(m, 12)}</div>
      <div class="drawer-hero">
        ${kpi(m.score, 'overall')}${kpi(m.decodeScore, 'decode')}${kpi(m.prefillScore, 'prefill')}${kpi(m.streamsScore, '4 streams')}
      </div>

      <h3>Head to head with llama.cpp</h3>
      <div class="pairs">${m.measured.map(x => pairRow(x, true)).join('')}</div>
      <div class="pair-legend" style="margin-top:14px"><span><i style="background:var(--thread)"></i>Loom</span><span><i style="background:var(--llama)"></i>llama.cpp ROCm ${esc(p.llamacpp_build || '')}</span></div>
      <p class="fineprint">Same GGUF on both engines, tokens per second. ${drafting} Measured ${esc(p.date)}${src ? ` in a ${src.kind === 'factory' ? 'loom-factory CI run' : 'local run'}${src.url ? ` (<a href="${esc(src.url)}" target="_blank" rel="noopener">evidence</a>)` : ''}` : ''}.${na.length ? ` Not measured: ${na.join(', ')}.` : ''}</p>

      <h3>Run it</h3>
      <div class="code">
        <div class="code-head"><span class="dots"><i></i><i></i><i></i></span><button class="copy-btn" data-copy=""><span class="material-symbols-outlined">content_copy</span>Copy</button></div>
        <pre><code>${esc(quickstart(m))}</code></pre>
      </div>
      <p class="fineprint">The server answers OpenAI-style <code>${esc(m.service.endpoint)}</code> requests on <code>127.0.0.1:8080</code>.${m.serve.memory_bytes ? '' : ' Set <code>--memory_bytes</code> to your GPU memory budget; the model card has the value it was tested with.'}</p>

      <h3>Features</h3>
      <div class="feat-grid">${featureRows}</div>

      <h3>Correctness gates · ${m.gates.summary.pass}/${m.gatesApplicable} pass</h3>
      <div class="gates">${gates}</div>

      <div class="drawer-links">
        <a class="btn btn-primary btn-sm" href="${hf(m.repo)}" target="_blank" rel="noopener"><span class="hf-emoji">🤗</span>Model card</a>
        <a class="btn btn-sm" href="${hf(m.baseRepo)}" target="_blank" rel="noopener"><span class="material-symbols-outlined">deployed_code</span>Base GGUF</a>
        ${src && src.url ? `<a class="btn btn-sm" href="${esc(src.url)}" target="_blank" rel="noopener"><span class="material-symbols-outlined">receipt_long</span>Benchmark run</a>` : ''}
      </div>`;
    el('drawerClose').addEventListener('click', close);
    LOOM.copyButtons(el('drawerBody'));
  }

  function open(id) {
    const m = models.find(x => x.id === id);
    if (!m) return;
    drawer(m);
    document.body.classList.add('drawer-open');
    el('drawer').setAttribute('aria-hidden', 'false');
    el('drawer').scrollTop = 0;
  }
  function close() {
    document.body.classList.remove('drawer-open');
    el('drawer').setAttribute('aria-hidden', 'true');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  const route = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    id ? open(id) : close();
  };

  el('q').addEventListener('input', e => { state.q = e.target.value; render(); });
  el('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  el('filters').addEventListener('click', e => {
    const b = e.target.closest('.filter');
    if (!b) return;
    const f = b.dataset.filter;
    state.filters.has(f) ? state.filters.delete(f) : state.filters.add(f);
    b.classList.toggle('on');
    render();
  });
  el('grid').addEventListener('click', e => {
    const c = e.target.closest('.model-card');
    if (c) location.hash = encodeURIComponent(c.dataset.id);
  });
  el('grid').addEventListener('keydown', e => {
    const c = e.target.closest('.model-card');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = encodeURIComponent(c.dataset.id); }
  });
  el('backdrop').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('hashchange', route);

  render();
  route();
})();
