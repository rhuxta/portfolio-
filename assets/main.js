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
  // Sem scroll-jacking: o scroll é o nativo (com inércia). A faixa só se move por transform:
  // a posição do scroll passa por uma curva com zona morta e rampas nas pontas (a mudança de
  // sentido entra e sai suave) e o transform segue esse alvo com interpolação (lerp) por frame.
  // Com movimento reduzido, ou sem [data-pin], fica o swipe nativo.
  const track = document.querySelector('.track');
  if (track) {
    const sec = track.closest('.projects');
    const cards = [...track.children];
    const last = cards.length - 1;
    const bar = sec.querySelector('.progress span');
    const count = sec.querySelector('[data-count]');
    const prev = sec.querySelector('[data-prev]'), next = sec.querySelector('[data-next]');
    const total = String(cards.length).padStart(2, '0');
    const K = 0.5;     // px de scroll vertical por px de deslize na parte do meio
    const DEAD = 0.04; // zona morta em cada ponta (fração do percurso fixo): a faixa ainda não mexe
    const RAMP = 0.15; // fração do deslize com aceleração no início e travagem no fim
    const LERP = 0.14; // quanto do caminho até ao alvo o transform anda por frame (a 60 fps)
    const LEN = K / ((1 - 2 * DEAD) * (1 - RAMP)); // comprimento fixo por px de deslize
    let pinned = false, dist = 0, i = -1, near = 0, raf = 0, cur = 0, goal = 0, then = 0;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const step = () => (cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1);
    const padL = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
    // Curva: aceleração constante nas rampas, velocidade constante no meio (sem saltos de velocidade)
    const H = RAMP / (2 * (1 - RAMP));
    const ease = (t) => (t < RAMP ? (t * t) / (2 * RAMP * (1 - RAMP))
      : t > 1 - RAMP ? 1 - ((1 - t) * (1 - t)) / (2 * RAMP * (1 - RAMP))
      : (t - RAMP / 2) / (1 - RAMP));
    const unease = (u) => (u < H ? Math.sqrt(u * 2 * RAMP * (1 - RAMP))
      : u > 1 - H ? 1 - Math.sqrt((1 - u) * 2 * RAMP * (1 - RAMP))
      : u * (1 - RAMP) + RAMP / 2);
    const len = () => dist * LEN;
    const target = () => {
      const r = clamp(-sec.getBoundingClientRect().top / (len() || 1), 0, 1);
      return ease(clamp((r - DEAD) / (1 - 2 * DEAD), 0, 1)) * dist;
    };
    const setCount = (n) => { if (n !== i) { i = n; count.textContent = `${String(n + 1).padStart(2, '0')} / ${total}`; } };
    const render = (pos, max) => {
      const vis = pinned ? track.clientWidth / (track.clientWidth + dist) : track.clientWidth / track.scrollWidth;
      bar.style.width = vis * 100 + '%';
      bar.style.transform = `translateX(${max > 0 ? (pos / max) * ((1 - vis) / vis) * 100 : 0}%)`;
      near = clamp(Math.round(pos / step()), 0, last);
      // Fixo: o contador segue o progresso (chega a 07 no fim, também com 3 cartões à vista).
      // Swipe: segue o cartão no início da faixa; no fim do percurso passa ao último.
      setCount(pinned ? Math.round((max > 0 ? pos / max : 0) * last) : pos >= max - 2 ? last : near);
      prev.disabled = pos <= 2; next.disabled = pos >= max - 2;
    };
    const frame = (now) => {
      raf = 0;
      if (!pinned) return render(track.scrollLeft, track.scrollWidth - track.clientWidth);
      goal = target();
      const dt = then ? Math.min(64, now - then) : 16.7; then = now;
      const k = 1 - Math.pow(1 - LERP, dt / 16.7); // igual a 60 ou 120 Hz
      cur += (goal - cur) * k;
      if (Math.abs(goal - cur) < 0.25) cur = goal;
      track.style.transform = `translate3d(${(-cur).toFixed(2)}px,0,0)`;
      render(cur, dist);
      sec.dispatchEvent(new Event('projetos:move'));
      if (cur !== goal) raf = requestAnimationFrame(frame); else then = 0;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const jump = () => { goal = cur = target(); then = 0; if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(performance.now()); };
    const measure = () => {
      if (!pinned) return;
      const end = cards[last]; // até o último cartão encostar à margem direita (não ao bordo do ecrã)
      dist = Math.max(0, Math.round(end.offsetLeft + end.offsetWidth + (parseFloat(getComputedStyle(track).paddingRight) || 0) - track.clientWidth));
      sec.style.setProperty('--pin-len', Math.round(len()) + 'px');
    };
    const setPinned = () => {
      const on = sec.hasAttribute('data-pin') && !reduce.matches;
      if (on === pinned) { measure(); jump(); return; }
      pinned = on;
      sec.classList.toggle('is-pinned', on);
      track.style.transform = '';
      if (!on) sec.style.removeProperty('--pin-len');
      measure(); jump();
    };
    // Posição da página que põe a faixa no deslize pos (inverso da curva)
    const topFor = (pos) => {
      const u = dist > 0 ? clamp(pos / dist, 0, 1) : 0;
      const r = u <= 0 ? 0 : u >= 1 ? 1 : DEAD + unease(u) * (1 - 2 * DEAD);
      return sec.getBoundingClientRect().top + scrollY + r * len();
    };
    // Setas: no modo fixo cada passo é 1/6 do percurso (como o contador); no swipe é um cartão
    const show = (n, instant) => {
      n = clamp(n, 0, last);
      const behavior = instant || reduce.matches ? 'instant' : 'smooth';
      if (!pinned) return cards[n].scrollIntoView({ behavior, block: 'nearest', inline: 'start' });
      scrollTo({ top: topFor((n / last) * dist), behavior });
    };
    prev.addEventListener('click', () => show((pinned ? i : near) - 1));
    next.addEventListener('click', () => show((pinned ? i : near) + 1));
    // Teclado: um cartão fora do ecrã que recebe foco passa a estar visível por inteiro
    track.addEventListener('focusin', (e) => {
      const card = e.target.closest('.card'); if (!card || !pinned) return;
      const r = card.getBoundingClientRect(), pad = padL();
      if (r.left >= 0 && r.right <= innerWidth) return;
      const pos = r.left < 0 ? card.offsetLeft - pad : card.offsetLeft + card.offsetWidth + pad - track.clientWidth;
      scrollTo({ top: topFor(clamp(pos, 0, dist)), behavior: 'instant' });
      jump();
    });
    track.addEventListener('scroll', queue, { passive: true });
    addEventListener('scroll', () => { if (pinned) queue(); }, { passive: true });
    addEventListener('resize', () => { measure(); jump(); });
    reduce.addEventListener('change', setPinned);
    setPinned();
    // No modo fixo os cartões entram por transform, não por scroll da faixa: o lazy-load nativo
    // chegava tarde num scroll rápido. Quando a secção se aproxima, carregam-se todas as imagens.
    if (sec.hasAttribute('data-pin') && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        track.querySelectorAll('img[loading="lazy"]').forEach((im) => { im.loading = 'eager'; });
      }, { rootMargin: '150% 0px' });
      io.observe(sec);
    }
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
