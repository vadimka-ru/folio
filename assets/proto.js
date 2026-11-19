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
  function initVideo(v) {
    if (v._watch) return;
    v.removeAttribute('autoplay');
    v.pause();
    v.preload = 'metadata';
    watch(v, (active) => {
      if (active) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
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
    const dots = [...ph.querySelectorAll('.pw-pager i')];
    let i = 0;
    const st = lifecycle(ph, async (ok) => {
      await sleep(2200); if (!ok()) return;
      dots[i].classList.remove('on');
      i = (i + 1) % dots.length;
      dots[i].classList.add('on');
    });
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

  window.protoInit = function (root) {
    root.querySelectorAll('.ph[data-proto]').forEach((ph) => {
      if (ph._inited) return;
      ph._inited = true;
      INIT[ph.dataset.proto](ph);
    });
    root.querySelectorAll('video').forEach(initVideo);
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
      mini.addEventListener('click', (e) => { if (!e.target.closest('.mbar-cv')) open(); });
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

// ---------- canvas zoom slider (bottom-right) ----------
(function () {
  const ctl = document.querySelector('.zoom-ctl');
  const Z = window.uiCanvasZoom;
  if (!ctl || !Z) return;
  const range = ctl.querySelector('.zoom-range');
  // log scale so each step feels the same near and far
  const lo = Math.log(Z.min), hi = Math.log(Z.max);
  const toVal = (s) => Math.round(((Math.log(s) - lo) / (hi - lo)) * 1000);
  const toScale = (v) => Math.exp(lo + (v / 1000) * (hi - lo));
  let syncing = false;
  function paint() { range.style.setProperty('--p', (range.value / 10) + '%'); }
  window.__zoomSync = (s) => { if (syncing) return; range.value = toVal(s); paint(); };
  window.__zoomSync(Z.get());
  range.addEventListener('input', () => { syncing = true; Z.set(toScale(Number(range.value))); syncing = false; paint(); });
  ctl.querySelectorAll('.zoom-btn').forEach((b) => b.addEventListener('click', () => {
    Z.set(Z.get() * (Number(b.dataset.z) > 0 ? 1.25 : 0.8));
  }));
  // the slider is part of the chrome, not the canvas: don't start a canvas drag from it
  ['pointerdown', 'wheel'].forEach((t) => ctl.addEventListener(t, (e) => e.stopPropagation()));
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
