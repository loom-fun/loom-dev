// Picks the model data the page reads: the loom-fun org by default, or another org's build with ?org=<org>
// (e.g. ?org=loom-fun-staging to preview cards before they are promoted). Must load before any script that reads
// window.LOOM_DATA; it writes the data <script> in place so the order of the page's scripts is kept.
(function () {
  const SOURCES = { 'loom-fun': 'assets/loom-data.js', 'loom-fun-staging': 'assets/loom-data-staging.js' };
  const DEFAULT = 'loom-fun';
  const asked = new URLSearchParams(location.search).get('org');
  const org = asked && SOURCES[asked] ? asked : DEFAULT;
  const v = document.currentScript && new URL(document.currentScript.src).searchParams.get('v');
  window.LOOM_ORG = org;
  document.write(`<script src="${SOURCES[org]}${v ? `?v=${v}` : ''}"><\/script>`);
  if (org === DEFAULT) return;

  // Keep ?org= on links between the site's own pages.
  const carry = a => {
    const href = a.getAttribute('href');
    if (!href || a.hasAttribute('data-org-off') || /^[a-z]+:|^\/\/|^#/i.test(href) || !/\.html(#|$)/.test(href)) return;
    const u = new URL(href, location.href);
    u.searchParams.set('org', org);
    a.setAttribute('href', u.pathname.split('/').pop() + u.search + u.hash);
  };
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a'); if (a) carry(a); }, true);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href]').forEach(carry);
    const off = new URL(location.href);
    off.searchParams.delete('org');
    const band = document.createElement('div');
    band.className = 'org-band';
    band.setAttribute('role', 'note');
    band.innerHTML = `<span>Showing models from <b>${org}</b>, not the published loom-fun org.</span> <a data-org-off href="${(off.pathname.split('/').pop() || 'index.html') + off.search + off.hash}">show loom-fun</a>`;
    band.style.cssText = 'background:#b45309;color:#fff;padding:6px 16px;font:13px/1.4 system-ui,sans-serif;text-align:center;position:relative;z-index:1000';
    band.querySelector('a').style.cssText = 'color:#fff;text-decoration:underline;margin-left:8px';
    document.body.prepend(band);
  });
})();
