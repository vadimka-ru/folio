// Live phone prototypes (RayPay): amount entry, welcome, OTP.
// Cards on the canvas autoplay while visible; taps come in as `proto-tap`
// events from the canvas (pointer capture swallows clicks there) and as
// regular clicks inside the opened modal.
(function () {
  const BALANCE = 5134.06;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function press(el) {
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 140);
  }

  // ---------- activity: only what is on screen (and not under a modal) runs ----------
  // The canvas repeats its tile 3×3, so every card exists 9 times. Anything that
  // animates offscreen still repaints the huge canvas layer, so we gate it all.
  const modalOpen = () => document.body.classList.contains('ui-modal-open');
  const inCanvas = (el) => !!el.closest('.ui-canvas');
  const watchers = new Set(); // { el, seen, onChange(active) }
  function isActive(w) { return w.seen && !(w.canvas && modalOpen()); }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const w = en.target._watch;
      if (!w) return;
      const before = isActive(w);
      w.seen = en.isIntersecting;
      if (isActive(w) !== before) w.onChange(isActive(w));
    });
  }, { threshold: 0.2 });
  function watch(el, onChange) {
    const w = { el, seen: false, canvas: inCanvas(el), onChange };
    el._watch = w;
    watchers.add(w);
    io.observe(el);
    return w;
  }
  // Re-evaluate canvas items when a modal opens/closes.
  let wasOpen = modalOpen();
  new MutationObserver(() => {
    const open = modalOpen();
    if (open === wasOpen) return;
    wasOpen = open;
    watchers.forEach((w) => {
      if (!w.el.isConnected) { io.unobserve(w.el); watchers.delete(w); return; }
      if (w.canvas && w.seen) w.onChange(isActive(w));
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Shared lifecycle: visibility-gated autoplay that yields to the user.
  function lifecycle(ph, run) {
    const st = { visible: false, lastUser: 0, gen: 0 };
    const idle = () => Date.now() - st.lastUser > 5000;
    async function loop(gen) {
      while (gen === st.gen && st.visible) {
        if (!idle() || reduceMotion) { await sleep(500); continue; }
        await run(() => gen === st.gen && st.visible && idle());
        await sleep(300);
      }
    }
    watch(ph, (active) => {
      st.visible = active;
      ph.classList.toggle('live', active); // CSS animations run only on .live phones
      if (active) loop(++st.gen); else st.gen++;
    });
    return st;
  }

  // Videos: play only while visible
  // Canvas cards: hide a media element until it can paint, shimmer its card meanwhile, then fade it in.
  function markPending(el, readyEvent) {
    const card = el.closest('.ui-canvas .uic-card');
    if (!card || el._pending) return;
    el._pending = true;
    el.classList.add('is-pending');
    card._pending = (card._pending || 0) + 1;
    card.classList.add('is-loading');
    const done = () => {
      if (!el._pending) return;
      el._pending = false;
      el.classList.remove('is-pending');
      card._pending -= 1;
      if (card._pending <= 0) card.classList.remove('is-loading');
    };
    el.addEventListener(readyEvent, done, { once: true });
    el.addEventListener('error', done, { once: true });
  }
  function initImgFade(img) {
    if (img._faded) return;
    img._faded = true;
    if (!img.complete || !img.naturalWidth) markPending(img, 'load');
  }

  function initVideo(v) {
    if (v._watch) return;
    v.removeAttribute('autoplay');
    v.pause();
    // nothing is fetched until the video is actually on screen (the canvas holds 9 copies of every card)
    if (v.preload !== 'auto') v.preload = 'none';
    watch(v, (active) => {
      if (active) { v.preload = 'auto'; if (v.readyState < 2) markPending(v, 'loadeddata'); const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    });
  }

  function bindTaps(ph, onKey, st) {
    const handler = (e) => {
      const k = e.target.closest('[data-k]');
      if (!k || !ph.contains(k)) return;
      if (k.classList.contains('off') || k.disabled) return; // disabled controls ignore taps
      st.lastUser = Date.now();
      press(k);
      onKey(k.dataset.k);
    };
    ph.addEventListener('proto-tap', handler);
    ph.addEventListener('click', handler);
  }

  // ---------- amount ----------
  function initAmount(ph) {
    const digitsEl = ph.querySelector('.pa-digits');
    const amountEl = ph.querySelector('.pa-amount');
    const cta = ph.querySelector('.pa-cta');
    let raw = '';
    let busy = false;

    function fmt(r) {
      if (!r) return '';
      const [i, d] = r.split('.');
      const int = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return d !== undefined ? int + '.' + d : int;
    }
    function render(animateLast) {
      const s = fmt(raw);
      digitsEl.innerHTML = '';
      if (!s) {
        digitsEl.innerHTML = '<span class="pa-ch pa-zero">0</span>';
      } else {
        [...s].forEach((c, i) => {
          const sp = document.createElement('span');
          sp.className = 'pa-ch';
          if (!(animateLast && i === s.length - 1)) sp.style.animation = 'none';
          sp.textContent = c;
          digitsEl.appendChild(sp);
        });
      }
      const v = parseFloat(raw || '0');
      const over = v > BALANCE;
      if (over && !amountEl.classList.contains('over')) {
        amountEl.classList.add('over');
      } else if (!over) {
        amountEl.classList.remove('over');
      }
      const off = !(v > 0) || over;
      cta.classList.toggle('off', off);
      cta.disabled = off;
      cta.setAttribute('aria-disabled', off);
    }
    function key(k) {
      if (busy) return;
      if (k === 'del') { raw = raw.slice(0, -1); if (raw === '0') raw = ''; render(false); return; }
      if (k === 'go') {
        if (cta.classList.contains('off')) return;
        busy = true;
        cta.textContent = 'Sent ✓';
        setTimeout(() => { raw = ''; cta.textContent = 'Continue'; busy = false; render(false); }, 1100);
        return;
      }
      if (k === '.') {
        if (raw.includes('.')) return;
        raw = (raw || '0') + '.';
        render(true);
        return;
      }
      const [i, d] = raw.split('.');
      if (d !== undefined && d.length >= 2) return;
      if (d === undefined && (i || '').length >= 7) return;
      if (raw === '' && k === '0') { render(false); return; }
      raw += k;
      render(true);
    }
    const st = lifecycle(ph, async (ok) => {
      const script = (ph.dataset.script || '1 0 0 0 wait go').split(' ');
      for (const t of script) {
        if (!ok()) return;
        if (t === 'wait') { await sleep(1300); continue; }
        const btn = ph.querySelector('[data-k="' + t + '"]');
        press(btn);
        key(t);
        await sleep(t === 'go' ? 1500 : 360);
      }
      await sleep(900);
    });
    bindTaps(ph, key, st);
    render(false);
  }

  // ---------- otp ----------
  function initOtp(ph) {
    const boxes = [...ph.querySelectorAll('.po-boxes i')];
    const wrap = ph.querySelector('.po-boxes');
    const secEl = ph.querySelector('.po-sec');
    const resend = ph.querySelector('.po-resend');
    let code = [];
    let busy = false;
    let sec = 59;

    function render() {
      boxes.forEach((b, i) => {
        b.classList.toggle('filled', i < code.length);
        b.classList.toggle('active', i === code.length && !busy);
      });
    }
    function reset() { code = []; busy = false; wrap.classList.remove('ok'); render(); }
    function key(k) {
      if (k === 'reset') { reset(); return; }
      if (busy) return;
      if (k === 'fill') { autoFill(); return; }
      if (k === 'del') { code.pop(); render(); return; }
      if (k === '.') return;
      code.push(k);
      render();
      if (code.length === 4) {
        busy = true;
        render();
        setTimeout(() => wrap.classList.add('ok'), 120);
        setTimeout(reset, 1500);
      }
    }
    async function autoFill() {
      for (const d of ['1', '2', '3', '4']) {
        press(ph.querySelector('.pk[data-k="' + d + '"]'));
        key(d);
        await sleep(170);
      }
    }
    // resend countdown
    setInterval(() => {
      if (!st.visible) return;
      sec -= 1;
      if (sec < 0) sec = 59;
      resend.textContent = sec === 0 ? 'Resend code' : 'Resend code ' + sec + 's';
    }, 1000);

    const st = lifecycle(ph, async (ok) => {
      await sleep(900); if (!ok()) return;
      press(ph.querySelector('.po-chip'));
      await autoFill();
      await sleep(2200); if (!ok()) return;
      for (const d of ['4', '8', '1', '5']) {
        if (!ok()) return;
        press(ph.querySelector('.pk[data-k="' + d + '"]'));
        key(d);
        await sleep(380);
      }
      await sleep(2000);
    });
    bindTaps(ph, key, st);
    ph._otpReset = reset;
    render();
  }

  // ---------- welcome ----------
  function initWelcome(ph) {
    // static pager; lifecycle only toggles .live so the wallet keeps floating
    const st = lifecycle(ph, () => sleep(2000));
    bindTaps(ph, (k) => {
      if (k !== 'start') return;
      const pair = ph.closest('.proto-pair');
      const otp = pair && pair.querySelector('[data-proto="otp"]');
      if (otp && otp._otpReset) otp._otpReset();
    }, st);
  }

  const INIT = { amount: initAmount, otp: initOtp, welcome: initWelcome };

  function fitModal(root) {
    const stage = root.querySelector('.proto-modal-stage');
    if (!stage) return;
    const mobile = window.innerWidth <= 680;
    const fit = mobile
      ? Math.min(0.9, (window.innerWidth - 64) / 437)
      : Math.min(0.9, (window.innerHeight - 40 - 120) / 888, (window.innerWidth - 120) / (437 * 2 + 72));
    stage.style.setProperty('--fit', Math.max(0.4, fit).toFixed(3));
  }

  // ---------- about card: one dot cloud morphing Figma → Claude → portrait ----------
  // Every shape is rasterised once and sampled on a regular grid tuned so it yields ~N points;
  // the same N particles then fly between the shapes. The cursor pushes them away.
  const MORPH = { size: 440, box: 250, n: 2800, hold: 2.6, fly: 1.7 }; // canvas leaves room for scattered dots
  const SHAPES = [
    { name: 'figma', aspect: 2 / 3, draw(g, w, h) {
      const u = w / 2, r = u / 2;
      const half = (x, y, col, left) => { // half-pill: round on one side
        g.fillStyle = col; g.beginPath();
        if (left) { g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); g.lineTo(x + u, y); g.lineTo(x + u, y + u); }
        else { g.moveTo(x, y); g.arc(x + r, y + r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(x, y + u); }
        g.closePath(); g.fill();
      };
      half(0, 0, '#F24E1E', true);
      half(u, 0, '#FF7262', false);
      half(0, u, '#A259FF', true);
      g.fillStyle = '#1ABCFE'; g.beginPath(); g.arc(u + r, u + r, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0ACF83'; // drop: a circle with a square top-right corner
      g.beginPath(); g.arc(r, 2 * u + r, r, 0, Math.PI * 2); g.fill();
      g.fillRect(r, 2 * u, r, r);
    } },
    { name: 'claude', aspect: 1, draw(g, w, h) {
      // starburst: rays of slightly different length around the centre
      const cx = w / 2, cy = h / 2, R = w / 2;
      const lens = [1, 0.78, 0.92, 0.7, 0.98, 0.82, 0.9, 0.74, 1, 0.8, 0.94, 0.72];
      g.strokeStyle = '#D97757'; g.lineCap = 'round'; g.lineWidth = w * 0.09;
      lens.forEach((l, i) => {
        const a = (i / lens.length) * Math.PI * 2 + 0.2;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * l * 0.92, cy + Math.sin(a) * R * l * 0.92); g.stroke();
      });
    } },
    // portrait comes from a 108px face crop of avatar.jpg inlined as a data URI: a data image does not
    // taint the canvas, so it can be sampled even when the page is opened straight from disk (file://)
    // framed on the face (the photo is mostly lake and sky) with a contrast boost so features read in dots
    { name: 'portrait', aspect: 1, contrast: 1.35, img: 'data:image/jpeg;base64,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', draw(g, w, h, img) {
      g.save(); g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 0, 0, w, h); g.restore();
    } },
  ];
  function sampleShape(sh, img) {
    const { box, n } = MORPH;
    const w = Math.round(sh.aspect >= 1 ? box : box * sh.aspect), h = Math.round(sh.aspect >= 1 ? box / sh.aspect : box);
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const g = off.getContext('2d');
    sh.draw(g, w, h, img);
    const px = g.getImageData(0, 0, w, h).data;
    let area = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 128) area++;
    const step = Math.sqrt(area / n); // grid spacing that gives ~n points over the shape
    const pts = [];
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
      const i = (Math.floor(y) * w + Math.floor(x)) * 4;
      if (px[i + 3] <= 128) continue;
      const k = sh.contrast || 1, rgb = [px[i], px[i + 1], px[i + 2]].map((v) => Math.max(0, Math.min(255, Math.round((v - 128) * k + 128))));
      pts.push({ x: x - w / 2, y: y - h / 2, rgb });
    }
    // exactly n targets: drop or repeat random points (repeats just overlap)
    while (pts.length > n) pts.splice(Math.floor(Math.random() * pts.length), 1);
    while (pts.length < n) pts.push({ ...pts[Math.floor(Math.random() * pts.length)] });
    // top-to-bottom order so particles keep their relative place between shapes
    pts.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return { pts, r: step * 0.36 };
  }
  function initMorph(cv) {
    if (cv._inited) return;
    cv._inited = true;
    const { size, n, hold, fly } = MORPH, dpr = 2;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const card = cv.closest('.uic-card') || cv.parentElement;
    let shapes = null;
    const parts = Array.from({ length: n }, () => ({ ox: 0, oy: 0, vx: 0, vy: 0, seed: Math.random() }));
    const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const cycle = hold + fly;
    let mouse = null; // in canvas px, with the cursor's own velocity so a fast swipe throws dots further
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (size / r.width), y = (e.clientY - r.top) * (size / r.height);
      mouse = mouse ? { x, y, vx: x - mouse.x, vy: y - mouse.y } : { x, y, vx: 0, vy: 0 };
    });
    card.addEventListener('pointerleave', () => { mouse = null; });
    let raf = 0, running = false, start = performance.now();
    function frame(now) {
      if (!shapes) return;
      const t = (now - start) / 1000;
      const k = Math.floor(t / cycle), u = t - k * cycle;
      const A = shapes[k % shapes.length], B = shapes[(k + 1) % shapes.length];
      const cx = size / 2, cy = size / 2;
      ctx.clearRect(0, 0, size, size);
      for (let i = 0; i < n; i++) {
        const p = parts[i], a = A.pts[i], b = B.pts[i];
        // a wave runs top to bottom: each particle starts flying a little later than the one above
        const delay = (i / n) * 0.45 + p.seed * 0.15;
        const m = u < hold ? 0 : ease(Math.min(1, Math.max(0, (u - hold - delay) / (fly - 0.6))));
        let x = a.x + (b.x - a.x) * m, y = a.y + (b.y - a.y) * m;
        // swirl while in flight
        const sw = Math.sin(m * Math.PI) * (14 + p.seed * 18);
        x += Math.cos(p.seed * 6.283 + t) * sw; y += Math.sin(p.seed * 6.283 + t) * sw;
        // cursor: scatter dots away (each at its own slightly skewed angle, plus the cursor's own motion),
        // then let them drift back slowly
        if (mouse) {
          const dx = cx + x + p.ox - mouse.x, dy = cy + y + p.oy - mouse.y, d2 = dx * dx + dy * dy, R = 90;
          if (d2 < R * R && d2 > 0.01) {
            const d = Math.sqrt(d2), fall = 1 - d / R, f = fall * fall * 9 * (0.6 + p.seed * 0.8);
            const ang = Math.atan2(dy, dx) + (p.seed - 0.5) * 1.2;
            p.vx += Math.cos(ang) * f + mouse.vx * fall * 0.35;
            p.vy += Math.sin(ang) * f + mouse.vy * fall * 0.35;
          }
        }
        p.vx = (p.vx - p.ox * 0.02) * 0.92; p.vy = (p.vy - p.oy * 0.02) * 0.92;
        p.ox += p.vx; p.oy += p.vy;
        const c0 = a.rgb, c1 = b.rgb;
        ctx.fillStyle = `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * m)},${Math.round(c0[1] + (c1[1] - c0[1]) * m)},${Math.round(c0[2] + (c1[2] - c0[2]) * m)})`;
        ctx.beginPath(); ctx.arc(cx + x + p.ox, cy + y + p.oy, A.r + (B.r - A.r) * m, 0, 6.283); ctx.fill();
      }
      if (mouse) { mouse.vx *= 0.7; mouse.vy *= 0.7; }
      if (running) raf = requestAnimationFrame(frame);
    }
    // logos are ready at once; the portrait joins the loop when its image has loaded and could be read
    shapes = SHAPES.filter((sh) => !sh.img).map((sh) => sampleShape(sh));
    frame(performance.now());
    const img = new Image();
    img.onload = () => {
      try { shapes = SHAPES.map((sh) => sampleShape(sh, img)); } catch (_) { /* unreadable image: keep the logos only */ }
      if (!running) frame(performance.now());
    };
    img.src = SHAPES.find((sh) => sh.img).img;
    watch(cv, (active) => {
      cancelAnimationFrame(raf);
      running = active && !reduceMotion;
      if (running && shapes) raf = requestAnimationFrame(frame);
    });
  }

  // about card phrase: strike «макета», then reveal the handwritten correction, once per card
  function initLead(ab) {
    if (ab._inited || reduceMotion) return;
    ab._inited = true;
    ab.classList.add('is-pre');
    watch(ab, (active) => {
      if (!active || !ab.classList.contains('is-pre')) return;
      ab.classList.add('is-in');
      requestAnimationFrame(() => ab.classList.remove('is-pre'));
    });
  }

  window.protoInit = function (root) {
    root.querySelectorAll('.uic-card--about .ab').forEach(initLead);
    root.querySelectorAll('canvas.ab-morph').forEach(initMorph);
    root.querySelectorAll('.ph[data-proto]').forEach((ph) => {
      if (ph._inited) return;
      ph._inited = true;
      INIT[ph.dataset.proto](ph);
    });
    root.querySelectorAll('video').forEach(initVideo);
    if (!reduceMotion) root.querySelectorAll('.ui-canvas .uic-card img').forEach(initImgFade);
    fitModal(root);
  };
  window.protoInit(document);

  // ---------- canvas filters ----------
  const nav = document.querySelector('nav.filters');
  const canvas = document.getElementById('ui-canvas');
  const mbar = document.getElementById('mbar');
  const allFilterLinks = () => document.querySelectorAll('nav.filters a[data-filter], .mbar-tab[data-filter]');

  function setFilter(f) {
    allFilterLinks().forEach((x) => x.classList.toggle('active', x.dataset.filter === f));
    canvas.dataset.filter = f;
    if (mbar) {
      const src = mbar.querySelector('.mbar-tab[data-filter="' + f + '"] svg');
      mbar.querySelector('.mbar-tab-current').innerHTML = src ? src.outerHTML : '';
    }
  }

  if (nav && canvas) {
    const base = canvas.querySelector('.ui-tile') || canvas;
    nav.querySelectorAll('a[data-filter]').forEach((a) => {
      const f = a.dataset.filter;
      const n = f === 'all'
        ? base.querySelectorAll('.uic-card:not([data-cat="about"])').length
        : base.querySelectorAll('.uic-card[data-cat="' + f + '"]').length;
      const b = a.querySelector('b');
      if (b) b.textContent = n;
    });
    allFilterLinks().forEach((a) => a.addEventListener('click', (e) => {
      if (mbar && mbar.classList.contains('is-compact') && a.classList.contains('mbar-tab')) return;
      setFilter(a.dataset.filter);
    }));
    setFilter('all');
  }

  // ---------- mobile bottom bar: collapse while panning ----------
  if (mbar && canvas) {
    const tabs = mbar.querySelector('.mbar-tabs');
    const mini = mbar.querySelector('.mbar-mini');
    const sheet = document.getElementById('msheet');
    const compact = (on) => mbar.classList.toggle('is-compact', on);

    // panning the canvas = "scrolling down" in the Apple pattern
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) compact(true);
    });
    window.addEventListener('pointerup', () => { down = null; });
    canvas.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) + Math.abs(e.deltaY) > 4) compact(true); }, { passive: true });

    // tap the collapsed tab circle → expand back
    tabs.addEventListener('click', (e) => {
      if (!mbar.classList.contains('is-compact')) return;
      e.stopPropagation();
      compact(false);
    });

    // theme circle
    mbar.querySelector('.mbar-theme').addEventListener('click', () => {
      setTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light');
    });

    // mini card → about sheet ("full player")
    if (sheet) {
      const socials = sheet.querySelector('.msheet-socials');
      document.querySelectorAll('.chrome-pill.socials a').forEach((a) => socials.appendChild(a.cloneNode(true)));
      const open = () => { sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); };
      const close = () => { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); };
      mini.addEventListener('click', (e) => { if (!e.target.closest('.mbar-tg')) open(); });
      sheet.querySelector('.msheet-backdrop').addEventListener('click', close);
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      // drag the card down to dismiss
      const card = sheet.querySelector('.msheet-card');
      let sy = null;
      card.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; card.style.transition = 'none'; }, { passive: true });
      card.addEventListener('touchmove', (e) => {
        if (sy === null) return;
        const dy = Math.max(0, e.touches[0].clientY - sy);
        card.style.transform = 'translateY(' + dy + 'px)';
      }, { passive: true });
      card.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - (sy ?? 0);
        sy = null; card.style.transition = ''; card.style.transform = '';
        if (dy > 90) close();
      });
    }
  }
})();

