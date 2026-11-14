// Sem dependências. ~3 KB. Tudo funciona sem JS (menu cai para âncoras, carrossel é scroll nativo).
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Nav sólida após o hero
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Menu ecrã inteiro
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  if (btn && menu) {
    const set = (open) => {
      root.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open);
      btn.querySelector('.menu-btn__label').textContent = open ? 'Fechar' : 'Menu';
      menu.inert = !open;
      if (open) menu.querySelector('a').focus({ preventScroll: true });
    };
    menu.inert = true;
    btn.addEventListener('click', () => set(!root.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { set(false); btn.focus(); } });
  }

  // Vídeo do hero: loop contínuo (sem botão de pausa, decisão do Rhuston).
  // Movimento reduzido ou poupança de dados: fica o poster. Pausa fora do ecrã.
  const video = document.querySelector('.hero video');
  if (video) {
    if (video.dataset.posterDesktop && matchMedia('(min-width:900px)').matches) video.poster = video.dataset.posterDesktop;
    const saveData = navigator.connection && navigator.connection.saveData;
    const still = () => reduce.matches || saveData;
    const apply = () => { if (still()) { video.pause(); video.removeAttribute('autoplay'); } else { video.play().catch(() => {}); } };
    reduce.addEventListener('change', apply); apply();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (still()) return; e.isIntersecting ? video.play().catch(() => {}) : video.pause(); }, { threshold: 0.15 }).observe(video);
    }
  }

  // Carrossel de projetos. Na home ([data-pin]), em mobile e desktop, a secção fica fixa (sticky)
  // e o scroll vertical desliza os cartões na horizontal até ao último; depois a página continua.
  // Sem scroll-jacking: o scroll é o nativo (com inércia), só a faixa se move por transform.
  // Com movimento reduzido, ou sem [data-pin], fica o swipe nativo.
  const track = document.querySelector('.track');
  if (track) {
    const sec = track.closest('.projects');
    const cards = [...track.children];
    const bar = sec.querySelector('.progress span');
    const count = sec.querySelector('[data-count]');
    const prev = sec.querySelector('[data-prev]'), next = sec.querySelector('[data-next]');
    const total = String(cards.length).padStart(2, '0');
    const K = 0.55; // px de scroll vertical por px de deslize: ~45% menos scroll extra que 1:1
    const sda = !!(window.CSS && CSS.supports('animation-timeline: view()'));
    let pinned = false, dist = 0, i = 0, raf = 0;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const step = () => (cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1);
    const padL = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const render = (pos, max) => {
      const vis = pinned ? track.clientWidth / (track.clientWidth + dist) : track.clientWidth / track.scrollWidth;
      const n = clamp(Math.round(pos / step()), 0, cards.length - 1);
      bar.style.width = vis * 100 + '%';
      bar.style.transform = `translateX(${max > 0 ? (pos / max) * ((1 - vis) / vis) * 100 : 0}%)`;
      if (n !== i || !count.textContent.endsWith(total)) { i = n; count.textContent = `${String(i + 1).padStart(2, '0')} / ${total}`; }
      prev.disabled = pos <= 2; next.disabled = pos >= max - 2;
    };
    const pinPos = () => clamp(-sec.getBoundingClientRect().top / (dist * K || 1), 0, 1) * dist;
    const update = () => {
      raf = 0;
      if (!pinned) return render(track.scrollLeft, track.scrollWidth - track.clientWidth);
      const pos = pinPos();
      if (!sda) track.style.transform = `translate3d(${-pos.toFixed(1)}px,0,0)`;
      render(pos, dist);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    const measure = () => {
      if (!pinned) return;
      const last = cards[cards.length - 1]; // até o último cartão encostar à margem direita (não ao bordo do ecrã)
      dist = Math.max(0, Math.round(last.offsetLeft + last.offsetWidth + (parseFloat(getComputedStyle(track).paddingRight) || 0) - track.clientWidth));
      sec.style.setProperty('--pin-dist', dist + 'px');
      sec.style.setProperty('--pin-len', Math.round(dist * K) + 'px');
    };
    const setPinned = () => {
      const on = sec.hasAttribute('data-pin') && !reduce.matches;
      if (on === pinned) { measure(); update(); return; }
      pinned = on;
      sec.classList.toggle('is-pinned', on);
      track.style.transform = '';
      if (!on) { sec.style.removeProperty('--pin-dist'); sec.style.removeProperty('--pin-len'); }
      measure(); update();
    };
    // Leva o cartão n ao início da faixa: desliza a faixa (swipe) ou desce a página (modo fixo)
    const show = (n, instant) => {
      const card = cards[clamp(n, 0, cards.length - 1)];
      const behavior = instant || reduce.matches ? 'instant' : 'smooth';
      if (!pinned) return card.scrollIntoView({ behavior, block: 'nearest', inline: 'start' });
      const pos = clamp(card.offsetLeft - padL(), 0, dist);
      scrollTo({ top: sec.getBoundingClientRect().top + scrollY + pos * K, behavior });
    };
    prev.addEventListener('click', () => show(i - 1)); next.addEventListener('click', () => show(i + 1));
    // Teclado: um cartão fora do ecrã que recebe foco passa a estar visível
    track.addEventListener('focusin', (e) => {
      const card = e.target.closest('.card'); if (!card || !pinned) return;
      const r = card.getBoundingClientRect();
      if (r.left < 0 || r.right > innerWidth) show(cards.indexOf(card), true);
    });
    track.addEventListener('scroll', queue, { passive: true });
    addEventListener('scroll', () => { if (pinned) queue(); }, { passive: true });
    addEventListener('resize', () => { measure(); queue(); });
    reduce.addEventListener('change', setPinned);
    setPinned();
  }

  // Cartões: inclinação 3D com reflexo e a imagem a deslizar ao contrário (só com rato).
  // No toque, a imagem faz uma paralaxe suave com o swipe. Nada disto corre com movimento reduzido.
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.card[href] .card__img').forEach((el) => {
    const card = el.closest('.card');
    let on = false, x = 0, y = 0, raf = 0;
    const paint = () => {
      raf = 0; if (!on) return;
      const r = el.getBoundingClientRect(); // lido a cada frame: a faixa pode estar a deslizar por baixo do rato
      const px = clamp01((x - r.left) / r.width) - 0.5, py = clamp01((y - r.top) / r.height) - 0.5;
      el.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
      el.style.setProperty('--ry', (px * 8).toFixed(2) + 'deg');
      el.style.setProperty('--tx', (-px * 14).toFixed(1) + 'px');
      el.style.setProperty('--ty', (-py * 14).toFixed(1) + 'px');
      el.style.setProperty('--gx', (px * r.width).toFixed(0) + 'px');
      el.style.setProperty('--gy', (py * r.height).toFixed(0) + 'px');
    };
    const queue = () => { if (on && !raf) raf = requestAnimationFrame(paint); };
    card.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse' || !fine.matches || reduce.matches) return; on = true; el.classList.add('is-tilt'); x = e.clientX; y = e.clientY; queue(); });
    card.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; queue(); });
    card.addEventListener('pointerleave', () => { on = false; el.classList.remove('is-tilt'); ['--rx', '--ry', '--tx', '--ty'].forEach((v) => el.style.removeProperty(v)); });
    addEventListener('scroll', queue, { passive: true });
  });
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  document.querySelectorAll('.track').forEach((t) => {
    const imgs = [...t.querySelectorAll('.card__img img')];
    let raf = 0;
    const drift = () => {
      raf = 0;
      if (fine.matches || reduce.matches) { imgs.forEach((im) => { im.style.transform = ''; }); return; }
      const tr = t.getBoundingClientRect(), cx = tr.left + tr.width / 2;
      const d = imgs.map((im) => { const r = im.parentElement.getBoundingClientRect(); return (r.left + r.width / 2 - cx) / tr.width; });
      imgs.forEach((im, k) => { im.style.transform = `translate3d(${(-d[k] * 8).toFixed(2)}%,0,0) scale(1.12)`; });
    };
    const q = () => { if (!raf) raf = requestAnimationFrame(drift); };
    t.addEventListener('scroll', q, { passive: true });
    if (t.closest('[data-pin]')) addEventListener('scroll', q, { passive: true }); // no modo fixo a faixa move-se com o scroll da página
    fine.addEventListener('change', drift); reduce.addEventListener('change', drift);
    drift();
  });

  // Competências: toque para abrir (um de cada vez)
  document.querySelectorAll('.skill__btn').forEach((b) => {
    b.addEventListener('click', () => {
      const item = b.closest('.skill'); const open = !item.classList.contains('is-open');
      document.querySelectorAll('.skill.is-open').forEach((o) => { o.classList.remove('is-open'); o.querySelector('.skill__btn').setAttribute('aria-expanded', 'false'); });
      item.classList.toggle('is-open', open); b.setAttribute('aria-expanded', open);
    });
  });

  // Vimeo "facade": só carrega o player quando a pessoa toca (com som, porque foi pedido)
  document.querySelectorAll('.player[data-vimeo]').forEach((p) => {
    p.querySelector('button').addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://player.vimeo.com/video/${p.dataset.vimeo}?autoplay=1&loop=1&title=0&byline=0&portrait=0&dnt=1`;
      f.allow = 'autoplay; fullscreen; picture-in-picture'; f.title = p.dataset.title; f.loading = 'lazy';
      p.replaceChildren(f);
    });
  });
})();
