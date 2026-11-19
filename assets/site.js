// ===== Theme =====
    const root = document.documentElement;
    const btnLight = document.getElementById('theme-light');
    const btnDark  = document.getElementById('theme-dark');
    function setTheme(mode) {
      root.classList.toggle('light', mode === 'light');
      btnLight.classList.toggle('active', mode === 'light');
      btnDark.classList.toggle('active',  mode === 'dark');
      try { localStorage.setItem('theme', mode); } catch {}
    }
    btnLight.addEventListener('click', () => setTheme('light'));
    btnDark .addEventListener('click', () => setTheme('dark'));
    try {
      const saved = localStorage.getItem('theme');
      if (saved) setTheme(saved);
    } catch {}

    // ===== Sections: fade in on view =====
    const sections = Array.from(document.querySelectorAll('.section'));
    const navLinks = document.querySelectorAll('nav.main-nav a');

    function markVisibleSections() {
      const vh = window.innerHeight;
      sections.forEach(s => {
        const r = s.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) s.classList.add('in-view');
      });
    }
    markVisibleSections();

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('in-view');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    sections.forEach(s => io.observe(s));

    // BFCache restore: re-check visible sections
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) markVisibleSections();
    });

    // Scrollspy
    function updateNav() {
      if (!sections.length) return;
      const mid = window.scrollY + window.innerHeight / 2;
      let active = sections[0];
      for (const s of sections) {
        if (s.offsetTop <= mid) active = s;
      }
      navLinks.forEach(l => {
        const ds = l.getAttribute('data-section');
        if (!ds) return; // external link — keep static active class from HTML
        l.classList.toggle('active', ds === active.id);
      });
    }
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });

    // Nav clicks — custom smooth scroll with gentle ease-out
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
    function smoothScrollTo(targetY, duration = 500) {
      const startY = window.scrollY;
      const delta = targetY - startY;
      if (Math.abs(delta) < 2) return;
      const startT = performance.now();
      let cancelled = false;
      const cancel = () => { cancelled = true; };
      window.addEventListener('wheel', cancel, { once: true, passive: true });
      window.addEventListener('touchstart', cancel, { once: true, passive: true });
      function step(now) {
        if (cancelled) return;
        const t = Math.min(1, (now - startT) / duration);
        window.scrollTo(0, startY + delta * easeOutQuart(t));
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    navLinks.forEach(link => {
      const id = link.getAttribute('data-section');
      if (!id) return; // external link — let default navigation happen
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) smoothScrollTo(el.offsetTop);
      });
    });

    // Teammates counter
    const tickEl = document.getElementById('tick');
    if (tickEl) {
      let teammates = 432;
      function renderTeammates() {
        tickEl.textContent = teammates.toLocaleString('ru-RU').replace(/,/g, ' ');
      }
      renderTeammates();
      setInterval(() => { teammates += 1; renderTeammates(); }, 10000);
    }

    // ===== Case card open/close animation =====
    const caseClose = document.getElementById('case-close');
    const altName = document.getElementById('alt-name');
    const altRole = document.getElementById('alt-role');
    const avatarAlt = document.getElementById('avatar-alt');
    let openedCard = null;
    let ghost = null;
    let cardOriginalParent = null;
    let cardOriginalNext = null;

    function openCase(card) {
      if (openedCard) return;
      openedCard = card;

      // Populate me-card alt text for this case
      altName.textContent = card.dataset.brandName || 'Case';
      altRole.textContent = card.dataset.brandDate || '';
      // Swap avatar: use real logo if available, otherwise build a text-mark placeholder
      const meAvatar = document.querySelector('.me-card .me-avatar');
      const mark = (card.dataset.brandName || '?').trim();
      const initials = mark.split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
      const tryLogo = card.dataset.brandLogo;
      avatarAlt.onerror = () => {
        avatarAlt.removeAttribute('src');
        meAvatar.setAttribute('data-fallback', initials);
      };
      avatarAlt.onload = () => { meAvatar.removeAttribute('data-fallback'); };
      if (tryLogo) {
        avatarAlt.src = tryLogo;
      } else {
        avatarAlt.removeAttribute('src');
        meAvatar.setAttribute('data-fallback', initials);
      }

      const rect = card.getBoundingClientRect();

      // Create ghost placeholder to preserve scroll height and the card's slot
      ghost = document.createElement('div');
      ghost.className = 'case-ghost';
      ghost.style.height = rect.height + 'px';
      cardOriginalParent = card.parentElement;
      cardOriginalNext = card.nextSibling;
      cardOriginalParent.insertBefore(ghost, card);

      // Move card to body so it escapes any ancestor containing-block (transforms on section)
      document.body.appendChild(card);

      // Fix card at current visual position
      card.classList.add('opening');
      card.style.top = rect.top + 'px';
      card.style.left = rect.left + 'px';
      card.style.width = rect.width + 'px';
      card.style.height = rect.height + 'px';

      // Lock body scroll
      document.body.classList.add('case-open');

      // Next frame — transition to fullscreen
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.classList.add('open');
          const mobile = window.innerWidth <= 680;
          if (mobile) {
            card.style.top = '0px';
            card.style.left = '0px';
            card.style.width = '100vw';
            card.style.height = window.innerHeight + 'px';
            card.style.borderRadius = '0';
          } else {
            card.style.top = '20px';
            card.style.left = '20px';
            card.style.width = 'calc(100vw - 40px)';
            card.style.height = 'calc(100vh - 40px)';
          }
          buildToc(card);
        });
      });
    }

    function buildToc(card) {
      const body = card.querySelector('.case-open-body');
      if (!body) return;
      const sections = card.querySelectorAll('[data-toc]');
      if (!sections.length) return;
      const labels = {
        context: 'Контекст',
        task: 'Задача',
        hypothesis: 'Гипотеза',
        research: 'Исследование',
        outcomes: 'Итоги'
      };
      const order = ['context','task','hypothesis','research','outcomes'];
      const map = {};
      sections.forEach(s => { if (!map[s.dataset.toc]) map[s.dataset.toc] = s; });
      const nav = document.createElement('nav');
      nav.className = 'ca-toc';
      const ul = document.createElement('ul');
      ul.className = 'ca-toc-list';
      const track = document.createElement('div');
      track.className = 'ca-toc-track';
      const progress = document.createElement('div');
      progress.className = 'ca-toc-progress';
      track.appendChild(progress);
      ul.appendChild(track);
      const items = [];
      order.forEach(key => {
        if (!map[key]) return;
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = 'ca-toc-item';
        btn.dataset.toc = key;
        btn.textContent = labels[key];
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = map[key];
          body.scrollTo({ top: target.offsetTop - 40, behavior: 'smooth' });
        });
        li.appendChild(btn);
        ul.appendChild(li);
        items.push(btn);
      });
      nav.appendChild(ul);
      card.appendChild(nav);

      function onScroll() {
        const sH = body.scrollHeight - body.clientHeight;
        const mid = body.scrollTop + 80;
        let active = null;
        const byPos = order.filter(k => map[k]).slice().sort((a,b) => map[a].offsetTop - map[b].offsetTop);
        byPos.forEach(key => {
          if (map[key].offsetTop <= mid) active = key;
        });
        if (sH > 0 && body.scrollTop >= sH - 4) {
          for (let i = order.length - 1; i >= 0; i--) {
            if (map[order[i]]) { active = order[i]; break; }
          }
        }
        items.forEach(it => it.classList.toggle('active', it.dataset.toc === active));
        // Fill progress line up to midpoint of active item, full at last
        const activeIdx = items.findIndex(it => it.dataset.toc === active);
        const trackH = track.clientHeight;
        if (activeIdx === items.length - 1 && activeIdx >= 0) {
          progress.style.height = trackH + 'px';
        } else if (activeIdx >= 0) {
          const li = items[activeIdx].parentElement;
          const liMid = li.offsetTop + li.offsetHeight / 2;
          const trackTop = track.offsetTop;
          const fill = Math.max(0, Math.min(trackH, liMid - trackTop));
          progress.style.height = fill + 'px';
        } else {
          progress.style.height = '0';
        }
      }
      body.addEventListener('scroll', onScroll, { passive: true });
      card._tocCleanup = () => {
        body.removeEventListener('scroll', onScroll);
        if (nav.parentElement) nav.parentElement.removeChild(nav);
        delete card._tocCleanup;
      };
      onScroll();
    }

    function closeCase() {
      if (!openedCard) return;
      const card = openedCard;
      const rect = ghost.getBoundingClientRect();

      if (card._tocCleanup) card._tocCleanup();

      card.classList.remove('open');
      card.classList.add('closing');
      card.style.top = rect.top + 'px';
      card.style.left = rect.left + 'px';
      card.style.width = rect.width + 'px';
      card.style.height = rect.height + 'px';

      document.body.classList.remove('case-open');

      const onEnd = (e) => {
        if (e.propertyName !== 'top') return;
        card.removeEventListener('transitionend', onEnd);
        card.classList.remove('opening', 'closing');
        card.style.top = '';
        card.style.left = '';
        card.style.width = '';
        card.style.height = '';
        card.style.borderRadius = '';
        // Restore card to its original DOM position
        if (cardOriginalParent) {
          cardOriginalParent.insertBefore(card, cardOriginalNext);
        }
        if (ghost && ghost.parentElement) ghost.parentElement.removeChild(ghost);
        ghost = null;
        cardOriginalParent = null;
        cardOriginalNext = null;
        openedCard = null;
      };
      card.addEventListener('transitionend', onEnd);
    }

    document.querySelectorAll('.case-card').forEach(card => {
      card.addEventListener('click', () => {
        if (openedCard || card.classList.contains('opening')) return;
        openCase(card);
      });
    });
    if (caseClose) caseClose.addEventListener('click', closeCase);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openedCard) closeCase();
    });

