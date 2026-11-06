// Shared navbar for every page, injected into .navbar-placeholder.

function createNavbar(active) {
  const link = (href, key, text) => `<a href="${href}" class="${active === key ? 'active' : ''}">${text}</a>`;
  return `
    <header class="nav" id="nav">
      <div class="nav-inner">
        <a class="wordmark" href="index.html" aria-label="Loom Dev home"><img src="assets/logo.svg" alt="">loom<span>/</span>dev</a>
        <nav class="nav-links">
          ${link('index.html#leaderboard', 'home', 'leaderboard')}
          ${link('models.html', 'models', 'models')}
          ${link('index.html#data', 'data', 'data')}
          ${link('index.html#how', 'how', 'how it works')}
          ${link('submit.html', 'submit', 'port yours')}
        </nav>
        <div class="nav-ext">
          <a href="https://github.com/loom-fun/weaver" target="_blank" rel="noopener">weaver ↗</a>
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
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'close' : 'menu';
  });
});
