// Home page: index telemetry, leaderboard and linked charts.

(() => {
  const { models, stats, times, METRIC, median } = LOOM;
  const s = stats();
  const el = id => document.getElementById(id);
  const open = m => { location.href = LOOM.href(m); };

  el('ixKicker').textContent = `hrx-loom · 50+ models ready to serve · updated ${s.generated}`;
  el('ixCount').textContent = '50+';
  // Leaderboard
  el('podium').innerHTML = models.slice(0, 3).map(LOOM.card).join('');
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
  search();

  // Charts, hover-linked through #field
  el('strip').innerHTML = CHARTS.strip(models);
  const all = models.flatMap(m => m.measured);
  const groupLine = g => {
    const xs = all.filter(x => x.group === g);
    return `${g} ${xs.filter(x => x.speedup > 1.005).length}/${xs.length} faster, median ${times(median(xs.map(x => x.speedup)))}`;
  };
  el('stripMeta').textContent = `${s.runs} measurements · 50+ models`;
  el('stripLede').innerHTML += ` Across the index: ${['decode', 'prefill', 'streams'].map(groupLine).join('; ')}.`;

  const TABS = ['decode', 'decode_32k', 'prefill_2k', 'prefill_32k', 'streams4'];
  const tabs = el('scatterTabs');
  tabs.innerHTML = TABS.map((k, i) => `<button data-k="${k}" class="${i ? '' : 'on'}">${METRIC[k].short}</button>`).join('');
  const drawScatter = k => {
    el('scatter').innerHTML = CHARTS.scatter(models, k);
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  };
  tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) drawScatter(b.dataset.k); });
  drawScatter('decode');

  el('scalePrefill').innerHTML = CHARTS.scaling(models, 'prefill');
  el('scaleDecode').innerHTML = CHARTS.scaling(models, 'decode');
  const medAt = k => median(models.map(m => m.pair(k)).filter(Boolean).map(p => p.speedup));
  el('scalingLede').innerHTML += ` The median prefill speedup goes from ${times(medAt('prefill_1k'))} on a 1k document to ${times(medAt('prefill_32k'))} at 32k, and decode from ${times(medAt('decode'))} on a short prompt to ${times(medAt('decode_32k'))} at 32k context.`;

  CHARTS.link(el('field'), el('readout'));

  LOOM.copyButtons();
})();
