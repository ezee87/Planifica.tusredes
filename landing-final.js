// Inicio de compra: begin_checkout (GA4) e InitiateCheckout (TikTok) al hacer clic en un
// enlace de checkout de Systeme.io. Precio y moneda salen de los data-checkout-* de cada enlace,
// junto al texto visible. Nunca se frena la navegación: si la analítica falla, el enlace sigue.
// Va antes del menú para que un error allí no impida medir.
(() => {
  'use strict';
  const PRODUCT_ID = 'planifica_tus_redes';
  const PRODUCT_NAME = 'Planifica tus redes';
  const DEDUPE_MS = 2000; // ignora el doble clic, permite reintentos posteriores
  const lastClick = new WeakMap();

  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const link = event.target.closest && event.target.closest('a[data-checkout]');
    if (!link) return;
    const now = Date.now();
    if (now - (lastClick.get(link) || 0) < DEDUPE_MS) return;
    lastClick.set(link, now);

    const method = link.dataset.checkout;
    const currency = link.dataset.checkoutCurrency;
    const value = Number(link.dataset.checkoutValue);
    if (!method || !currency || !Number.isFinite(value)) return;
    const eventId = 'ic_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8);

    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', {
          currency,
          value,
          payment_method: method,
          items: [{item_id: PRODUCT_ID, item_name: PRODUCT_NAME, price: value, currency, quantity: 1}]
        });
      }
    } catch (e) { /* la analítica nunca bloquea el pago */ }

    try {
      if (window.ttq && typeof window.ttq.track === 'function') {
        window.ttq.track('InitiateCheckout', {
          contents: [{content_id: PRODUCT_ID, content_type: 'product', content_name: PRODUCT_NAME, quantity: 1, price: value}],
          content_type: 'product',
          value,
          currency,
          payment_method: method
        }, {event_id: eventId});
      }
    } catch (e) { /* la analítica nunca bloquea el pago */ }
  });
})();

(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('#section-links');
  const mobile = matchMedia('(max-width:800px)');
  function close(returnFocus = false) {
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus();
  }
  toggle.hidden = false;
  document.documentElement.classList.add('menu-ready');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    if (open) links.querySelector('a').focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
  });
  links.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !mobile.matches) return;
    close();
    const section = document.querySelector(link.getAttribute('href'));
    section.setAttribute('tabindex', '-1');
    section.focus({preventScroll:true});
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav-links')) close(); });
  document.querySelector('.nav-links').addEventListener('focusout', event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  });
  mobile.addEventListener('change', () => {close(); window.dispatchEvent(new Event('resize'));});
  if (location.protocol === 'file:') document.querySelector('footer a[href="/contacto.html"]').href = 'contacto.html';
})();
