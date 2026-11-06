// Models page: filterable table, per-metric matrix and a detail drawer routed by the URL hash.

(() => {
  const { models, METRICS, FEATURES, GATES, times, num, esc, hf, quickstart } = LOOM;
  const el = id => document.getElementById(id);
  const state = { q: '', filters: new Set(), view: 'table' };

  const open = m => { location.hash = encodeURIComponent(m.id); };
  const table = LOOM.mountTable(el('tbl'), models, { onOpen: open });

  function filtered() {
    const q = state.q.toLowerCase();
    return models
      .filter(m => !q || [m.name, m.checkpoint, m.quant, m.repo, m.baseRepo].join(' ').toLowerCase().includes(q))
      .filter(m => [...state.filters].every(f => m[f]));
  }

  function shade(r) {
    if (r == null) return { cls: 'na', style: '' };
    if (r < 1) return { cls: 'lo', style: '' };
    const t = Math.min(1, (r - 1) / 0.8);
    const a = 0.05 + t * 0.6;
    return { cls: '', style: `background:rgba(255,255,255,${a.toFixed(3)});color:${a > 0.36 ? '#0a0a0a' : 'var(--hi)'}` };
  }

  function matrix(list) {
    el('matrix').innerHTML = `
      <thead><tr><th>model</th>${METRICS.map(x => `<th>${x.short}</th>`).join('')}<th>geomean</th></tr></thead>
      <tbody>${list.map(m => `
        <tr>
          <td class="mname" data-id="${esc(m.id)}">${esc(m.name)}<small>${esc(m.quant)}</small></td>
          ${METRICS.map(x => {
            const v = m.performance.metrics[x.key];
            const r = v ? v.speedup : null;
            const s = shade(r);
            return `<td class="${s.cls}" style="${s.style}" title="${r == null ? 'not measured' : `loom ${num(v.loom)} · llama.cpp ${num(v.llamacpp)} tok/s`}">${r == null ? '—' : r.toFixed(2)}</td>`;
          }).join('')}
          ${(() => { const s = shade(m.score); return `<td class="${s.cls}" style="${s.style}">${times(m.score)}</td>`; })()}
        </tr>`).join('')}
      </tbody>`;
  }

  function render() {
    const list = filtered();
    el('count').textContent = `${list.length}/${models.length} models${state.filters.size ? ` · filters: ${[...state.filters].join(', ')}` : ''}`;
    table.update(list);
    matrix([...list].sort((a, b) => (b.score || 0) - (a.score || 0)));
  }

  // Drawer
  function bars(m) {
    const head = '<div class="mrow mhead"><span>metric</span><span><i class="sw loom"></i>loom <i class="sw ref"></i>llama.cpp</span><span>tok/s</span><span>ratio</span></div>';
    return head + m.measured.map(x => {
      const max = Math.max(x.loom, x.llamacpp);
      const detail = x.detail.replace(' document', '').replace(' context', ' ctx').replace('short prompt', 'short').replace('aggregate decode', 'agg');
      return `
        <div class="mrow">
          <span class="ml">${x.label} <small>${detail}</small></span>
          <span class="mt"><i class="loom" style="width:${(x.loom / max * 100).toFixed(1)}%"></i><i class="ref" style="width:${(x.llamacpp / max * 100).toFixed(1)}%"></i></span>
          <span class="mv">${num(x.loom)}<small>${num(x.llamacpp)}</small></span>
          <span class="mr ${x.speedup < 1 ? 'lo' : ''}">${times(x.speedup)}</span>
        </div>`;
    }).join('');
  }

  function drawer(m) {
    const p = m.performance, src = p.source;
    const drafting = p.drafting.loom
      ? `speculative decoding on for both engines (loom: ${esc(p.drafting.loom)}; llama.cpp: ${esc(p.drafting.llamacpp)}).`
      : 'speculative decoding off for both engines.';
    const na = METRICS.filter(x => !m.measured.find(y => y.key === x.key)).map(x => `${x.label} ${x.detail}`);
    const LABEL = { pass: 'pass', fail: 'fail', unknown: '----', 'n/a': 'n/a' };
    el('drPath').textContent = `models / ${m.id}`;
    el('dr').innerHTML = `
      <span class="label">#${String(m.rank).padStart(2, '0')} · ${esc(m.service.kind)} · from <a class="u" href="${hf(m.baseRepo)}" target="_blank" rel="noopener">${esc(m.baseRepo)}</a></span>
      <h2 style="margin-top:10px">${esc(m.name)}</h2>
      <div class="meta">${LOOM.sub(m)} · ${m.serve.rows || '—'} rows · ${esc(m.license || 'license not stated')}</div>
      <div class="kv-grid">
        <div><b>${times(m.score)}</b><span>geomean vs ref</span></div>
        <div><b>${m.decodeTok ? num(m.decodeTok) : '—'}</b><span>decode tok/s</span></div>
        <div><b>${m.prefillTok ? num(m.prefillTok) : '—'}</b><span>prefill 2k tok/s</span></div>
        <div><b>${m.gatesPass}/${m.gatesApplicable}</b><span>gates pass</span></div>
      </div>

      <h3>run it</h3>
      <div class="code">
        <div class="code-head"><span>shell</span><button class="copy" data-copy>copy</button></div>
        <pre><code>${esc(quickstart(m))}</code></pre>
      </div>
      <p class="fine">Serves OpenAI-style <code>${esc(m.service.endpoint)}</code> on <code>127.0.0.1:8080</code>.${m.serve.memory_bytes ? '' : ' Set <code>--memory_bytes</code> to your GPU memory budget; the model card lists the value it was tested with.'}</p>

      <h3>throughput · loom vs llama.cpp rocm ${esc(p.llamacpp_build || '')}</h3>
      <div class="mbars">${bars(m)}</div>
      <p class="fine">Same GGUF on both engines, tokens per second. ${drafting} Measured ${esc(p.date)}${src ? ` in a ${src.kind === 'factory' ? 'loom-factory CI run' : 'local run'}${src.url ? ` (<a href="${esc(src.url)}" target="_blank" rel="noopener">evidence</a>)` : ''}` : ''}.${na.length ? ` Not measured: ${na.join(', ')}.` : ''}</p>

      <h3>features</h3>
      <div class="feat-list">${Object.keys(FEATURES).filter(f => f in m.features).map(f => {
        const on = m.features[f] === 'yes';
        return `<div><span class="${on ? 'y' : 'n'}">${FEATURES[f]}</span><span class="${on ? 'y' : 'n'}">${on ? 'yes' : 'no'}</span></div>`;
      }).join('')}</div>

      <h3>correctness gates</h3>
      <div class="gate-list">${Object.entries(m.gates.status).map(([g, st]) => `
        <div class="gate-row ${st === 'n/a' ? 'na' : st}"><span class="st">[${LABEL[st]}]</span><code>${g}</code><span>${esc(GATES[g] || '')}</span></div>`).join('')}
      </div>

      <h3>weights</h3>
      <div class="bars">${[
        ['checkpoint', m.weights.checkpoint],
        ['drafter', m.weights.drafter],
        ['projector', m.weights.projector],
      ].map(([k, w]) => w ? `<span class="l">${k.padEnd(12)}</span>${esc(w.repo)} · ${esc(w.file)}` : `<span class="r">${k.padEnd(12)}none</span>`).join('\n')}</div>

      <div class="links">
        <a class="btn solid" href="${hf(m.repo)}" target="_blank" rel="noopener">model card ↗</a>
        <a class="btn" href="${hf(m.baseRepo)}" target="_blank" rel="noopener">source gguf ↗</a>
        ${src && src.url ? `<a class="btn" href="${esc(src.url)}" target="_blank" rel="noopener">benchmark run ↗</a>` : ''}
      </div>`;
    LOOM.copyButtons(el('dr'));
  }

  function show(id) {
    const m = models.find(x => x.id === id);
    if (!m) return;
    drawer(m);
    document.body.classList.add('open');
    el('drawer').setAttribute('aria-hidden', 'false');
    el('drawer').scrollTop = 0;
  }
  function close() {
    document.body.classList.remove('open');
    el('drawer').setAttribute('aria-hidden', 'true');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  const route = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    id ? show(id) : close();
  };

  el('q').addEventListener('input', e => { state.q = e.target.value; render(); });
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
    el('viewTable').hidden = state.view !== 'table';
    el('viewMatrix').hidden = state.view !== 'matrix';
  });
  el('matrix').addEventListener('click', e => {
    const td = e.target.closest('td.mname');
    if (td) open(models.find(m => m.id === td.dataset.id));
  });
  el('drawerBg').addEventListener('click', close);
  el('drClose').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('hashchange', route);

  render();
  route();
})();
