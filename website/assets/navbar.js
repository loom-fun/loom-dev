// Shared navbar for every page, injected into .navbar-placeholder.

const GITHUB_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.38c.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.08 1.85 2.83 1.32 3.52 1 .11-.78.42-1.32.76-1.62-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.47 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/></svg>';
const HF_ICON = '<span class="hf-emoji" aria-hidden="true">🤗</span>';

function createNavbar(active) {
  const link = (href, key, text) => `<a href="${href}" class="${active === key ? 'active' : ''}">${text}</a>`;
  return `
    <nav class="navbar" id="navbar">
      <a class="brand" href="index.html" aria-label="Loom Dev home">
        <img src="assets/logo.svg" alt="" class="brand-mark" />
        <span class="brand-name">Loom<span class="brand-tag">Dev</span></span>
      </a>
      <div class="nav-links" id="navLinks">
        ${link('models.html', 'models', 'Explore models')}
        ${link('index.html#leaderboard', 'leaderboard', 'Leaderboard')}
        ${link('submit.html', 'submit', 'Submit a model')}
        <a href="https://github.com/loom-fun/loom-skills" target="_blank" rel="noopener" class="nav-social">${GITHUB_ICON}loom-skills</a>
        <a href="https://huggingface.co/loom-fun" target="_blank" rel="noopener" class="nav-social">${HF_ICON}loom-fun</a>
      </div>
      <div class="nav-actions">
        <a class="btn btn-primary btn-sm" href="submit.html"><span class="material-symbols-outlined">add</span>Weave yours</a>
        <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false"><span class="material-symbols-outlined">menu</span></button>
      </div>
    </nav>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const slot = document.querySelector('.navbar-placeholder');
  if (!slot) return;
  slot.outerHTML = createNavbar(document.body.dataset.page);
  const nav = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});
