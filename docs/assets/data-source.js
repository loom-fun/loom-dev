// Site-wide URL parameters, kept on every link between the site's own pages so a link can be shared as is:
//   ?org=<org>   whose models to show: loom-fun (default), or loom-fun-staging to preview cards before promotion.
//   ?gpu=<id>    which GPU's results and instructions to show (ids from gpus.json; default: its first GPU).
//   ?baseline=<backend>  llama.cpp reference: rocm (default), vulkan, or best (per-workload maximum).
// A parameter at its default is left out of URLs. Must load before any script that reads window.LOOM_DATA: it writes
// the data <script> in place, so the order of the page's scripts is kept. LOOM (loom-lib.js) resolves the GPU.
(function () {
  const SOURCES = { 'loom-fun': 'assets/loom-data.js', 'loom-fun-staging': 'assets/loom-data-staging.js' };
  const DEFAULT_ORG = 'loom-fun';
  const q = new URLSearchParams(location.search);
  const org = SOURCES[q.get('org')] ? q.get('org') : DEFAULT_ORG;
  const v = document.currentScript && new URL(document.currentScript.src).searchParams.get('v');
  window.LOOM_ORG = org;
  window.LOOM_GPU_ASKED = q.get('gpu');
  document.write(`<script src="${SOURCES[org]}${v ? `?v=${v}` : ''}"><\/script>`);

  // The parameters a link to one of the site's pages carries. LOOM sets `gpu` to the resolved GPU (null at the default).
  const PARAMS = window.LOOM_PARAMS = { org: org === DEFAULT_ORG ? null : org, gpu: null, baseline: null };
  // `href` with the site parameters (overrides in `set`; null drops one). Returns other links unchanged.
  window.LOOM_LINK = (href, set = {}) => {
    let u;
    try { u = new URL(href, location.href); } catch (e) { return href; }
    if (u.origin !== location.origin || !/(\.html|\/)$/.test(u.pathname)) return href;
    for (const [k, val] of Object.entries({ ...PARAMS, ...set })) {
      if (val == null) u.searchParams.delete(k); else u.searchParams.set(k, val);
    }
    return (u.pathname.split('/').pop() || 'index.html') + u.search + u.hash;
  };
  const carry = a => {
    const href = a.getAttribute('href');
    if (!href || href[0] === '#' || a.hasAttribute('data-keep-href')) return;
    const out = window.LOOM_LINK(href);
    if (out !== href) a.setAttribute('href', out);
  };
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (a) carry(a); }, true);
  document.addEventListener('DOMContentLoaded', () => {
    window.LOOM_CARRY_ALL = () => document.querySelectorAll('a[href]').forEach(carry);
    setTimeout(window.LOOM_CARRY_ALL);   // after the injected navbar and footer
    if (org === DEFAULT_ORG) return;
    const band = document.createElement('div');
    band.className = 'org-band';
    band.setAttribute('role', 'note');
    band.innerHTML = `<span>Showing models from <b>${org}</b>, not the published loom-fun org.</span> <a data-keep-href href="${window.LOOM_LINK(location.href, { org: null })}">show loom-fun</a>`;
    document.body.prepend(band);
  });
})();
