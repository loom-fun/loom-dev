// Hero background: weft threads flowing across warp lines, bending away from the cursor.

(() => {
  const canvas = document.getElementById('weave');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = [[255, 181, 71], [255, 122, 110], [255, 92, 138], [197, 93, 217], [139, 92, 255]];
  let w, h, dpr, threads, mouse = { x: -9999, y: -9999 };

  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const colorAt = t => {
    const s = t * (COLORS.length - 1), i = Math.min(COLORS.length - 2, Math.floor(s));
    return mix(COLORS[i], COLORS[i + 1], s - i);
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(10, Math.min(22, Math.round(h / 42)));
    threads = Array.from({ length: n }, (_, i) => ({
      y: h * (0.12 + 0.8 * (i / (n - 1))),
      amp: 18 + Math.random() * 46,
      freq: 0.0024 + Math.random() * 0.0034,
      speed: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      color: colorAt(i / (n - 1)),
      width: 1 + Math.random() * 1.4,
      shuttle: Math.random(),
      shuttleSpeed: 0.00008 + Math.random() * 0.00016,
    }));
  }

  function yAt(th, x, t) {
    let y = th.y + Math.sin(x * th.freq + th.phase + t * 0.0004 * th.speed) * th.amp
      + Math.sin(x * th.freq * 2.3 - t * 0.0003) * th.amp * 0.25;
    const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy, r = 160;
    if (d2 < r * r) {
      const f = 1 - Math.sqrt(d2) / r;
      y += (dy >= 0 ? 1 : -1) * f * f * 60;
    }
    return y;
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = (t * 0.004) % 34; x < w; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    for (const th of threads) {
      const [r, g, b] = th.color;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.04)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.22)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.6)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = th.width;
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 8) {
        const y = yAt(th, x, t);
        x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      const sx = ((th.shuttle + t * th.shuttleSpeed) % 1) * (w + 200) - 100;
      const sy = yAt(th, sx, t);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
      glow.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    if (!still) requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  }, { passive: true });
  resize();
  requestAnimationFrame(frame);
})();
