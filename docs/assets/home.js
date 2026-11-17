// Home page: index telemetry, leaderboard and linked charts. Everything that depends on the selected GPU is drawn by
// paint(), which runs again in place when the GPU toggle switches (LOOM's 'loom:gpu' event).

(() => {
  const { models, stats, times, METRIC, median } = LOOM;   // `models` is refilled in place on a GPU switch
  const el = id => document.getElementById(id);
  const open = m => { location.href = LOOM.href(m); };

  el('ixCount').textContent = '50+';

  // Leaderboard
  const board = LOOM.mountTable(el('board'), models, { onOpen: open, pageSize: 20 });
  const q = el('boardQ'), count = el('boardCount');
  const norm = s => s.toLowerCase().replace(/[\s_-]+/g, '');
  const search = () => {
    const terms = q.value.trim().split(/\s+/).filter(Boolean).map(norm);
    const hits = terms.length ? models.filter(m => terms.every(t => norm(m.name).includes(t))) : models;
    board.update(hits);
    count.textContent = terms.length ? `${hits.length} of ${models.length}` : `${models.length} models`;
  };
  q.addEventListener('input', search);
  q.addEventListener('keydown', e => { if (e.key === 'Escape') { q.value = ''; search(); q.blur(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    e.preventDefault();
    q.focus();
  });

  // Charts, hover-linked through #field. The fit() redraw functions close over `models`, so a forced redraw shows
  // the current GPU.
  const redrawStrip = CHARTS.mountStrip(el('strip'), models);
  const TABS = ['decode', 'decode_32k', 'prefill_2k', 'prefill_32k', 'streams4'];
  const tabs = el('scatterTabs');
  tabs.innerHTML = TABS.map((k, i) => `<button data-k="${k}" class="${i ? '' : 'on'}">${METRIC[k].short}</button>`).join('');
  let scatterKey = 'decode';
  const redrawScatter = LOOM.fit(el('scatter'), 1000, w => CHARTS.scatter(models, scatterKey, w));
  const drawScatter = k => {
    scatterKey = k;
    redrawScatter();
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  };
  tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) drawScatter(b.dataset.k); });
  const redrawPrefill = LOOM.fit(el('scalePrefill'), 480, w => CHARTS.scaling(models, 'prefill', w));
  const redrawDecode = LOOM.fit(el('scaleDecode'), 480, w => CHARTS.scaling(models, 'decode', w));
  CHARTS.link(el('field'), el('readout'));

  const stripLede = el('stripLede').innerHTML, scalingLede = el('scalingLede').innerHTML;
  const qs = LOOM.all.find(x => /\/unsloth-Qwen3-0\.6B-loom$/.test(x.repo));

  function paint(first) {
    const s = stats();
    // The hero's fetch command: the package and --preset for the selected GPU. Every GPU's version is laid out in
    // the same grid cell (only the selected one visible), so the hero keeps the height of the longest on a switch.
    if (qs) {
      const alts = f => `<span class="gpu-alts">${LOOM.GPUS.map(g => `<span class="gpu-alt${g.id === LOOM.GPU.id ? ' on' : ''}"><span class="p">$ </span><span class="s">${LOOM.esc(f(g).split(' ')[0])}</span>${LOOM.esc(f(g).slice(f(g).indexOf(' ')))}</span>`).join('')}</span>`;
      el('heroQuickstart').innerHTML = LOOM.quickstartHtml(qs);
      LOOM.copyButtons(el('heroQuickstart'));
      el('heroInstall').innerHTML = alts(g => LOOM.installCmd(qs, g));
      el('heroFetch').innerHTML = alts(g => LOOM.fetchCmd(qs, g));
      el('heroServe').innerHTML = alts(g => LOOM.serveCmd(qs, g));
    }
    el('gpuFoldR').innerHTML = `<span class="gpu-alts">${LOOM.GPUS.map(g => `<span class="gpu-alt${g.id === LOOM.GPU.id ? ' on' : ''}">${LOOM.esc([g.spec, `${g.models} models`].filter(Boolean).join(' · '))}</span>`).join('')}</span>`;
    el('ixKicker').textContent = `hrx-loom · 50+ models ready to serve · updated ${s.generated}`;
    el('podium').innerHTML = models.slice(0, 3).map(LOOM.card).join('');
    search();

    const all = models.flatMap(m => m.measured);
    const groupLine = g => {
      const xs = all.filter(x => x.group === g);
      return `${g} ${xs.filter(x => x.speedup > 1.005).length}/${xs.length} faster, median ${times(median(xs.map(x => x.speedup)))}`;
    };
    el('stripMeta').textContent = `${s.runs} measurements · 50+ models`;
    el('stripLede').innerHTML = `${stripLede} Across the index: ${['decode', 'prefill', 'streams'].map(groupLine).join('; ')}.`;
    const medAt = k => median(models.map(m => m.pair(k)).filter(Boolean).map(p => p.speedup));
    el('scalingLede').innerHTML = `${scalingLede} The median prefill speedup goes from ${times(medAt('prefill_1k'))} on a 1k document to ${times(medAt('prefill_32k'))} at 32k, and decode from ${times(medAt('decode'))} on a short prompt to ${times(medAt('decode_32k'))} at 32k context.`;
    if (!first) { redrawStrip(); redrawScatter(); redrawPrefill(); redrawDecode(); }
  }
  paint(true);
  document.addEventListener('loom:gpu', () => paint(false));
  document.addEventListener('loom:baseline', () => paint(false));

  LOOM.copyButtons();
})();
