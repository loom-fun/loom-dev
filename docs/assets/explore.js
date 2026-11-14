// Models page: card grid, table, per-workload matrix and gates grid, with a detail drawer routed by the URL hash.

(() => {
  const { models, METRICS, FEATURES, GATES, times, num, gb, ctx, esc, hf, quickstart } = LOOM;
  const el = id => document.getElementById(id);
  const state = { q: '', filters: new Set(), view: 'cards', sort: 'score' };
  let list = models;

  const SORTS = {
    score: m => m.score || 0,
    decodeScore: m => m.decodeScore || 0,
    prefillScore: m => m.prefillScore || 0,
    streamsScore: m => m.streamsScore || 0,
    decodeTok: m => m.decodeTok || 0,
    prefillTok: m => m.prefillTok || 0,
    sizeBytes: m => m.sizeBytes,
    ctx: m => m.serve.context_tokens || 0,
    date: m => Date.parse(m.bench.date) || 0,
  };

  const s = LOOM.stats();
  el('headLede').textContent = `50+ ports from ${s.orgs} source orgs, ${s.runs} measurements, ${s.gatesPass}/${s.gatesApplicable} gates passing. Open a model for every workload against llama.cpp ROCm on the same GGUF, its serving configuration, weights, gates and provenance.`;

  const open = m => { location.hash = encodeURIComponent(m.id); };
  const table = LOOM.mountTable(el('tbl'), models, { onOpen: open, pageSize: 20 });

  function filtered() {
    const q = state.q.toLowerCase();
    return models
      .filter(m => !q || [m.name, m.checkpoint, m.quant, m.repo, m.baseRepo].join(' ').toLowerCase().includes(q))
      .filter(m => [...state.filters].every(f => m[f]))
      .sort((a, b) => SORTS[state.sort](b) - SORTS[state.sort](a));
  }

  function shade(r) {
    if (r == null) return { cls: 'na', style: '' };
    if (r < 1) return { cls: 'lo', style: '' };
    const a = 0.05 + Math.min(1, (r - 1) / 0.8) * 0.6;
    return { cls: '', style: `background:rgba(255,255,255,${a.toFixed(3)});color:${a > 0.36 ? '#0a0a0a' : 'var(--hi)'}` };
  }

  function matrix(rows) {
    const cellOf = (r, title) => { const sh = shade(r); return `<td class="${sh.cls}" style="${sh.style}" title="${title}">${r == null ? '—' : r.toFixed(2)}</td>`; };
    el('matrix').innerHTML = `
      <thead><tr><th>model</th>${METRICS.map(x => `<th>${x.short}</th>`).join('')}<th>dec ×</th><th>pre ×</th><th>overall</th></tr></thead>
      <tbody>${rows.map(m => `
        <tr>
          <td class="mname" data-id="${esc(m.id)}">${LOOM.avatar(m)}${esc(m.name)}<small>${esc(m.quant)}</small></td>
          ${METRICS.map(x => { const p = m.pair(x.key); return cellOf(p && p.speedup, p ? `loom ${num(p.loom)} · llama.cpp ${num(p.llamacpp)} tok/s` : 'not measured'); }).join('')}
          ${cellOf(m.decodeScore, 'decode geomean')}${cellOf(m.prefillScore, 'prefill geomean')}${cellOf(m.score, 'overall geomean')}
        </tr>`).join('')}
      </tbody>`;
  }

  function render() {
    list = filtered();
    el('count').textContent = `${list.length}/${models.length} models · sorted by ${el('sort').selectedOptions[0].textContent}${state.filters.size ? ` · ${[...state.filters].join(' + ')}` : ''}`;
    el('grid').innerHTML = list.length ? list.map(LOOM.card).join('') : `<div class="empty">no model matches · <a class="u" href="submit.html">port one →</a></div>`;
    table.update(list);
    matrix(list);
    el('coverage').innerHTML = CHARTS.coverage(list);
  }

  // --- drawer ---
  function bars(m) {
    const head = '<div class="mrow mhead"><span>workload</span><span><i class="sw loom"></i>loom <i class="sw ref"></i>llama.cpp</span><span>tok/s</span><span>Δ tok/s</span><span>ratio</span></div>';
    return head + METRICS.map(x => {
      const p = m.pair(x.key);
      const detail = x.detail.replace(' document', '').replace(' context', ' ctx').replace('short prompt', 'short').replace('aggregate decode', 'agg');
      if (!p) return `<div class="mrow na"><span class="ml">${x.label} <small>${detail}</small></span><span class="faint">${(m.performance.not_applicable || []).includes(x.key) ? 'not applicable' : 'not measured'}</span><span></span><span></span><span class="mr">—</span></div>`;
      const max = Math.max(p.loom, p.llamacpp), d = p.loom - p.llamacpp;
      return `
        <div class="mrow">
          <span class="ml">${x.label} <small>${detail}</small></span>
          <span class="mt"><i class="loom" style="width:${(p.loom / max * 100).toFixed(1)}%"></i><i class="ref" style="width:${(p.llamacpp / max * 100).toFixed(1)}%"></i></span>
          <span class="mv">${num(p.loom)}<small>${num(p.llamacpp)}</small></span>
          <span class="md ${d < 0 ? 'lo' : ''}">${d >= 0 ? '+' : '−'}${num(Math.abs(d))}</span>
          <span class="mr ${p.speedup < 1 ? 'lo' : ''}">${times(p.speedup)}</span>
        </div>`;
    }).join('');
  }

  const kvList = rows => `<div class="kvl">${rows.filter(Boolean).map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;
  const short = h => h ? `<span title="${esc(h)}">${esc(h.slice(0, 12))}…</span>` : '<span class="faint">—</span>';

  // loom-card/3 summaries: the top-level numbers are the primary GPU's; the other GPUs sit under m.devices.
  const GPU_NAME = { 'strix-halo': 'Strix Halo', 'radeon-r9700': 'Radeon AI PRO R9700' };
  function otherGpus(m) {
    const devs = Object.entries(m.devices || {});
    if (!devs.length) return '';
    const rows = devs.map(([g, d]) => {
      const name = GPU_NAME[g] || g;
      if (!d.performance) return [name, `<span class="faint">${esc((d.state || 'not measured').replace(/_/g, ' '))}</span>`];
      const mm = LOOM.bench(d.performance).metrics, t = k => (mm[k] || {}).loom, sp = k => (mm[k] || {}).speedup;
      const cell = (label, k) => t(k) != null ? `${label} ${num(t(k))} tok/s${sp(k) != null ? ` (${times(sp(k))})` : ''}` : null;
      const gs = d.gates.summary;
      return [name, [cell('decode', 'decode'), cell('prefill 2k', 'prefill_2k'), cell('4 streams', 'streams4'), `gates ${gs.pass}/${gs.pass + gs.fail + gs.unknown}`].filter(Boolean).join(' · ')];
    });
    const primary = GPU_NAME[m.primary_device] || m.primary_device;
    return `<h3>other GPUs</h3><p class="fine">The numbers above are from ${esc(primary)}.</p>${kvList(rows)}`;
  }

  function drawer(m) {
    const p = m.performance, src = m.bench.source, w = m.weights, sv = m.serve;
    const drafting = p.drafting.loom
      ? `loom: ${esc(p.drafting.loom)} · llama.cpp: ${esc(p.drafting.llamacpp)}`
      : 'off on both engines';
    const LABEL = { pass: 'pass', fail: 'fail', unknown: '----', 'n/a': 'n/a' };
    const weight = (k, x) => x ? [
      [k, `<a class="u" href="${hf(x.repo)}" target="_blank" rel="noopener">${esc(x.repo)}</a>`],
      ['├ file', esc(x.file)],
      x.quant ? ['├ quant', esc(x.quant)] : null,
      x.size ? ['├ size', `${gb(x.size)} · ${x.size.toLocaleString('en-US')} B`] : null,
      x.revision ? ['├ revision', short(x.revision)] : null,
      x.sha256 ? ['├ sha256', short(x.sha256)] : null,
    ] : [[k, '<span class="faint">none</span>']];

    el('drPath').textContent = `models / ${m.id}`;
    el('dr').innerHTML = `
      <span class="label">#${LOOM.rk(m)} of ${models.length} · ${esc(m.service.kind)} · from <a class="u" href="${hf(m.baseRepo)}" target="_blank" rel="noopener">${esc(m.baseRepo)}</a></span>
      <h2 class="dr-title" style="margin-top:10px">${LOOM.avatar(m, 'av-xl')}${esc(m.name)}</h2>
      <div class="meta">${LOOM.sub(m)} · ${sv.rows || '—'} rows</div>
      <div class="dr-marks"><span class="flags">${LOOM.flags(m)}</span><span class="strip">${LOOM.gateStrip(m)}</span><span class="faint">${m.gatesPass}/${m.gatesApplicable} gates</span>${LOOM.profile(m, { w: 120, h: 28 })}</div>

      <div class="kv-grid">
        <div><b class="${m.score < 1 ? 'lo' : ''}">${times(m.score)}</b><span>overall</span></div>
        <div><b class="${m.decodeScore < 1 ? 'lo' : ''}">${times(m.decodeScore)}</b><span>decode</span></div>
        <div><b class="${m.prefillScore < 1 ? 'lo' : ''}">${times(m.prefillScore)}</b><span>prefill</span></div>
        <div><b class="${m.streamsScore < 1 ? 'lo' : ''}">${times(m.streamsScore)}</b><span>4 streams</span></div>
        <div><b>${m.decodeTok ? num(m.decodeTok) : '—'}</b><span>decode tok/s</span></div>
        <div><b>${m.prefillTok ? num(m.prefillTok) : '—'}</b><span>prefill 2k tok/s</span></div>
        <div><b>${m.streamsTok ? num(m.streamsTok) : '—'}</b><span>4 streams tok/s</span></div>
        <div><b>${m.wins}/${m.measured.length}</b><span>workloads faster</span></div>
      </div>

      <h3>prefill · tok/s by document length</h3>
      <div class="chart-box" id="drPrefill"></div>
      <h3>decode · tok/s by context length</h3>
      <div class="chart-box" id="drDecode"></div>
      <div class="tbl-legend"><span><i class="sw loom"></i>loom <i class="sw ref"></i>llama.cpp rocm ${esc(p.llamacpp_build || '')}</span></div>

      <h3>every workload</h3>
      <div class="mbars">${bars(m)}</div>

      <h3>run it</h3>
      <div class="code">
        <div class="code-head"><span>shell</span><button class="copy" data-copy>copy</button></div>
        <pre><code>${esc(quickstart(m))}</code></pre>
      </div>
      <p class="fine"><code>hrx-loom</code> is the Loom SDK from <a class="u" href="https://github.com/ROCm/hrx-system" target="_blank" rel="noopener">ROCm/hrx-system</a>. <code>loom-fetch</code> pulls the GGUF from its original repo, and <code>loom-serve</code> listens on <code>:8080</code>. For a browser playground, ask an agent with <a class="u" href="https://github.com/loom-fun/loom-skills" target="_blank" rel="noopener">loom-skills</a> to start the Loom demo UI.</p>

      <div class="dr-cols">
        <div><h3>serving</h3>${kvList([
          ['endpoint', `<code>${esc(m.service.endpoint)}</code>`],
          ['kind', esc(m.service.kind)],
          ['device', esc(sv.device)],
          ['memory budget', sv.memory_bytes ? gb(sv.memory_bytes) : '<span class="faint">not recorded</span>'],
          ['context', sv.context_tokens ? `${sv.context_tokens.toLocaleString('en-US')} tok` : '—'],
          ['rows', sv.rows || '—'],
          ['max tokens', sv.max_tokens ? sv.max_tokens.toLocaleString('en-US') : '—'],
        ])}</div>
        <div><h3>provenance</h3>${kvList([
          ['measured', esc(m.bench.date)],
          ['reference', `llama.cpp rocm ${esc(p.llamacpp_build || '—')}`],
          ['drafting', drafting],
          ['source', src ? (src.url ? `<a class="u" href="${esc(src.url)}" target="_blank" rel="noopener">${src.kind === 'factory' ? 'factory run' : esc(src.kind)} ${esc(src.run || '')} ↗</a>` : `${esc(src.kind)} run`) : '—'],
          ['package', `<a class="u" href="${hf(m.repo)}" target="_blank" rel="noopener">${esc(m.repo)}</a>`],
          ['revision', short(m.revision)],
        ])}</div>
      </div>

      ${otherGpus(m)}

      <h3>weights</h3>
      ${kvList([...weight('checkpoint', w.checkpoint), ...weight('drafter', w.drafter), ...weight('projector', w.projector)])}

      <h3>features · ${Object.keys(FEATURES).filter(f => m.features[f] === 'yes').length}/${Object.keys(FEATURES).length}</h3>
      <div class="feat-list">${Object.keys(FEATURES).filter(f => f in m.features).map(f => {
        const on = m.features[f] === 'yes';
        return `<div><span class="${on ? 'y' : 'n'}">${FEATURES[f][1]}</span><span class="${on ? 'y' : 'n'}">${on ? 'yes' : 'no'}</span></div>`;
      }).join('')}</div>

      <h3>correctness gates · ${m.gatesPass}/${m.gatesApplicable}</h3>
      <div class="gate-list">${Object.entries(m.gates.status).map(([g, st]) => `
        <div class="gate-row ${st === 'n/a' ? 'na' : st}"><span class="st">[${LABEL[st]}]</span><code>${g}</code><span>${esc((GATES[g] || [])[1] || '')}</span></div>`).join('')}
      </div>

      <div class="links">
        <a class="btn solid" href="${hf(m.repo)}" target="_blank" rel="noopener">model card ↗</a>
        <a class="btn" href="${hf(m.baseRepo)}" target="_blank" rel="noopener">source gguf ↗</a>
        ${src && src.url ? `<a class="btn" href="${esc(src.url)}" target="_blank" rel="noopener">benchmark run ↗</a>` : ''}
      </div>`;
    LOOM.fit(el('drPrefill'), 640, w => LOOM.curve(m, 'prefill', { w, h: 190, axes: true }), 600);
    LOOM.fit(el('drDecode'), 640, w => LOOM.curve(m, 'decode', { w, h: 150, axes: true }), 600);
    LOOM.copyButtons(el('dr'));
  }

  let current = null;
  function show(id) {
    const m = models.find(x => x.id === id);
    if (!m) return;
    current = m;
    drawer(m);
    document.body.classList.add('open');
    el('drawer').setAttribute('aria-hidden', 'false');
    el('drawer').scrollTop = 0;
  }
  function close() {
    current = null;
    document.body.classList.remove('open');
    el('drawer').setAttribute('aria-hidden', 'true');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  const step = dir => {
    if (!current) return;
    const seq = list.length ? list : models;
    const i = seq.indexOf(current);
    open(seq[(i + dir + seq.length) % seq.length]);
  };
  const route = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    id ? show(id) : close();
  };

  el('q').addEventListener('input', e => { state.q = e.target.value; render(); });
  el('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  el('toggles').addEventListener('click', e => {
    const b = e.target.closest('.tg');
    if (!b) return;
    const f = b.dataset.f;
    state.filters.has(f) ? state.filters.delete(f) : state.filters.add(f);
    b.classList.toggle('on');
    render();
  });
  el('views').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.view = b.dataset.v;
    el('views').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    ['cards', 'table', 'matrix', 'gates'].forEach(v => { el(`view${v[0].toUpperCase()}${v.slice(1)}`).hidden = state.view !== v; });
  });
  el('grid').addEventListener('click', e => {
    const a = e.target.closest('.mcard');
    if (a) { e.preventDefault(); open(models.find(m => m.id === a.dataset.id)); }
  });
  el('matrix').addEventListener('click', e => {
    const td = e.target.closest('td.mname');
    if (td) open(models.find(m => m.id === td.dataset.id));
  });
  el('drawerBg').addEventListener('click', close);
  el('drClose').addEventListener('click', close);
  el('drPrev').addEventListener('click', () => step(-1));
  el('drNext').addEventListener('click', () => step(1));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (current && e.key === 'ArrowRight') step(1);
    if (current && e.key === 'ArrowLeft') step(-1);
  });
  window.addEventListener('hashchange', route);

  render();
  route();
})();
