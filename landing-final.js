// Inicio de compra: begin_checkout (GA4) e InitiateCheckout (TikTok) al hacer clic en un
// enlace de checkout de Systeme.io. Precio y moneda salen de los data-checkout-* de cada enlace,
// junto al texto visible. Nunca se frena la navegación: si la analítica falla, el enlace sigue.
// Va antes del menú para que un error allí no impida medir.
// GA4 respeta Consent Mode (limitado si está habilitado); TikTok exige consentimiento publicitario.
(() => {
  'use strict';
  const PRODUCT_ID = 'planifica_tus_redes';
  const PRODUCT_NAME = 'Planifica tus redes';
  const DEDUPE_MS = 2000; // ignora el doble clic, permite reintentos posteriores
  const lastClick = new WeakMap();
  const consent = () => (window.ptrConsent ? window.ptrConsent.get() : {analytics: false, ads: false});

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
    const granted = consent();

    try {
      if (window.ptrConsent && window.ptrConsent.canMeasureGA() && typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', {
          currency,
          value,
          payment_method: method,
          items: [{item_id: PRODUCT_ID, item_name: PRODUCT_NAME, price: value, currency, quantity: 1}]
        });
      }
    } catch (e) { /* la analítica nunca bloquea el pago */ }

    try {
      if (granted.ads && window.ttq && typeof window.ttq.track === 'function') {
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

// Atribución: conserva UTM e identificadores de clic de la URL de entrada en sessionStorage
// (misma pestaña) y los agrega a los enlaces de checkout de Systeme.io. Solo se tocan esos
// enlaces; se usa set() para no duplicar y se conservan los parámetros propios del destino.
// Se aplica al cargar, así también funcionan Ctrl+clic, clic central y "abrir en pestaña nueva".
// También agrega ga_client_id y ga_session_id, leídos solo con gtag('get') (nunca de la URL).
// Como llegan de forma asíncrona, los enlaces se reescriben al recibirlos; si un clic normal
// ocurre antes, se espera como máximo GA_WAIT_MS y se navega igual. Sin GA no se agrega nada.
// Consentimiento (consent.js), revisado en cada cambio:
// - Las UTM se conservan siempre: son necesarias para registrar el origen comercial de la compra.
// - ttclid, fbclid y gclid solo se guardan y transmiten con consentimiento publicitario; hasta
//   entonces quedan en memoria (los de la URL actual) y nunca en el almacenamiento.
// - ga_client_id y ga_session_id solo con consentimiento analítico.
// - ad_consent=granted solo con consentimiento publicitario vigente; nunca se guarda.
(() => {
  'use strict';
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];
  const AD_KEYS = ['ttclid', 'fbclid', 'gclid'];
  const STORAGE_KEY = 'ptr_attribution';
  const MAX_LENGTH = 500;
  const GA_ID = 'G-CMX0YC67EN';
  const GA_FIELDS = {client_id: ['ga_client_id', /^\d+\.\d+$/], session_id: ['ga_session_id', /^\d+$/]};
  const GA_WAIT_MS = 1000;
  const AD_CONSENT_PARAM = 'ad_consent';
  const AD_CONSENT_GRANTED = 'granted';
  const consent = () => (window.ptrConsent ? window.ptrConsent.get() : {analytics: false, ads: false});

  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { stored = {}; }
  const incoming = new URLSearchParams(location.search);
  const fromUrl = {};
  UTM_KEYS.concat(AD_KEYS).forEach(key => {
    const value = (incoming.get(key) || '').trim();
    if (value && value.length <= MAX_LENGTH) fromUrl[key] = value;
  });
  const attribution = {};
  const restore = keys => keys.forEach(key => {
    if (typeof stored[key] === 'string' && stored[key]) attribution[key] = stored[key];
    if (fromUrl[key]) attribution[key] = fromUrl[key];
  });
  const initial = consent();
  restore(UTM_KEYS);
  if (initial.ads) restore(AD_KEYS);
  if (initial.analytics) Object.values(GA_FIELDS).forEach(([key, format]) => { if (format.test(stored[key])) attribution[key] = stored[key]; });
  // Quita lo que el consentimiento vigente no permite (también lo guardado antes de revocar).
  const enforce = () => {
    const granted = consent();
    if (!granted.ads) AD_KEYS.forEach(key => delete attribution[key]);
    if (!granted.analytics) Object.values(GA_FIELDS).forEach(([key]) => delete attribution[key]);
  };
  const save = () => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution)); } catch (e) { /* sin storage: solo esta página */ } };
  enforce();
  save();

  // Enlaces de checkout con su href original, para reconstruirlos siempre desde el destino real.
  const checkouts = new Map();
  document.querySelectorAll('a[href]').forEach(link => {
    let url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch (e) { return; }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.systeme.io') || !url.pathname.startsWith('/checkout')) return;
    checkouts.set(link, url.href);
  });
  const apply = link => {
    const url = new URL(checkouts.get(link));
    Object.keys(attribution).forEach(key => url.searchParams.set(key, attribution[key]));
    if (consent().ads) url.searchParams.set(AD_CONSENT_PARAM, AD_CONSENT_GRANTED);
    if (link.href !== url.href) link.href = url.href;
  };
  const applyAll = () => checkouts.forEach((_, link) => apply(link));
  applyAll();

  // Identificadores de GA4. Si gtag.js no carga o no responde, el callback nunca llega.
  // Solo se aceptan valores que coinciden con las cookies propias de GA4 (nunca un id temporal).
  const gaCookies = () => {
    const jar = {};
    document.cookie.split(';').forEach(part => { const i = part.indexOf('='); jar[part.slice(0, i).trim()] = part.slice(i + 1).trim(); });
    return {
      client_id: (jar._ga || '').split('.').slice(2).join('.'),
      session_id: ((jar['_ga_' + GA_ID.slice(2)] || '').match(/^GS\d\.\d\.s?(\d+)/) || [])[1] || ''
    };
  };
  let gaPending = 0;
  let gaRequested = false;
  let gaGeneration = 0;
  const waiters = [];
  const release = () => { if (gaPending === 0) waiters.splice(0).forEach(fn => fn()); };
  // Se piden una vez por página: al cargar o cuando se acepta después (consent.js carga GA4
  // antes de avisar el cambio, así gtag ya existe). Al revocar, se invalidan los callbacks pendientes.
  const requestGaIds = () => {
    if (gaRequested || !consent().analytics || typeof window.gtag !== 'function') return;
    gaRequested = true;
    const generation = gaGeneration;
    Object.keys(GA_FIELDS).forEach(field => {
      const [key, format] = GA_FIELDS[field];
      gaPending++;
      try {
        window.gtag('get', GA_ID, field, value => {
          if (generation !== gaGeneration) return;
          // Valor ausente, inválido o no persistido: no se inventa ni se reutiliza uno anterior.
          const id = String(value);
          if (consent().analytics && format.test(id) && id === gaCookies()[field]) attribution[key] = id; else delete attribution[key];
          save();
          applyAll();
          gaPending--;
          release();
        });
      } catch (e) { gaPending--; release(); }
    });
  };
  requestGaIds();

  if (window.ptrConsent) {
    window.ptrConsent.onChange(granted => {
      if (!granted.analytics) {
        gaGeneration++;
        gaRequested = false;
        gaPending = 0;
      }
      if (granted.ads) AD_KEYS.forEach(key => { if (fromUrl[key]) attribution[key] = fromUrl[key]; });
      enforce();
      save();
      applyAll();
      release();
      requestGaIds();
    });
  }

  const hasGaIds = () => Object.values(GA_FIELDS).every(([key]) => attribution[key]);
  // gtag.js no pudo descargarse (bloqueador o red): no tiene sentido esperar.
  const gaBlocked = () => Boolean(window.ptrConsent && window.ptrConsent.gaStatus() === 'error');

  let navigating = false;
  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link || !checkouts.has(link) || event.defaultPrevented) return;
    if (navigating) { event.preventDefault(); return; }
    // Ctrl/Shift/Cmd+clic abren otra pestaña o ventana: no se pueden demorar; usan lo disponible.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!gaPending || hasGaIds() || !consent().analytics || gaBlocked()) return;
    event.preventDefault();
    navigating = true;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      navigating = false;
      apply(link);
      location.assign(link.href);
    };
    waiters.push(go);
    setTimeout(go, GA_WAIT_MS);
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
