// Componente partilhado: carrossel fixo (scroll vertical → horizontal → vertical).
// Aplica-se a TODAS as secções .projects[data-pin] de qualquer página (home, projetos, etc.).
// Extraído de main.js (v10) sem mudar a lógica; agora uma instância por secção.
// Movimento reduzido: sem fixação, swipe nativo com snap. Sem JS: swipe nativo.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // Carrossel de projetos. Na home ([data-pin]), em mobile e desktop, a secção fica fixa (sticky)
  // e o scroll vertical desliza os cartões na horizontal até ao último; depois a página continua.
  // Sem scroll-jacking: o scroll é o nativo (com inércia). A faixa só se move por transform:
  // a posição do scroll passa por uma curva com zona morta e rampas nas pontas (a mudança de
  // sentido entra e sai suave) e o transform segue esse alvo com interpolação (lerp) por frame.
  // Com movimento reduzido, ou sem [data-pin], fica o swipe nativo.
  const init = (track) => {
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
  };
  document.querySelectorAll('.projects .track').forEach(init);
})();
