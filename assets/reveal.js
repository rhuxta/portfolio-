// Revelação ao scroll — módulo partilhado. ~1 KB, sem dependências. Ver reveal.css.
// · Uma só vez por elemento (unobserve + atributo retirado no fim) → sem disparos duplos.
// · Cascata automática: os elementos que entram no mesmo frame saem por ordem de leitura, 85 ms entre si (máx. 6 passos).
// · Elementos já acima do ecrã (salto por âncora) aparecem sem animação.
(() => {
  const root = document.documentElement;
  window.__rv = true;
  const STEP = 85, MAX = 6, DUR = 1250;
  const done = (el) => { el.removeAttribute('data-reveal'); el.removeAttribute('data-reveal-delay'); el.classList.remove('is-in'); el.style.removeProperty('--rv-d'); };
  const all = () => [...document.querySelectorAll('[data-reveal]')];
  if (!root.classList.contains('rv-on') || !('IntersectionObserver' in window)) { root.classList.remove('rv-on'); return; }
  const show = (el, delay = 0) => {
    if (el.classList.contains('is-in')) return;
    const d = delay + (parseInt(el.dataset.revealDelay, 10) || 0);
    el.style.setProperty('--rv-d', d + 'ms');
    el.classList.add('is-in');
    setTimeout(() => done(el), d + DUR + 80);
  };
  const io = new IntersectionObserver((entries) => {
    const inn = entries.filter((e) => e.isIntersecting);
    inn.sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left));
    let k = 0;
    inn.forEach((e) => {
      io.unobserve(e.target);
      if (e.boundingClientRect.bottom < 0) { done(e.target); return; } // já passou: sem animação
      show(e.target, Math.min(k++, MAX) * STEP);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  const observe = (scope = document) => (scope === document ? all() : [...scope.querySelectorAll('[data-reveal]')]).forEach((el) => io.observe(el));
  observe();
  window.Reveal = { observe }; // para conteúdo injetado depois
  // Elemento focado nunca fica invisível; movimento reduzido ligado a meio mostra tudo
  document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-reveal]'); if (el) { io.unobserve(el); done(el); } });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (m) => { if (m.matches) { all().forEach(done); root.classList.remove('rv-on'); } });
})();