// === UI infinite canvas pan/zoom ===
(function(){
  const canvas = document.getElementById('ui-canvas');
  const world = document.getElementById('ui-canvas-world');
  if (!canvas || !world) return;
  const W = 4024, H = 3432;
  const GAP = 8; // seam gap between repeated tiles
  const TW = W + GAP, TH = H + GAP;
  let tx = 0, ty = 0, scale = 1;
  const minScale = 0.25, maxScale = 2;

  // Build infinite tile grid: move existing children into base tile, clone 3x3
  const baseTile = document.createElement('div');
  baseTile.className = 'ui-tile';
  baseTile.style.left = '0px';
  baseTile.style.top = '0px';
  while (world.firstChild) baseTile.appendChild(world.firstChild);
  world.appendChild(baseTile);
  // reading order of the openable cards: used to step through them inside the modal
  const NAV = [...baseTile.querySelectorAll('.uic-card')]
    .filter((c) => !c.dataset.nomodal)
    .sort((a, b) => (parseInt(a.style.top) - parseInt(b.style.top)) || (parseInt(a.style.left) - parseInt(b.style.left)));
  NAV.forEach((c, i) => { c.dataset.idx = i; });
  // DOM order = Tab order: put the cards in reading order (they are absolutely positioned, layout doesn't change)
  [...baseTile.querySelectorAll(':scope > .uic-card')]
    .sort((a, b) => (parseInt(a.style.top) - parseInt(b.style.top)) || (parseInt(a.style.left) - parseInt(b.style.left)))
    .forEach((c) => baseTile.appendChild(c));
  // keyboard: every openable base card is a button; data-ki pairs it with its copies in the clones
  baseTile.querySelectorAll('.uic-card').forEach((c, i) => {
    c.dataset.ki = i;
    if (c.dataset.nomodal) return;
    const cap = c.querySelector('.uic-cap');
    const b = cap && cap.querySelector('b'), sp = cap && cap.querySelector('span');
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    // live prototypes on the canvas are tapped with a pointer; by keyboard they are used inside the opened card
    c.querySelectorAll('.ph button, .ph [tabindex]').forEach((el) => { el.tabIndex = -1; });
    c.setAttribute('aria-label', [b && b.textContent.trim(), sp && sp.textContent.trim()].filter(Boolean).join(' — '));
  });
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === 0 && j === 0) continue;
      const c = baseTile.cloneNode(true);
      c.style.left = (i * TW) + 'px';
      c.style.top = (j * TH) + 'px';
      // copies are decoration for the infinite pan: no tab stops, hidden from screen readers
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('[tabindex], a[href], button, input, video[controls]').forEach((el) => { el.tabIndex = -1; });
      world.appendChild(c);
    }
  }

  // Center initial view
  function center() {
    const vw = canvas.clientWidth, vh = canvas.clientHeight;
    scale = Math.min(vw / 1400, vh / 950, 0.9);
    if (scale < minScale) scale = minScale;
    // Center synapse-ui card (2016, 1376), 1000x680, at viewport center
    const SYN_CX = 2016 + 500, SYN_CY = 1376 + 340;
    tx = vw / 2 - SYN_CX * scale;
    ty = vh / 2 - SYN_CY * scale;
    apply();
  }
  function apply() {
    const sw = TW * scale, sh = TH * scale;
    // Wrap tx,ty into [-sw, 0] and [-sh, 0]
    const mx = ((tx % sw) + sw) % sw - sw;
    const my = ((ty % sh) + sh) % sh - sh;
    world.style.transform = 'translate(' + mx + 'px,' + my + 'px) scale(' + scale + ')';
    world.style.setProperty('--cs', scale);
    canvas.style.setProperty('--dot-x', (mx % (32 * scale)) + 'px');
    canvas.style.setProperty('--dot-y', (my % (32 * scale)) + 'px');
    if (window.__zoomSync) window.__zoomSync(scale, minScale, maxScale);
  }
  // zoom keeping the point (cx, cy) on screen in place; viewport centre by default
  function zoomTo(next, cx, cy) {
    next = Math.max(minScale, Math.min(maxScale, next));
    if (cx == null) { cx = canvas.clientWidth / 2; cy = canvas.clientHeight / 2; }
    const wx = (cx - tx) / scale, wy = (cy - ty) / scale;
    scale = next;
    tx = cx - wx * scale; ty = cy - wy * scale;
    apply();
  }
  window.uiCanvasZoom = { set: (s) => zoomTo(s), get: () => scale, min: minScale, max: maxScale };
  // centre a base-tile card (by world position) in the viewport
  function centerOnCard(card) {
    const cx = parseInt(card.style.left) + card.offsetWidth / 2;
    const cy = parseInt(card.style.top) + card.offsetHeight / 2;
    tx = canvas.clientWidth / 2 - cx * scale;
    ty = canvas.clientHeight / 2 - cy * scale;
    apply();
  }
  // smooth pan that centres a card, taking the shortest way around the wrapped tiles
  let panRaf = 0, panEnd = null;
  function stopPan(finish) {
    if (!panRaf) return;
    cancelAnimationFrame(panRaf); panRaf = 0;
    if (finish && panEnd) { tx = panEnd[0]; ty = panEnd[1]; apply(); }
    panEnd = null;
  }
  function panToCard(card) {
    stopPan(false);
    const sw = TW * scale, sh = TH * scale;
    let ntx = canvas.clientWidth / 2 - (parseInt(card.style.left) + card.offsetWidth / 2) * scale;
    let nty = canvas.clientHeight / 2 - (parseInt(card.style.top) + card.offsetHeight / 2) * scale;
    ntx += Math.round((tx - ntx) / sw) * sw;
    nty += Math.round((ty - nty) / sh) * sh;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { tx = ntx; ty = nty; apply(); return; }
    const sx = tx, sy = ty, t0 = performance.now(), D = 420;
    panEnd = [ntx, nty];
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      tx = sx + (ntx - sx) * e; ty = sy + (nty - sy) * e; apply();
      if (k < 1) panRaf = requestAnimationFrame(step); else { panRaf = 0; panEnd = null; }
    };
    panRaf = requestAnimationFrame(step);
  }
  // the on-screen copy of a card (base tile or one of the clones) closest to the viewport centre
  function nearestCopy(attr, val) {
    return [...world.querySelectorAll('.uic-card[' + attr + '="' + val + '"]')]
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .sort((a, b) => Math.hypot(a.r.left + a.r.width / 2 - innerWidth / 2, a.r.top + a.r.height / 2 - innerHeight / 2)
                    - Math.hypot(b.r.left + b.r.width / 2 - innerWidth / 2, b.r.top + b.r.height / 2 - innerHeight / 2))[0];
  }
  center();
  window.addEventListener('resize', center);

  // ===== Empty modal on cell click (reuses case open effect/size) =====
  let modalOpen = false, modalEl = null, modalRect = null, kbOpened = false;
  function openUiModal(cell, viaKeyboard) {
    if (modalOpen) return;
    modalOpen = true;
    kbOpened = !!viaKeyboard;
    const rect = cell.getBoundingClientRect();
    modalRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    const m = document.createElement('div');
    m.className = 'ui-modal';
    m.style.top = rect.top + 'px';
    m.style.left = rect.left + 'px';
    m.style.width = rect.width + 'px';
    m.style.height = rect.height + 'px';
    m.style.borderRadius = '12px';
    document.body.appendChild(m);
    modalEl = m;
    document.body.classList.add('ui-modal-open');

    fillModal(m, cell);
    m.addEventListener('click', (e) => {
      // lightbox: any click closes it, except on prototype controls and the nav pill
      if (m.classList.contains('ui-modal--lightbox') && !e.target.closest('.ph [data-k], .card-nav')) closeUiModal();
    });
    bindSwipe(m);
    showCardNav(true);
    m.tabIndex = -1;
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    if (kbOpened) m.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const mobile = window.innerWidth <= 680;
        if (mobile) {
          m.style.top = '0px'; m.style.left = '0px';
          m.style.width = '100vw'; m.style.height = window.innerHeight + 'px';
          m.style.borderRadius = '0';
        } else {
          m.style.top = '20px'; m.style.left = '20px';
          m.style.width = 'calc(100vw - 40px)';
          m.style.height = 'calc(100vh - 40px)';
          m.style.borderRadius = '24px';
        }
      });
    });
  }


  // ===== Modal content for a card: a case template, or the card itself enlarged =====
  let currentIdx = -1;
  function fillModal(m, cell) {
    currentIdx = Number(cell.dataset.idx);
    m.className = 'ui-modal';
    m.scrollTop = 0;
    const caseKey = cell.dataset.case;
    const tpl = caseKey && document.getElementById('ui-case-' + caseKey);
    if (tpl) {
      m.classList.add('ui-modal--content', 'ui-modal--' + caseKey);
      m.appendChild(tpl.content.cloneNode(true));
      if (window.protoInit) window.protoInit(m);
      buildModalToc(m);
    } else {
      m.classList.add('ui-modal--lightbox');
      const box = document.createElement('div');
      box.className = 'ui-lightbox';
      const clone = cell.cloneNode(true);
      clone.removeAttribute('style');
      ['tabindex', 'role', 'aria-label', 'aria-hidden'].forEach((a) => clone.removeAttribute(a));
      clone.classList.remove('kb-focus');
      clone.classList.add('ui-lightbox-card');
      clone.querySelectorAll('video').forEach((v) => { v.muted = true; v.loop = true; v.playsInline = true; });
      box.appendChild(clone);
      m.appendChild(box);
      if (window.protoInit) window.protoInit(m);
    }
    updateCardNav();
  }

  // step to the previous / next card without closing the modal
  let navBusy = false;
  function stepCard(dir) {
    if (!modalOpen || !modalEl || navBusy || currentIdx < 0) return;
    navBusy = true;
    const m = modalEl;
    const target = NAV[(currentIdx + dir + NAV.length) % NAV.length];
    m.classList.add('ui-modal--swap-out');
    m.style.setProperty('--swap-dx', (dir > 0 ? -1 : 1) * 40 + 'px');
    setTimeout(() => {
      if (m._tocCleanup) m._tocCleanup();
      while (m.firstChild) m.removeChild(m.firstChild);
      // move the canvas behind so the card we land on sits in the middle (closing shrinks into it)
      centerOnCard(target);
      const near = nearestCopy('data-idx', target.dataset.idx), hit = near && near.r;
      if (hit) modalRect = { top: hit.top, left: hit.left, width: hit.width, height: hit.height };
      fillModal(m, target);
      m.style.setProperty('--swap-dx', (dir > 0 ? 1 : -1) * 40 + 'px');
      m.classList.add('ui-modal--swap-in');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        m.classList.remove('ui-modal--swap-in');
        setTimeout(() => { navBusy = false; }, 220);
      }));
    }, 160);
  }

  // nav pill: ‹ 3 / 22 ›
  const cardNav = document.createElement('div');
  cardNav.className = 'chrome-pill card-nav';
  cardNav.innerHTML = '<button class="card-nav-btn" data-dir="-1" aria-label="Предыдущая карточка"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>'
    + '<span class="card-nav-count"></span>'
    + '<button class="card-nav-btn" data-dir="1" aria-label="Следующая карточка"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>';
  document.body.appendChild(cardNav);
  cardNav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dir]');
    if (b) { e.stopPropagation(); stepCard(Number(b.dataset.dir)); }
  });
  function updateCardNav() { cardNav.querySelector('.card-nav-count').textContent = (currentIdx + 1) + ' / ' + NAV.length; }
  function showCardNav(on) { cardNav.classList.toggle('shown', on); }
  window.addEventListener('keydown', (e) => {
    if (!modalOpen) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stepCard(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepCard(-1); }
  });
  // swipe left / right on touch screens
  function bindSwipe(m) {
    let sx = 0, sy = 0, st = 0;
    m.addEventListener('touchstart', (e) => { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    m.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]; if (!t || !st) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      st = 0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepCard(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  // ===== Fixed table of contents for case modals (same look as the old case cards) =====
  const TOC_LABELS = { context: 'Контекст', task: 'Задача', hypothesis: 'Гипотеза', research: 'Исследование', outcomes: 'Итоги' };
  function buildModalToc(m) {
    const secs = [...m.querySelectorAll('[data-toc]')].filter((s, i, a) => a.findIndex((x) => x.dataset.toc === s.dataset.toc) === i);
    // the old cards listed only these five keys; extra keys need an explicit label
    const list = secs.filter((s) => s.dataset.tocLabel || TOC_LABELS[s.dataset.toc]);
    if (list.length < 2) return;
    const nav = document.createElement('nav');
    nav.className = 'ca-toc ca-toc--modal';
    const ul = document.createElement('ul');
    ul.className = 'ca-toc-list';
    const track = document.createElement('div');
    track.className = 'ca-toc-track';
    const progress = document.createElement('div');
    progress.className = 'ca-toc-progress';
    track.appendChild(progress);
    ul.appendChild(track);
    const items = list.map((sec) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'ca-toc-item';
      btn.textContent = sec.dataset.tocLabel || TOC_LABELS[sec.dataset.toc];
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        m.scrollTo({ top: sec.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 40, behavior: 'smooth' });
      });
      li.appendChild(btn);
      ul.appendChild(li);
      return btn;
    });
    nav.appendChild(ul);
    document.body.appendChild(nav);
    setTimeout(() => { nav.classList.add('shown'); onScroll(); }, 500);

    function onScroll() {
      const top = m.getBoundingClientRect().top;
      const mid = 120;
      let active = -1;
      list.forEach((sec, i) => { if (sec.getBoundingClientRect().top - top <= mid) active = i; });
      if (m.scrollTop >= m.scrollHeight - m.clientHeight - 4) active = list.length - 1;
      items.forEach((it, i) => it.classList.toggle('active', i === active));
      const trackH = track.clientHeight;
      if (active === items.length - 1) progress.style.height = trackH + 'px';
      else if (active >= 0) {
        const li = items[active].parentElement;
        progress.style.height = Math.max(0, Math.min(trackH, li.offsetTop + li.offsetHeight / 2 - track.offsetTop)) + 'px';
      } else progress.style.height = '0';
    }
    m.addEventListener('scroll', onScroll, { passive: true });
    m._tocCleanup = () => {
      m.removeEventListener('scroll', onScroll);
      nav.remove();
      delete m._tocCleanup;
    };
    onScroll();
  }
  function closeUiModal() {
    if (!modalOpen || !modalEl) return;
    const m = modalEl, r = modalRect;
    if (m._tocCleanup) m._tocCleanup();
    showCardNav(false);
    m.classList.add('ui-modal--closing'); // fade out inner content during shrink
    if (kbOpened && NAV[currentIdx]) { restoringFocus = true; NAV[currentIdx].focus({ preventScroll: true }); restoringFocus = false; }
    m.style.top = r.top + 'px';
    m.style.left = r.left + 'px';
    m.style.width = r.width + 'px';
    m.style.height = r.height + 'px';
    m.style.borderRadius = '12px';
    document.body.classList.remove('ui-modal-open');
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      m.removeEventListener('transitionend', onEnd);
      if (m.parentElement) m.parentElement.removeChild(m);
      modalEl = null; modalRect = null; modalOpen = false;
    };
    const onEnd = (e) => { if (e.propertyName === 'top') cleanup(); };
    m.addEventListener('transitionend', onEnd);
    setTimeout(cleanup, 650); // fallback if transitionend never fires
  }
  const caseCloseBtn = document.getElementById('case-close');
  if (caseCloseBtn) caseCloseBtn.addEventListener('click', () => { if (modalOpen) closeUiModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen) closeUiModal(); });

  // ===== Keyboard: Tab through cards, Enter/Space opens, focus pans the canvas =====
  let restoringFocus = false;
  function markFocus(ki, on) {
    world.querySelectorAll('.uic-card[data-ki="' + ki + '"]').forEach((c) => c.classList.toggle('kb-focus', on));
  }
  baseTile.addEventListener('focusin', (e) => {
    // a focused element far inside the overflow:hidden canvas makes the browser scroll it: undo that
    canvas.scrollLeft = 0; canvas.scrollTop = 0;
    const card = e.target;
    if (!card.classList.contains('uic-card') || !card.matches(':focus-visible')) return;
    markFocus(card.dataset.ki, true);
    if (!restoringFocus) panToCard(card);
  });
  baseTile.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('uic-card')) markFocus(e.target.dataset.ki, false);
  });
  baseTile.addEventListener('keydown', (e) => {
    const card = e.target;
    if (modalOpen || !card.classList.contains('uic-card')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (card.dataset.nomodal) return;
    stopPan(true);
    const near = nearestCopy('data-ki', card.dataset.ki);
    openUiModal(near ? near.c : card, true);
  });
  canvas.addEventListener('pointerdown', () => stopPan(false));
  canvas.addEventListener('wheel', () => stopPan(false), { passive: true });

  // Drag to pan
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, moved = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (modalOpen) return;
    dragging = true; moved = false;
    lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx += e.clientX - lastX;
    ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
    apply();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch(_) {}
  }
  canvas.addEventListener('pointerup', (e) => {
    const wasDragging = dragging, didMove = moved;
    endDrag(e);
    if (wasDragging && !didMove && !modalOpen) {
      const t = document.elementFromPoint(e.clientX, e.clientY);
      // Live prototype controls inside a card: tap them instead of opening the card
      const ctl = t && t.closest ? t.closest('.ph [data-k]') : null;
      if (ctl) { ctl.dispatchEvent(new CustomEvent('proto-tap', { bubbles: true })); return; }
      // Real links inside a card (e.g. Telegram on the about card): follow them instead of opening the card
      const link = t && t.closest ? t.closest('.uic-card a[href]') : null;
      if (link) { window.open(link.href, link.target || '_self', 'noopener'); return; }
      const cell = t && t.closest ? t.closest('.uic-card') : null;
      if (cell && !cell.dataset.nomodal) openUiModal(cell, false);
    }
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  // Pinch-to-zoom (touch)
  let pinch = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinch = {
        dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
        scale
      };
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const rect = canvas.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const wx = (cx - tx) / pinch.scale;
      const wy = (cy - ty) / pinch.scale;
      scale = Math.max(minScale, Math.min(maxScale, pinch.scale * dist / pinch.dist));
      tx = cx - wx * scale;
      ty = cy - wy * scale;
      apply();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });

  // Wheel: pan, ctrl+wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const wx = (cx - tx) / scale, wy = (cy - ty) / scale;
      const factor = Math.exp(-e.deltaY * 0.01);
      let next = scale * factor;
      next = Math.max(minScale, Math.min(maxScale, next));
      scale = next;
      tx = cx - wx * scale;
      ty = cy - wy * scale;
    } else {
      tx -= e.deltaX;
      ty -= e.deltaY;
    }
    apply();
  }, { passive: false });
})();

