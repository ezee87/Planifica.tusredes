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

  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Cada grupo escalona sus elementos para que entren en secuencia.
  const groups = [
    ['main section:not(.hero) .section-heading'],
    ['.comparison', '.comparison-group'],
    ['.demo-item'],
    ['.features-heading'],
    ['.feature'],
    ['.step'],
    ['#como-funciona .wrap > .button'],
    ['.offer .purchase'],
    ['.offer-extra > h3', '.offer-extra > .product-description', '.offer-extra > .included'],
    ['.offer-bonuses .bonus'],
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
