// Index-wide SVG charts. Every mark carries data-id (and data-k for a metric) so hovering a model
// highlights it across all charts and fills the shared readout.

const CHARTS = (() => {
  const { METRICS, METRIC, DECODE, PREFILL, FEATURES, GATES, models, median, times, num, gb, esc, niceStep } = LOOM;
  const LO = 0.45, HI = 2.1;
  const lg = Math.log;
  const ratioX = (r, a, b) => a + (lg(Math.max(LO, Math.min(HI, r))) - lg(LO)) / (lg(HI) - lg(LO)) * (b - a);
  const RATIO_TICKS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];
  const svg = (w, h, body, cls = '') => `<svg class="chart ${cls}" viewBox="0 0 ${w} ${h}" style="aspect-ratio:${w}/${h}">${body}</svg>`;
  const tk = r => r === 1 ? '1.00×' : `${r}×`;

  // Rows = workloads, dots = models, on a log ratio axis centred on parity.
  function strip(list) {
    const W = 1000, L = 210, R = 128, top = 34, rowH = 30, H = top + METRICS.length * rowH + 26;
    const X = r => ratioX(r, L, W - R);
    let b = `<rect x="${L}" y="${top - 6}" width="${(X(1) - L).toFixed(1)}" height="${METRICS.length * rowH + 4}" class="zone-lo"/>`;
    b += `<text x="${X(1) - 8}" y="${top - 14}" class="ax-t" text-anchor="end">← llama.cpp faster</text><text x="${X(1) + 8}" y="${top - 14}" class="ax-t">loom faster →</text>`;
    RATIO_TICKS.forEach(r => {
      b += `<line x1="${X(r)}" x2="${X(r)}" y1="${top - 6}" y2="${H - 22}" class="${r === 1 ? 'ax-par' : 'ax-grid'}"/>`;
      b += `<text x="${X(r)}" y="${H - 8}" class="ax-t" text-anchor="middle">${tk(r)}</text>`;
    });
    METRICS.forEach((x, i) => {
      const y = top + i * rowH + rowH / 2;
      const pts = list.map(m => [m, m.pair(x.key)]).filter(([, p]) => p);
      const rs = pts.map(([, p]) => p.speedup), med = median(rs);
      const wins = rs.filter(r => r > 1.005).length;
      if (i && METRICS[i - 1].group !== x.group) b += `<line x1="8" x2="${W - 8}" y1="${y - rowH / 2}" y2="${y - rowH / 2}" class="ax-sep"/>`;
      b += `<text x="8" y="${y + 4}" class="ax-l">${x.label}</text><text x="${L - 14}" y="${y + 4}" class="ax-t" text-anchor="end">${x.detail}</text>`;
      b += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="ax-row"/>`;
      if (med != null) b += `<line x1="${X(med)}" x2="${X(med)}" y1="${y - 10}" y2="${y + 10}" class="med"/>`;
      pts.forEach(([m, p]) => {
        const jy = y + ((m.rank % 5) - 2) * 3;
        b += `<rect x="${(X(p.speedup) - 3.5).toFixed(1)}" y="${(jy - 3.5).toFixed(1)}" width="7" height="7" class="pt ${p.speedup < 1 ? 'pt-lo' : ''}" data-id="${esc(m.id)}" data-k="${x.key}"/>`;
      });
      b += `<text x="${W - R + 16}" y="${y + 4}" class="ax-v">${med == null ? '—' : times(med)}</text><text x="${W - 8}" y="${y + 4}" class="ax-t" text-anchor="end">${wins}/${rs.length}</text>`;
    });
    b += `<text x="${W - R + 16}" y="${top - 14}" class="ax-t">median</text><text x="${W - 8}" y="${top - 14}" class="ax-t" text-anchor="end">wins</text>`;
    return svg(W, H, b, 'c-strip');
  }

  // Model size vs absolute throughput, both engines, log-log.
  function scatter(list, key) {
    const W = 1000, H = 430, L = 62, R = 170, T = 18, B = 40;
    const pts = list.map(m => [m, m.pair(key)]).filter(([, p]) => p);
    if (!pts.length) return svg(W, H, `<text x="${W / 2}" y="${H / 2}" class="ax-t" text-anchor="middle">not measured</text>`);
    const sz = pts.map(([m]) => m.sizeBytes / 1e9), tv = pts.flatMap(([, p]) => [p.loom, p.llamacpp]);
    const x0 = Math.min(...sz) / 1.5, x1 = Math.max(...sz) * 1.5, y0 = Math.min(...tv) / 1.5, y1 = Math.max(...tv) * 1.4;
    const X = v => L + (lg(v) - lg(x0)) / (lg(x1) - lg(x0)) * (W - L - R);
    const Y = v => T + (1 - (lg(v) - lg(y0)) / (lg(y1) - lg(y0))) * (H - T - B);
    let b = '';
    [0.5, 1, 2, 5, 10, 20, 50, 100].filter(v => v >= x0 && v <= x1).forEach(v => {
      b += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}" class="ax-grid"/><text x="${X(v)}" y="${H - B + 16}" class="ax-t" text-anchor="middle">${v} GB</text>`;
    });
    for (let e = Math.floor(Math.log10(y0)); e <= Math.ceil(Math.log10(y1)); e++) [1, 2, 5].forEach(f => {
      const v = f * Math.pow(10, e);
      if (v < y0 || v > y1) return;
      b += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="ax-grid"/><text x="${L - 8}" y="${Y(v) + 3}" class="ax-t" text-anchor="end">${v >= 1000 ? `${v / 1000}k` : v}</text>`;
    });
    b += `<text x="${L}" y="${H - 6}" class="ax-t">weights size →</text><text x="${L - 8}" y="${T - 6}" class="ax-t" text-anchor="end">tok/s</text>`;
    // Labels go to the first free spot around their point; ones with no room are left to the readout.
    const marks = pts.map(([m, p]) => ({ m, p, x: X(m.sizeBytes / 1e9), ya: Y(p.loom), yb: Y(p.llamacpp) }));
    const taken = marks.flatMap(k => [[k.x - 6, k.ya - 6, 12, 12, k.m], [k.x - 6, k.yb - 6, 12, 12, k.m], [k.x - 1, Math.min(k.ya, k.yb), 2, Math.abs(k.ya - k.yb), k.m]]);
    const hit = (a, c) => a[0] < c[0] + c[2] && c[0] < a[0] + a[2] && a[1] < c[1] + c[3] && c[1] < a[1] + a[3];
    marks.forEach(k => {
      b += `<g class="mk" data-id="${esc(k.m.id)}" data-k="${key}">
        <line x1="${k.x}" x2="${k.x}" y1="${k.ya}" y2="${k.yb}" class="sc-link ${k.p.speedup < 1 ? 'lo' : ''}"/>
        <circle cx="${k.x}" cy="${k.yb}" r="3.5" class="sc-ref"/>
        <rect x="${k.x - 4}" y="${k.ya - 4}" width="8" height="8" class="sc-loom"/></g>`;
    });
    [...marks].sort((a, c) => a.m.rank - c.m.rank).forEach(k => {
      const text = `${k.m.name} ${k.m.quant}`, w = text.length * 6.4 + 4;
      const spots = [[k.x + 9, k.ya + 4], [k.x - 9 - w, k.ya + 4], [k.x + 9, k.ya - 9], [k.x + 9, k.ya + 16], [k.x - 9 - w, k.ya - 9], [k.x - 9 - w, k.ya + 16]];
      const spot = spots.find(([tx, ty]) => {
        const box = [tx, ty - 10, w, 13];
        return tx >= L && tx + w <= W - 4 && ty - 10 >= T && ty <= H - B
          && !taken.some(t => t[4] !== k.m && hit(box, t)) && !taken.some(t => t[4] === 'label' && hit(box, t));
      });
      if (!spot) return;
      taken.push([spot[0], spot[1] - 10, w, 13, 'label']);
      b += `<text x="${spot[0].toFixed(1)}" y="${spot[1].toFixed(1)}" class="sc-lab" data-id="${esc(k.m.id)}">${esc(k.m.name)} <tspan class="faint">${esc(k.m.quant)}</tspan></text>`;
    });
    return svg(W, H, b, 'c-scatter');
  }

  // Speedup across context length for one metric group; one line per model plus the median.
  function scaling(list, group) {
    const xs = group === 'prefill' ? PREFILL : DECODE;
    const W = 480, H = 300, L = 46, R = 16, T = 16, B = 30;
    const X = i => L + i * (W - L - R) / (xs.length - 1);
    const Y = r => T + (1 - (lg(Math.max(LO, Math.min(HI, r))) - lg(LO)) / (lg(HI) - lg(LO))) * (H - T - B);
    let b = `<rect x="${L}" y="${Y(1)}" width="${W - L - R}" height="${(H - B - Y(1)).toFixed(1)}" class="zone-lo"/>`;
    RATIO_TICKS.forEach(r => { b += `<line x1="${L}" x2="${W - R}" y1="${Y(r)}" y2="${Y(r)}" class="${r === 1 ? 'ax-par' : 'ax-grid'}"/><text x="${L - 6}" y="${Y(r) + 3}" class="ax-t" text-anchor="end">${tk(r)}</text>`; });
    xs.forEach((x, i) => { b += `<text x="${X(i)}" y="${H - 10}" class="ax-t" text-anchor="middle">${x.x}</text>`; });
    list.forEach(m => {
      const pts = xs.map((x, i) => [i, m.pair(x.key)]).filter(([, p]) => p);
      if (pts.length < 2) return;
      b += `<g class="mk" data-id="${esc(m.id)}"><polyline points="${pts.map(([i, p]) => `${X(i).toFixed(1)},${Y(p.speedup).toFixed(1)}`).join(' ')}" class="sl"/>${pts.map(([i, p]) => `<rect x="${(X(i) - 2).toFixed(1)}" y="${(Y(p.speedup) - 2).toFixed(1)}" width="4" height="4" class="sl-d" data-id="${esc(m.id)}" data-k="${xs[i].key}"/>`).join('')}</g>`;
    });
    const meds = xs.map((x, i) => [i, median(list.map(m => m.pair(x.key)).filter(Boolean).map(p => p.speedup))]).filter(([, v]) => v != null);
    b += `<polyline points="${meds.map(([i, v]) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" class="sl-med"/>`;
    meds.forEach(([i, v]) => { b += `<text x="${X(i)}" y="${Y(v) - 8}" class="ax-v" text-anchor="middle">${v.toFixed(2)}</text>`; });
    return svg(W, H, b, 'c-scaling');
  }

  // Gates and features, one row per model.
  function coverage(list) {
    const gates = Object.keys(GATES), feats = Object.keys(FEATURES);
    const G = { pass: '■', fail: '■', unknown: '□', 'n/a': '·' };
    const head = `<tr><th class="cv-name">model</th>${gates.map(g => `<th title="${g}: ${esc(GATES[g][1])}"><span>${GATES[g][0]}</span></th>`).join('')}<th class="cv-gap"></th>${feats.map(f => `<th title="${FEATURES[f][1]}"><span>${FEATURES[f][0]}</span></th>`).join('')}<th class="cv-sum">gates</th><th class="cv-sum">feat</th></tr>`;
    const rows = list.map(m => {
      const fy = feats.filter(f => m.features[f] === 'yes').length;
      return `<tr data-id="${esc(m.id)}">
        <td class="cv-name">${LOOM.avatar(m)}<a href="${LOOM.href(m)}">${esc(m.name)}</a><small>${esc(m.quant)}</small></td>
        ${gates.map(g => { const s = m.gates.status[g] || 'n/a'; return `<td class="cv-${s.replace('/', '')}" title="${g}: ${s}">${G[s]}</td>`; }).join('')}
        <td class="cv-gap"></td>
        ${feats.map(f => { const y = m.features[f] === 'yes'; return `<td class="${y ? 'cv-y' : 'cv-n'}" title="${FEATURES[f][1]}: ${y ? 'yes' : 'no'}">${y ? '■' : '·'}</td>`; }).join('')}
        <td class="cv-sum">${m.gatesPass}/${m.gatesApplicable}</td><td class="cv-sum">${fy}/${feats.length}</td>
      </tr>`;
    }).join('');
    const colTotals = `<tr class="cv-tot"><td class="cv-name">pass / yes</td>${gates.map(g => {
      const app = list.filter(m => (m.gates.status[g] || 'n/a') !== 'n/a');
      return `<td>${app.length ? app.filter(m => m.gates.status[g] === 'pass').length : '·'}</td>`;
    }).join('')}<td class="cv-gap"></td>${feats.map(f => `<td>${list.filter(m => m.features[f] === 'yes').length}</td>`).join('')}<td></td><td></td></tr>`;
    return `<table class="cov"><thead>${head}</thead><tbody>${rows}${colTotals}</tbody></table>`;
  }

  // Hover linking across every chart under `root`.
  function link(root, readout) {
    const find = id => models.find(m => m.id === id);
    const describe = (m, k) => {
      const p = k ? m.pair(k) : null;
      const what = p ? `${METRIC[k].label} ${METRIC[k].detail}: <b>${num(p.loom)}</b> vs ${num(p.llamacpp)} tok/s · <b>${times(p.speedup)}</b>`
        : `overall <b>${times(m.score)}</b> · ${m.wins}/${m.measured.length} workloads faster`;
      return `<span class="ro-n">#${LOOM.rk(m)} ${esc(m.name)}</span> <span class="faint">${esc(m.quant)} · ${gb(m.sizeBytes)}</span> <span class="ro-sep">│</span> ${what}`;
    };
    const idle = readout ? readout.innerHTML : '';
    let cur = null;
    const set = (id, k) => {
      if (id === cur && !k) return;
      cur = id;
      root.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
      root.classList.toggle('hl-on', !!id);
      if (!id) { if (readout) readout.innerHTML = idle; return; }
      root.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(e => e.classList.add('hl'));
      const m = find(id);
      if (readout && m) readout.innerHTML = describe(m, k);
    };
    root.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-id]');
      if (!t || !root.contains(t)) return;
      const k = e.target.closest('[data-k]');
      set(t.dataset.id, k ? k.dataset.k : null);
    });
    root.addEventListener('mouseleave', () => set(null));
    root.addEventListener('click', e => {
      const t = e.target.closest('svg [data-id]');
      if (t) location.href = LOOM.href(find(t.dataset.id));
    });
  }

  return { strip, scatter, scaling, coverage, link };
})();
