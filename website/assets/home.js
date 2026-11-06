// Home page: hero stats, decode race, marquee, podium and heatmap.

(() => {
  const { models, stats, pct, times, num, gb, ctx, esc, heat, gateChip, METRICS, FEATURES, HIGHLIGHT_FEATURES } = LOOM;
  const s = stats();
  const link = m => `models.html#${encodeURIComponent(m.id)}`;

  document.getElementById('heroPill').textContent = `${s.models} models woven so far · updated ${s.generated}`;
  document.getElementById('heroStats').innerHTML = [
    [s.models, 'models on Loom Dev'],
    [pct(s.bestSpeedup), 'best single-metric gain'],
    [`${s.wins}/${s.runs}`, 'workloads where Loom wins'],
    [s.verified, 'pass every gate'],
  ].map(([v, l]) => `<div class="hero-stat"><div class="v grad">${v}</div><div class="l">${l}</div></div>`).join('');

  // Marquee
  const items = models.map(m => {
    const cls = m.score >= 1.005 ? 'up' : m.score <= 0.995 ? 'down' : 'flat';
    return `<a class="marquee-item" href="${link(m)}">${esc(m.name)} <span class="mono muted" style="font-size:12px">${esc(m.quant)}</span><span class="badge ${cls}">${pct(m.score)}</span></a>`;
  }).join('');
  document.getElementById('marquee').innerHTML = items + items;

  // Podium: 2nd, 1st, 3rd
  const medals = ['🥇', '🥈', '🥉'];
  const top = models.slice(0, 3);
  const chipsFor = m => HIGHLIGHT_FEATURES.filter(f => m.features[f] === 'yes').slice(0, 4)
    .map(f => `<span class="chip"><span class="material-symbols-outlined">${FEATURES[f].icon}</span>${FEATURES[f].label}</span>`).join('');
  const podiumCard = (m, rank) => `
    <a class="podium-card card ${rank === 0 ? 'first' : ''}" href="${link(m)}">
      <span class="podium-rank">#${rank + 1}</span>
      <span class="podium-medal">${medals[rank]}</span>
      <div class="podium-name">${esc(m.name)}</div>
      <div class="podium-meta">${LOOM.sub(m)}</div>
      <div class="podium-score grad">${times(m.score)}</div>
      <div class="podium-score-l">overall vs llama.cpp · best ${pct(m.best.speedup)} on ${m.best.label.toLowerCase()} ${m.best.detail}</div>
      <div class="podium-chips">${gateChip(m)}${chipsFor(m)}</div>
    </a>`;
  document.getElementById('podium').innerHTML = [1, 0, 2].filter(i => top[i]).map(i => podiumCard(top[i], i)).join('');

  // Heatmap
  const head = `<thead><tr><th class="rowh">Model</th>${METRICS.map(m => `<th>${m.label}<small>${m.detail.replace(' document', '').replace(' context', ' ctx').replace('short prompt', 'short')}</small></th>`).join('')}<th>Overall</th></tr></thead>`;
  const body = models.map(m => {
    const cells = METRICS.map(k => {
      const v = m.performance.metrics[k.key];
      if (!v || v.speedup == null) return '<td class="na">—</td>';
      return `<td style="background:${heat(v.speedup)}" title="Loom ${num(v.loom)} vs llama.cpp ${num(v.llamacpp)} ${k.unit}">${pct(v.speedup)}</td>`;
    }).join('');
    return `<tr class="row" data-href="${link(m)}"><td class="name">${esc(m.name)}<small>${esc(m.quant)}</small></td>${cells}<td class="score" style="background:${heat(m.score)}">${times(m.score)}</td></tr>`;
  }).join('');
  const table = document.getElementById('heat');
  table.innerHTML = head + `<tbody>${body}</tbody>`;
  table.addEventListener('click', e => {
    const row = e.target.closest('tr.row');
    if (row) location.href = row.dataset.href;
  });

  // Decode race
  const PASSAGE = `A loom holds a set of lengthwise threads, the warp, under tension. The weaver lifts alternate warp threads to open a gap called the shed, then throws a shuttle carrying the weft through it. A comb-like reed beats the new weft line tight against the cloth. Then the shed flips, the other half of the warp rises, and the shuttle flies back the other way. Over, under, over, under: a few simple moves, repeated thousands of times, turn loose threads into fabric. The trick to weaving faster isn't new threads. It is fewer wasted motions, a lighter shuttle, and a rhythm that never stalls. Fast looms keep every part busy at once, so the cloth grows while the next pass is already on its way. Same threads, same pattern, more cloth per minute.`;
  const tokens = PASSAGE.match(/\S+\s*/g);
  const racers = models.filter(m => m.performance.metrics.decode && m.performance.metrics.decode.speedup != null)
    .sort((a, b) => b.performance.metrics.decode.speedup - a.performance.metrics.decode.speedup);
  const sel = document.getElementById('raceModel');
  sel.innerHTML = racers.map((m, i) => `<option value="${i}">${esc(m.name)} · ${esc(m.quant)}</option>`).join('');
  const el = id => document.getElementById(id);
  let raf = null, timer = null, manual = false;

  function run() {
    cancelAnimationFrame(raf); clearTimeout(timer);
    const m = racers[+sel.value];
    const d = m.performance.metrics.decode;
    el('loomRate').textContent = `${num(d.loom)} tok/s`;
    el('llamaRate').textContent = `${num(d.llamacpp)} tok/s`;
    el('raceVerdict').innerHTML = '&nbsp;';
    const lanes = [['loom', d.loom], ['llama', d.llamacpp]];
    const done = {};
    const t0 = performance.now();
    const tick = now => {
      const secs = (now - t0) / 1000;
      for (const [k, rate] of lanes) {
        const n = Math.min(tokens.length, Math.floor(secs * rate));
        el(`${k}Text`).innerHTML = esc(tokens.slice(0, n).join('')) + (n < tokens.length ? '<span class="caret"></span>' : '');
        el(`${k}Bar`).style.width = `${(n / tokens.length) * 100}%`;
        if (n >= tokens.length && !done[k]) done[k] = secs;
      }
      if (done.loom && done.llama) {
        const r = done.llama / done.loom;
        el('raceVerdict').innerHTML = r >= 1
          ? `<span class="grad">Loom finished ${r.toFixed(2)}× sooner</span>`
          : `llama.cpp finished ${(1 / r).toFixed(2)}× sooner`;
        if (!manual) timer = setTimeout(() => { sel.value = (+sel.value + 1) % racers.length; run(); }, 3500);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  sel.addEventListener('change', () => { manual = true; run(); });
  el('raceReplay').addEventListener('click', () => { manual = true; run(); });
  if (racers.length) {
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { run(); io.disconnect(); }
    });
    io.observe(el('race'));
  }

  LOOM.copyButtons();
  LOOM.reveal();
})();
