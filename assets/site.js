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
  const W = 4024, H = 2744;
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
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === 0 && j === 0) continue;
      const c = baseTile.cloneNode(true);
      c.style.left = (i * TW) + 'px';
      c.style.top = (j * TH) + 'px';
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
    canvas.style.setProperty('--dot-x', (mx % (32 * scale)) + 'px');
    canvas.style.setProperty('--dot-y', (my % (32 * scale)) + 'px');
  }
  center();
  window.addEventListener('resize', center);

  // Drag to pan
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx += e.clientX - lastX;
    ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch(_) {}
  }
  canvas.addEventListener('pointerup', endDrag);
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
  if (!nav) return;

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
