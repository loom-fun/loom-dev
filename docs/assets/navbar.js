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
        <div class="nav-gpu" id="navGpu"></div>
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
  dockGpu(nav);
  const toggle = document.getElementById('navToggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'close' : 'menu';
  });
});

// The GPU toggle in the nav. On a page with an in-page toggle ([data-gpu-toggle], the home page's fold) it docks
// into the nav only once that toggle has scrolled up under the nav; on other pages it is always there.
function dockGpu(nav) {
  const slot = document.getElementById('navGpu');
  if (typeof LOOM === 'undefined' || LOOM.GPUS.length < 2) { slot.remove(); return; }
  slot.innerHTML = LOOM.gpuToggle({ compact: true });
  const fold = document.querySelector('[data-gpu-toggle]:not([hidden]) .gpu-tg');
  if (!fold) { nav.classList.add('gpu-docked'); return; }
  // A scroll check, not an IntersectionObserver: a jump past the fold (a restored scroll, a #link) must dock too.
  let queued = false;
  const check = () => { queued = false; nav.classList.toggle('gpu-docked', fold.getBoundingClientRect().bottom < nav.offsetHeight); };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  addEventListener('scroll', later, { passive: true });
  addEventListener('resize', later);
  check();
}
