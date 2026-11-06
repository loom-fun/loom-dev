// Home page: telemetry strip, pipeline stepper, gate list and leaderboard.

(() => {
  const { models, stats, esc, ctx, GATES } = LOOM;
  const s = stats();
  const el = id => document.getElementById(id);

  el('telemetry').innerHTML = [
    [s.models, 'models indexed'],
    [s.orgs, 'source orgs'],
    [ctx(s.maxCtx), 'max context'],
    [s.verified, 'all gates pass'],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

  // Pipeline
  const STAGES = [
    {
      key: 'gguf', t: 'gguf', d: 'any hf repo',
      h: 'Start from a GGUF on Hugging Face',
      p: 'The input is an unmodified GGUF checkpoint, the same file llama.cpp would load. Nothing is retrained or re-quantized.',
      items: [
        'Dense transformers and Qwen3.5-style gated delta-net hybrids are covered by the starter kit.',
        'Vision projectors and speculative-decoding drafters are picked up when the model has them.',
        'Other architectures go through the hand-port playbook: llama.cpp\'s own compute graph via <code>llama_trace.py</code>, then numpy node-by-node checks.',
      ],
      runs: '/loom get &lt;org&gt;/&lt;model&gt; …', time: 'the prompt', files: ['&lt;org&gt;/&lt;model&gt;-GGUF', '*.gguf (header probed first)'],
    },
    {
      key: 'port', t: 'port', d: '~1 min',
      h: 'Port: GGUF in, Loom package out',
      p: 'A config-driven starter kit turns the GGUF into Loom programs at the model\'s native context length.',
      items: [
        'Header-only probe: are the tensor formats supported, and does it fit in GPU memory?',
        'Generate the kernels and build the package at the native context.',
        'Kernel unit tests against reference implementations, then a smoke test through <code>loom-serve</code>.',
        'Chat glue (tools, reasoning, history reuse) derived from the model\'s Jinja template.',
      ],
      runs: 'loom-port-llm/port.sh', time: '≈ 1 min (starter-covered)', files: ['program/*.loom', 'weights.loom', 'model.json · model.json.lock', 'llm_config.json', 'tokenizer.json'],
    },
    {
      key: 'qualify', t: 'qualify', d: '~10 min',
      h: 'Qualify: set the reference and the targets',
      p: 'Before optimizing anything, the agent establishes what "correct" and "fast enough" mean for this model on this machine.',
      items: [
        'Pick the fastest llama.cpp ROCm build for the GGUF and record its golden outputs.',
        'Run the correctness gates against that reference and measure both baselines.',
        'Roofline analysis from the GGUF: per-metric ceilings and targets for decode, prefill and 4 streams.',
        'Size the optimization budget from what\'s left of the roofline time budget.',
      ],
      runs: 'loom-benchmark/scripts/qualify.sh', time: '≈ 10 min', files: ['golden.json', 'compare.json', 'baseline perf', 'roofline targets + budget'],
    },
    {
      key: 'optimize', t: 'optimize', d: 'budgeted',
      h: 'Optimize without breaking correctness',
      p: 'A measure, ablate, change, verify loop, using a catalog of optimizations that worked (and ones that didn\'t).',
      items: [
        'Kernel A/B helper to compare variants under identical conditions.',
        'Fast gates after every kept change, so a speedup that breaks output is rolled back.',
        'A rate-of-approach controller decides to continue, pivot or stop.',
        'Add a time or a target to the prompt ("optimize it for 3 hours", "until decode is 50 % faster") to change the budget.',
      ],
      runs: 'loom-optimize · loom-roofline', time: 'what\'s left of the budget', files: ['perf_log.jsonl', 'kept changes'],
    },
    {
      key: 'finalize', t: 'finalize', d: 'gates + report',
      h: 'Finalize: full gates, final numbers, report',
      p: 'The final build goes through the full gate suite, including a full-context probe, and gets measured one more time.',
      items: [
        'Full gates, including needle-in-a-haystack at the full context.',
        'Final performance for both engines, same GGUF, same session.',
        'An audit of what was optimized, what was skipped and why.',
        'A single-page report generated from the logs, light and dark.',
      ],
      runs: 'loom-benchmark/scripts/finalize.sh', time: 'reserved in the budget', files: ['gates.json', 'report.html · report.md', 'raw logs kept next to it'],
    },
    {
      key: 'publish', t: 'publish', d: 'hf upload',
      h: 'Publish: a card generated from evidence',
      p: 'Every published card has the same sections and rows. Only the values differ, and every value points back to a run.',
      items: [
        '<code>make_info.py</code> turns the run outputs into evidence files and builds <code>info.json</code> (schema <code>loom-card/1</code>).',
        '<code>render_card.py</code> renders <code>README.md</code> from <code>info.json</code> alone.',
        'Upload with <code>hf upload</code>. The card carries the <code>loom</code> and <code>loom-serve</code> tags.',
        'Anyone can then <code>loom-fetch</code> it: the GGUF is pulled from its own repo and its sha256 checked.',
      ],
      runs: 'card/make_info.py · card/render_card.py', time: 'seconds', files: ['info.json', 'README.md', '<a href="submit.html">publishing guide →</a>'],
    },
  ];

  const pipe = el('pipe'), detail = el('stageDetail');
  pipe.innerHTML = STAGES.map((st, i) => `
    <button class="stage" data-i="${i}" role="tab">
      <span class="n">${String(i).padStart(2, '0')}</span>
      <span class="t">${st.t}</span>
      <span class="d">${st.d}</span>
      <span class="prog"><i></i></span>
    </button>`).join('');
  const btns = [...pipe.querySelectorAll('.stage')];
  let cur = 0, auto = true, timer = null, t0 = 0;
  const DWELL = 6500;

  function show(i) {
    cur = i;
    btns.forEach((b, j) => {
      b.classList.toggle('on', j === i);
      b.classList.toggle('done', j < i);
      b.setAttribute('aria-selected', j === i);
      b.querySelector('.prog i').style.width = j < i ? '100%' : '0';
    });
    const st = STAGES[i];
    detail.innerHTML = `
      <div class="sd-main">
        <span class="label">stage ${String(i).padStart(2, '0')} · ${st.t}</span>
        <h3>${st.h}</h3>
        <p>${st.p}</p>
        <ul class="sd-list">${st.items.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="sd-side">
        <div><span class="label">runs</span><span class="kv">${st.runs}</span></div>
        <div><span class="label">time</span><span class="kv">${st.time}</span></div>
        <div><span class="label">produces</span><ul class="files">${st.files.map(f => `<li>${f}</li>`).join('')}</ul></div>
      </div>`;
    t0 = performance.now();
  }

  function tick(now) {
    if (!auto) return;
    const f = Math.min(1, (now - t0) / DWELL);
    btns[cur].querySelector('.prog i').style.width = `${f * 100}%`;
    if (f >= 1) show((cur + 1) % STAGES.length);
    timer = requestAnimationFrame(tick);
  }

  pipe.addEventListener('click', e => {
    const b = e.target.closest('.stage');
    if (!b) return;
    auto = false;
    cancelAnimationFrame(timer);
    show(+b.dataset.i);
    btns[cur].querySelector('.prog i').style.width = '100%';
  });
  show(0);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still) {
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && auto) { t0 = performance.now(); timer = requestAnimationFrame(tick); }
      else cancelAnimationFrame(timer);
    }, { threshold: 0.3 });
    io.observe(pipe);
  }

  // Gate list, using a real model's results as the example
  const ex = models.find(m => m.verified) || models[0];
  if (ex) {
    el('gateExample').textContent = `example: ${ex.name} · ${ex.quant}`;
    const LABEL = { pass: 'pass', fail: 'fail', unknown: '----', 'n/a': 'n/a' };
    el('gateList').innerHTML = Object.entries(ex.gates.status).map(([g, st]) => `
      <div class="gate-row ${st === 'n/a' ? 'na' : st}">
        <span class="st">[${LABEL[st]}]</span><code>${g}</code><span>${esc(GATES[g] || '')}</span>
      </div>`).join('');
  }

  LOOM.mountTable(el('board'), models, { onOpen: m => { location.href = `models.html#${encodeURIComponent(m.id)}`; } });
  LOOM.copyButtons();
  LOOM.reveal();
})();
