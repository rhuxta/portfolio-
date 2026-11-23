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

  // Carrossel fixo: ver assets/pin.js (componente partilhado, uma instância por .projects[data-pin]).

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
    card.closest('.projects')?.addEventListener('projetos:move', queue);
  });
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  document.querySelectorAll('.track').forEach((t) => {
    const imgs = [...t.querySelectorAll('.card__img img')];
    let raf = 0;
    const drift = () => {
      raf = 0;
      if (fine.matches || reduce.matches) { imgs.forEach((im) => { im.style.transform = ''; }); return; }
      // Medido em relação ao ecrã, não à faixa: no modo fixo a faixa é deslocada por transform e o
      // seu centro fica longe do ecrã, o que empurrava as imagens dos últimos cartões para fora.
      const vw = innerWidth, cx = vw / 2;
      const d = imgs.map((im) => { const r = im.parentElement.getBoundingClientRect(); return Math.max(-1, Math.min(1, (r.left + r.width / 2 - cx) / vw)); });
      imgs.forEach((im, k) => { im.style.transform = `translate3d(${(-d[k] * 8).toFixed(2)}%,0,0) scale(1.12)`; });
    };
    const q = () => { if (!raf) raf = requestAnimationFrame(drift); };
    t.addEventListener('scroll', q, { passive: true });
    t.closest('.projects')?.addEventListener('projetos:move', q); // no modo fixo a faixa move-se sozinha (lerp)
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