// Canvas: never start a text selection or a native image drag while panning
(function () {
  const canvas = document.getElementById('ui-canvas');
  if (!canvas) return;
  const inUi = (t) => t instanceof Element && !!t.closest('.ui-canvas, .ui-modal, .msheet');
  document.addEventListener('selectstart', (e) => { if (inUi(e.target.nodeType === 3 ? e.target.parentElement : e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (inUi(e.target)) e.preventDefault(); });
  canvas.addEventListener('pointerdown', () => {
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount) sel.removeAllRanges();
  });
})();

// Safari swaps the grab cursor for an arrow when a drag starts its own (selection) gesture:
// cancel the native mousedown action on the canvas; pointer events and taps still work.
(function () {
  const canvas = document.getElementById('ui-canvas');
  if (canvas) canvas.addEventListener('mousedown', (e) => { if (e.button === 0) e.preventDefault(); });
})();

// ---------- canvas zoom slider (bottom-right, Figma 12557:35) ----------
(function () {
  const ctl = document.querySelector('.zoom-ctl');
  const Z = window.uiCanvasZoom;
  if (!ctl || !Z) return;
  const track = ctl.querySelector('.zoom-track');
  const thumb = ctl.querySelector('.zoom-thumb');
  const fill = ctl.querySelector('.zoom-fill');
  const THUMB = 38;
  // log scale so each step feels the same near and far; t in [0, 1]
  const lo = Math.log(Z.min), hi = Math.log(Z.max);
  const toT = (s) => (Math.log(s) - lo) / (hi - lo);
  const toScale = (t) => Math.exp(lo + Math.max(0, Math.min(1, t)) * (hi - lo));
  function paint(t) {
    const x = t * (track.clientWidth - THUMB);
    thumb.style.transform = 'translateX(' + x + 'px)';
    fill.style.width = (x + THUMB - 10) + 'px';
    track.setAttribute('aria-valuenow', Math.round(t * 100));
  }
  window.__zoomSync = (s) => paint(toT(s));
  window.__zoomSync(Z.get());
  // drag anywhere on the track: the thumb's centre follows the pointer
  function setFromX(clientX) {
    const r = track.getBoundingClientRect();
    const t = (clientX - r.left - THUMB / 2) / (r.width - THUMB);
    Z.set(toScale(t));
  }
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    dragging = true; ctl.classList.add('dragging');
    try { track.setPointerCapture(e.pointerId); } catch (_) {}
    setFromX(e.clientX);
  });
  track.addEventListener('pointermove', (e) => { if (dragging) setFromX(e.clientX); });
  const end = () => { dragging = false; ctl.classList.remove('dragging'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); Z.set(Z.get() * 1.15); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); Z.set(Z.get() / 1.15); }
  });
  ctl.addEventListener('wheel', (e) => e.stopPropagation());
})();

// ---------- first-visit hint: fades out after the first pan, zoom or open ----------
(function () {
  const hint = document.getElementById('canvas-hint');
  const canvas = document.getElementById('ui-canvas');
  if (!hint || !canvas) return;
  setTimeout(() => hint.classList.add('shown'), 700);
  const hide = () => { hint.classList.remove('shown'); hint.classList.add('gone'); };
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 20) hide(); });
  canvas.addEventListener('wheel', hide, { passive: true, once: true });
  new MutationObserver(() => { if (document.body.classList.contains('ui-modal-open')) hide(); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
