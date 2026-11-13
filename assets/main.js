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

  // Carrossel: progresso + setas
  const track = document.querySelector('.track');
  if (track) {
    const cards = [...track.children];
    const bar = document.querySelector('.progress span');
    const count = document.querySelector('[data-count]');
    const prev = document.querySelector('[data-prev]'), next = document.querySelector('[data-next]');
    let i = 0;
    bar.style.width = (100 / cards.length) + '%';
    const update = () => {
      bar.style.transform = `translateX(${i * 100}%)`;
      count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      prev.disabled = i === 0; next.disabled = i === cards.length - 1;
    };
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { i = cards.indexOf(e.target); update(); } });
    }, { root: track, threshold: 0.6 });
    cards.forEach((c) => io.observe(c));
    const go = (d) => cards[Math.max(0, Math.min(cards.length - 1, i + d))].scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
    prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1));
    update();
  }

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
