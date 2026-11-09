// Home page: index telemetry, leaderboard, linked charts and the weaver pipeline stepper.

(() => {
  const { models, stats, times, METRIC, median } = LOOM;
  const s = stats();
  const el = id => document.getElementById(id);
  const open = m => { location.href = LOOM.href(m); };

  el('ixKicker').textContent = `community index · ${s.models} ports · updated ${s.generated}`;
  el('ixCount').textContent = s.models;
  // Leaderboard
  el('podium').innerHTML = models.slice(0, 3).map(LOOM.card).join('');
  LOOM.mountTable(el('board'), models, { onOpen: open, pageSize: 20 });

  // Charts, hover-linked through #field
  el('strip').innerHTML = CHARTS.strip(models);
  const all = models.flatMap(m => m.measured);
  const groupLine = g => {
    const xs = all.filter(x => x.group === g);
    return `${g} ${xs.filter(x => x.speedup > 1.005).length}/${xs.length} faster, median ${times(median(xs.map(x => x.speedup)))}`;
  };
  el('stripMeta').textContent = `${s.runs} measurements · ${s.models} models`;
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

  el('coverage').innerHTML = CHARTS.coverage(models);
  CHARTS.link(el('field'), el('readout'));

  // Pipeline stepper
  const STAGES = [
    {
      t: 'checkpoint', d: 'any hf gguf',
      h: 'Start from a GGUF on Hugging Face',
      p: 'The input is an unmodified GGUF, the same file llama.cpp would load. Nothing is retrained or re-quantized.',
      items: [
        'A checkpoint is <code>huggingface://org/repo[:file.gguf]</code>, <code>org/repo</code> or a huggingface.co URL.',
        'By default weaver picks plain Q4_K_M from your Hugging Face cache.',
        'Speculative decoding is on whenever the GGUF supports it. <code>--no-spec</code> turns it off.',
        'The model\'s memory budget is what\'s left after the local agent\'s reservation (about 42 GiB).',
      ],
      runs: 'weaver port &lt;org&gt;/&lt;model&gt;', time: 'one command', files: ['*.gguf (header probed first)', 'a GPU memory budget for the model'],
    },
    {
      t: 'port', d: '~1 min',
      h: 'Port: GGUF in, Loom package out',
      p: 'A config-driven starter kit turns the GGUF into Loom programs at the model\'s native context length.',
      items: [
        'Header-only probe: are the tensor formats supported, and does it fit in the budget?',
        'Generate the kernels and build the package at the native context.',
        'Kernel unit tests, then a smoke test through <code>loom-serve</code>. Chat glue comes from the model\'s Jinja template.',
        'For an architecture the starter doesn\'t cover, the agent follows <code>loom-port-llm</code> for that stage only, then resumes the build.',
      ],
      runs: 'loom-port-llm/port.sh', time: '≈ 1 min (starter-covered)', files: ['program/*.loom', 'model.json · model.json.lock', 'llm_config.json · tokenizer.json'],
    },
    {
      t: 'qualify', d: '~10 min',
      h: 'Qualify: set the reference and the baselines',
      p: 'Before anything is optimized, the agent sets what "correct" and "fast" mean for this model on this machine.',
      items: [
        'Fetch the llama.cpp ROCm reference and record its golden outputs on the same GGUF.',
        'Pick the speculative-decoding method by measured speed.',
        'Run the quick gates and measure both engines\' baselines.',
        'Roofline analysis: per-workload ceilings for decode, prefill and 4 streams.',
      ],
      runs: 'loom-benchmark/scripts/qualify.sh', time: '≈ 10 min', files: ['golden.json · compare.json', 'baseline perf, both engines', 'roofline targets'],
    },
    {
      t: 'optimize', d: 'budgeted',
      h: 'Optimize without breaking correctness',
      p: '<code>weaver port</code> skips this step. <code>weaver optimize</code> ports first if needed, then runs a measure, change and verify loop against a target, within a time budget.',
      items: [
        'TARGET is <code>roofline</code> (the default), <code>beat-llamacpp</code> or something like <code>decode+30%</code>.',
        'BUDGET is something like <code>90m</code> or <code>3h</code>.',
        'After each kept change: rebuild, restart, measure, fast gates. A speedup that breaks output is rolled back.',
        'The controller prints CONTINUE, REVIEW, BUDGET or DONE. At BUDGET the agent reverts to the last kept build.',
      ],
      runs: 'weaver optimize &lt;ckpt&gt; [target] [budget]', time: 'your budget', files: ['perf_log.jsonl', 'kept changes only'],
    },
    {
      t: 'finalize', d: 'gates + audit',
      h: 'Finalize: full gates, final numbers, audit',
      p: 'The final build goes through the full gate suite and gets measured one more time. weaver only reports success when the gates and the audit pass.',
      items: [
        'Full gates, including needle-in-a-haystack at the full context.',
        'Final performance for both engines: same GGUF, same session.',
        'An audit of what was optimized, what was skipped and why. It must PASS.',
        'A report generated from the logs, which the model card is written from.',
      ],
      runs: 'loom-benchmark/scripts/finalize.sh', time: 'reserved in the budget', files: ['gates.json', 'report.md', 'raw logs'],
    },
    {
      t: 'publish', d: 'weaver upload',
      h: 'Publish: package and card, after a preview',
      p: 'The package goes to your Hugging Face org. The GGUF isn\'t copied; it stays in its original repo.',
      items: [
        'Stages the programs, a <code>model.json</code> that points at the upstream GGUF, and <code>model.json.lock</code>.',
        'The agent writes the card from the benchmark report, and every number on it must come from that report.',
        'weaver shows a preview and asks before it publishes anything.',
        'Anyone can then run <code>weaver serve huggingface://&lt;you&gt;/&lt;repo&gt;</code>. Cards tagged <code>loom</code> show up here.',
      ],
      runs: 'weaver upload &lt;ckpt&gt; &lt;hf-org&gt;', time: 'seconds', files: ['README.md (model card)', 'model.json · model.json.lock', '<a href="submit.html">publishing guide →</a>'],
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
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && auto) { t0 = performance.now(); timer = requestAnimationFrame(tick); }
      else cancelAnimationFrame(timer);
    }, { threshold: 0.3 });
    io.observe(pipe);
  }

  LOOM.copyButtons();
})();
