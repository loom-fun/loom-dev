// Shared footer for every page, injected into .footer-placeholder.

document.addEventListener('DOMContentLoaded', () => {
  const slot = document.querySelector('.footer-placeholder');
  if (!slot) return;
  const generated = window.LOOM_DATA ? window.LOOM_DATA.generated : '';
  slot.outerHTML = `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a class="brand" href="index.html"><img src="assets/logo.svg" alt="" class="brand-mark" /><span class="brand-name">Loom<span class="brand-tag">Dev</span></span></a>
          <p>Community models ported, optimized and verified with loom-skills. Every number is measured against llama.cpp ROCm on the same GGUF.</p>
        </div>
        <div class="footer-cols">
          <div>
            <h4>Explore</h4>
            <a href="models.html">Explore models</a>
            <a href="index.html#leaderboard">Leaderboard</a>
            <a href="submit.html">Submit a model</a>
          </div>
          <div>
            <h4>Build</h4>
            <a href="https://github.com/loom-fun/loom-skills" target="_blank" rel="noopener">loom-skills</a>
            <a href="https://github.com/ROCm/hrx-system" target="_blank" rel="noopener">AMD Loom</a>
            <a href="https://pypi.org/project/hrx-loom/" target="_blank" rel="noopener">hrx-loom on PyPI</a>
          </div>
          <div>
            <h4>Friends</h4>
            <a href="https://huggingface.co/loom-fun" target="_blank" rel="noopener">loom-fun on Hugging Face</a>
            <a href="https://github.com/lemonade-sdk/llamacpp-rocm" target="_blank" rel="noopener">llama.cpp ROCm builds</a>
            <a href="https://lemonade-server.ai" target="_blank" rel="noopener">Lemonade</a>
          </div>
        </div>
      </div>
      <div class="footer-base">
        <span>Data refreshed ${generated}. Losses are shown too.</span>
        <span>Made with threads, kernels and a lot of tokens.</span>
      </div>
    </footer>`;
});