// ===== Prevent hanging prepositions =====
(function() {
  const RE = /(\s|^)([а-яА-ЯёЁa-zA-Z]{1,2})\s+/g;
  const SKIP = /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA|INPUT)$/;
  function fix(text) { return text.replace(RE, '$1$2 '); }
  function walk(node) {
    if (node.nodeType === 3) {
      if (node.nodeValue && node.nodeValue.indexOf(' ') !== -1) {
        const next = fix(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
    } else if (node.nodeType === 1 && !SKIP.test(node.tagName)) {
      for (const c of [...node.childNodes]) walk(c);
    }
  }
  walk(document.body);
})();

// ===== Mobile menu =====
(function() {
  const nav = document.querySelector('nav.main-nav');
  if (!nav || nav.classList.contains('filters')) return; // filters page uses the mobile bar (proto.js)

  // Read hrefs from existing hidden chrome elements
  const cvHref = document.querySelector('.cv-button')?.href || '#';
  const socialLinks = [...(document.querySelectorAll('.socials a'))].map(a => ({
    href: a.href,
    label: a.getAttribute('aria-label') || '',
    svg: a.querySelector('svg')?.outerHTML || ''
  }));

  // Inject toggle button into nav
  const btn = document.createElement('a');
  btn.className = 'nav-more-btn';
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Ещё');
  btn.textContent = '···';
  nav.appendChild(btn);

  // Build panel
  const panel = document.createElement('div');
  panel.className = 'mobile-menu-panel';

  const socialsHTML = socialLinks.map(l =>
    `<a href="${l.href}" target="_blank" aria-label="${l.label}" class="mobile-menu-social">${l.svg}</a>`
  ).join('');

  panel.innerHTML = `
    <div class="mobile-menu-row mobile-menu-theme-row">
      <button class="mobile-menu-theme-btn" data-mode="light" aria-label="Светлая тема">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
      <button class="mobile-menu-theme-btn" data-mode="dark" aria-label="Тёмная тема">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>
      </button>
    </div>
    <div class="mobile-menu-row mobile-menu-socials-row">${socialsHTML}</div>
    <a href="${cvHref}" target="_blank" class="mobile-menu-row mobile-menu-cv">CV</a>
  `;
  document.body.appendChild(panel);

  // Sync active theme button
  function syncTheme() {
    const isLight = document.documentElement.classList.contains('light');
    panel.querySelectorAll('.mobile-menu-theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === (isLight ? 'light' : 'dark'));
    });
  }
  syncTheme();

  panel.querySelectorAll('.mobile-menu-theme-btn').forEach(b => {
    b.addEventListener('click', () => { setTheme(b.dataset.mode); syncTheme(); });
  });

  // Toggle open/close
  let open = false;
  function closeMenu() { open = false; panel.classList.remove('open'); btn.classList.remove('active'); }
  function openMenu() { open = true; panel.classList.add('open'); btn.classList.add('active'); syncTheme(); }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? closeMenu() : openMenu();
  });
  document.addEventListener('click', closeMenu);
  panel.addEventListener('click', (e) => e.stopPropagation());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
})();
