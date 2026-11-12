// Shared navbar for every page, injected into .navbar-placeholder.

function createNavbar(active) {
  const link = (href, key, text) => `<a href="${href}" class="${active === key ? 'active' : ''}">${text}</a>`;
  const band = sessionStorage.getItem('loom-preview-dismissed') ? '' : `
    <div class="preview-band" id="previewBand" role="note"><span>Experimental developer preview. APIs, tooling, and model support are evolving and subject to change.</span><button class="pb-close" id="previewClose" aria-label="Dismiss">×</button></div>`;
  return `${band}
    <header class="nav" id="nav">
      <div class="nav-inner">
        <a class="wordmark" href="index.html" aria-label="HRX Loom home"><img src="assets/logo.svg" alt="">HRX Loom</a>
        <nav class="nav-links">
          ${link('index.html#leaderboard', 'home', 'Overview')}
          ${link('models.html', 'models', 'Ported Models')}
          ${link('submit.html', 'submit', 'Port yours')}
        </nav>
        <div class="nav-ext">
          <a href="https://github.com/ROCm/hrx-system" target="_blank" rel="noopener">loom ↗</a>
          <span class="sep">/</span>
          <a href="https://github.com/loom-fun/loom-skills" target="_blank" rel="noopener">loom-skills ↗</a>
          <span class="sep">/</span>
          <a href="https://huggingface.co/loom-fun" target="_blank" rel="noopener">hugging face ↗</a>
        </div>
        <button class="nav-toggle" id="navToggle" aria-expanded="false">menu</button>
      </div>
    </header>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const slot = document.querySelector('.navbar-placeholder');
  if (!slot) return;
  slot.outerHTML = createNavbar(document.body.dataset.page);
  const close = document.getElementById('previewClose');
  if (close) close.addEventListener('click', () => {
    document.getElementById('previewBand').remove();
    sessionStorage.setItem('loom-preview-dismissed', '1');
  });
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'close' : 'menu';
  });
});
