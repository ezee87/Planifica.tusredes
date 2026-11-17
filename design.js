// Rediseño visual v7: header con sombra al desplazarse y aparición suave de bloques.
// Solo agrega clases; no modifica textos ni enlaces. Sin JS la página se ve completa.
(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  if (header) {
    let ticking = false;
    const update = () => { ticking = false; header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, {passive: true});
    update();
  }

  // Video del hero. La portada (cuadro 0) es el LCP y se ve desde el primer render;
  // el video se pide recién después de "load" para no competir con la carga inicial.
  // Con movimiento reducido o ahorro de datos se queda la imagen estática.
  const media = document.querySelector('.hero-media');
  const video = media && media.querySelector('.hero-video');
  if (video) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    const toggle = media.querySelector('.hero-media-toggle');
    let pausedByUser = false;
    const setPaused = paused => {
      media.classList.toggle('is-paused', paused);
      toggle.setAttribute('aria-label', paused ? 'Reproducir la demostración' : 'Pausar la demostración');
    };
    const play = () => { const p = video.play(); if (p) p.catch(() => {}); };
    const start = () => {
      if (reduce.matches || saveData) return;
      if (!video.dataset.ready) {
        video.dataset.ready = '1';
        video.muted = true;
        video.querySelectorAll('source[data-src]').forEach(source => { source.src = source.dataset.src; });
        video.load();
        // El botón aparece solo cuando hay algo que pausar.
        video.addEventListener('playing', () => { toggle.hidden = false; setPaused(false); }, {once: true});
      }
      if (!pausedByUser) play();
    };
    toggle.addEventListener('click', () => {
      pausedByUser = !video.paused;
      if (pausedByUser) { video.pause(); setPaused(true); } else { play(); setPaused(false); }
    });
    reduce.addEventListener('change', () => {
      if (reduce.matches) { video.pause(); setPaused(true); } else start();
    });
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, {once: true});
  }

  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Cada grupo escalona sus elementos para que entren en secuencia.
  const groups = [
    ['main section:not(.hero) .section-heading'],
    ['.feature'],
    ['.step'],
    ['#como-funciona .wrap > .button'],
    ['.offer .purchase'],
    ['.bonus-heading'],
    ['.offer-bonuses .bonus'],
    ['.guarantee-card'],
    ['.faq details'],
    ['.final .wrap > *']
  ];
  const items = [];
  groups.forEach(selectors => {
    document.querySelectorAll(selectors.join(',')).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(i, 6) * 0.07 + 's');
      items.push(el);
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {rootMargin: '0px 0px -8% 0px', threshold: 0.12});
  items.forEach(el => observer.observe(el));
  document.documentElement.classList.add('reveal-on');

  // Si se llega por ancla o se imprime, no dejar nada oculto.
  window.addEventListener('beforeprint', () => items.forEach(el => el.classList.add('is-visible')));
})();
