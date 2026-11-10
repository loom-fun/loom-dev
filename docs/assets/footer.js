// Shared footer for every page, injected into .footer-placeholder.

document.addEventListener('DOMContentLoaded', () => {
  const slot = document.querySelector('.footer-placeholder');
  if (!slot) return;
  const generated = window.LOOM_DATA ? window.LOOM_DATA.generated : '';
  const count = window.LOOM_DATA ? window.LOOM_DATA.models.length : 0;
  slot.outerHTML = `
    <footer class="footer">
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <a class="wordmark" href="index.html"><img src="assets/logo.svg" alt="">HRX Loom</a>
            <p>Community GGUF ports to AMD Loom, built with loom-skills and checked against llama.cpp ROCm on the same weights.</p>
          </div>
          <div>
            <h5>site</h5>
            <a href="index.html#leaderboard">Overview</a>
            <a href="models.html">Ported Models</a>
            <a href="index.html#data">data</a>
            <a href="submit.html">Port yours</a>
          </div>
          <div>
            <h5>tools</h5>
            <a href="https://github.com/loom-fun/loom-skills" target="_blank" rel="noopener">loom-skills ↗</a>
            <a href="https://github.com/ROCm/hrx-system" target="_blank" rel="noopener">amd loom ↗</a>
            <a href="https://pypi.org/project/hrx-loom/" target="_blank" rel="noopener">hrx-loom on pypi ↗</a>
          </div>
          <div>
            <h5>reference</h5>
            <a href="https://github.com/lemonade-sdk/llamacpp-rocm" target="_blank" rel="noopener">llama.cpp rocm builds ↗</a>
            <a href="https://huggingface.co/loom-fun" target="_blank" rel="noopener">loom-fun on hf ↗</a>
            <a href="https://lemonade-server.ai" target="_blank" rel="noopener">lemonade ↗</a>
          </div>
        </div>
        <div class="footer-base">
          <span>index: ${count} models · generated ${generated}</span>
          <span>every number comes from a benchmark log</span>
        </div>
      </div>
    </footer>`;
});
