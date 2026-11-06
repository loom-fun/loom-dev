// Hero terminal: an illustrative replay of one /loom session, filled in with a real model's card data.

(() => {
  const body = document.getElementById('termBody');
  if (!body) return;
  const { models, esc, num, gb, ctx } = LOOM;
  const m = models.find(x => x.verified && x.performance.metrics.decode) || models[0];
  if (!m) return;

  const p = m.performance, met = p.metrics;
  const STAGES = ['port', 'qualify', 'optimize', 'finalize', 'publish'];
  const W = 50;
  const file = m.weights.checkpoint.file;
  const row = (label, k) => met[k] && met[k].loom != null
    ? `  ${label.padEnd(12)}<span class="num">${num(met[k].loom).padStart(7)}</span>   ${num(met[k].llamacpp).padStart(7)}  tok/s`
    : null;

  const SCRIPT = [
    { s: 'port', prompt: `/loom get ${m.baseRepo} working on loom-serve, optimize it, and report the performance relative to llamacpp rocm` },
    { s: 'port', note: 'skills: loom · loom-setup · loom-port-llm · loom-benchmark · loom-roofline' },
    { s: 'port', step: `probe ${file} header`, res: 'ok', dur: 700 },
    { s: 'port', note: `  formats supported · ${gb(m.sizeBytes)} · fits in gpu memory` },
    { s: 'port', step: 'generate kernels from llm_config.json', res: 'ok' },
    { s: 'port', step: `build ctx=${m.serve.context_tokens} rows=${m.serve.rows}`, res: 'ok', dur: 900 },
    { s: 'port', step: 'kernel unit tests', res: 'pass' },
    { s: 'port', step: 'smoke test through loom-serve', res: 'ok' },
    { s: 'qualify', step: `fetch llama.cpp rocm ${p.llamacpp_build || ''}`.trim(), res: 'ok' },
    { s: 'qualify', step: 'golden: greedy tokens + top-5 logprobs', res: 'ok', dur: 900 },
    { s: 'qualify', step: 'compare loom vs reference, token by token', res: 'pass' },
    { s: 'qualify', step: 'roofline: per-metric targets, budget', res: 'ok' },
    { s: 'optimize', note: '  loop: measure → ablate → change → verify' },
    { s: 'optimize', step: 'iteration · fast gates', res: 'pass', dur: 1000 },
    { s: 'optimize', step: 'iteration · fast gates', res: 'pass', dur: 1000 },
    { s: 'optimize', step: 'controller: rate of approach', res: 'stop' },
    { s: 'finalize', step: `full gates incl. ${ctx(m.serve.context_tokens)} needle`, res: `${m.gatesPass}/${m.gatesApplicable}`, dur: 1200 },
    { s: 'finalize', note: `  ${'metric'.padEnd(12)}${'loom'.padStart(7)}   ${'llama.cpp'.padStart(9)}` },
    ...['decode|decode', 'prefill 2k|prefill_2k', 'prefill 32k|prefill_32k', '4 streams|streams4']
      .map(x => x.split('|')).map(([l, k]) => row(l, k)).filter(Boolean).map(html => ({ s: 'finalize', raw: html })),
    { s: 'finalize', step: 'write report.html · info.json · README.md', res: 'ok' },
    { s: 'publish', shell: `hf upload <you>/${m.name.toLowerCase()}-loom PKG .` },
    { s: 'publish', note: '  tags: loom, loom-serve → listed on loom/dev' },
  ];

  const stageEl = document.getElementById('termStage');
  const setStage = cur => {
    const i = STAGES.indexOf(cur);
    stageEl.innerHTML = STAGES.map((s, j) => `<span class="${j === i ? 'on' : j < i ? 'done' : ''}">${j < i ? '✓' : j === i ? '▸' : '·'} ${s}</span>`).join('');
  };
  document.getElementById('termTitle').textContent = `~/models/${m.name.toLowerCase()} · agent session`;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, still ? 0 : ms));
  let run = 0;

  const line = html => {
    const d = document.createElement('div');
    d.className = 'term-line';
    d.innerHTML = html;
    body.appendChild(d);
    while (body.children.length > 40) body.removeChild(body.firstChild);
    return d;
  };
  const tag = s => `<span class="tag">${`[${s}]`.padEnd(11)}</span>`;

  async function type(d, prefix, text, id) {
    for (let i = 1; i <= text.length; i++) {
      if (id !== run) return;
      d.innerHTML = `${prefix}<span class="cmd">${esc(text.slice(0, i))}</span><span class="caret"></span>`;
      await sleep(14 + Math.random() * 22);
    }
    d.innerHTML = `${prefix}<span class="cmd">${esc(text)}</span>`;
  }

  async function play() {
    const id = ++run;
    body.innerHTML = '';
    for (const x of SCRIPT) {
      if (id !== run) return;
      setStage(x.s);
      if (x.prompt) {
        await type(line(''), '<span class="p">&gt; </span>', x.prompt, id);
        await sleep(500);
      } else if (x.shell) {
        line('');
        await type(line(''), '<span class="p">$ </span>', x.shell, id);
        await sleep(400);
      } else if (x.note) {
        line(`<span class="tnote">${esc(x.note)}</span>`);
        await sleep(260);
      } else if (x.raw) {
        line(x.raw);
        await sleep(160);
      } else {
        const text = x.step.length > W - 4 ? x.step.slice(0, W - 5) + '…' : x.step;
        const d = line('');
        const dots = Math.max(3, W - text.length);
        const dur = x.dur || 500;
        for (let k = 0; k <= dots; k += 2) {
          if (id !== run) return;
          d.innerHTML = `${tag(x.s)}${esc(text)} <span class="tag">${'.'.repeat(k)}</span>`;
          await sleep(dur / (dots / 2));
        }
        d.innerHTML = `${tag(x.s)}${esc(text)} <span class="tag">${'.'.repeat(dots)}</span> <span class="okk">${esc(x.res)}</span>`;
        await sleep(140);
      }
    }
    setStage('done');
    stageEl.innerHTML = STAGES.map(s => `<span class="done">✓ ${s}</span>`).join('');
    line('');
    line(`<span class="p">$ </span><span class="caret"></span>`);
    await sleep(9000);
    if (id === run) play();
  }

  document.getElementById('termReplay').addEventListener('click', play);
  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { play(); io.disconnect(); }
  });
  io.observe(body);
})();
