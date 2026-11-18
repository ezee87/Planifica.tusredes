// Consentimiento de cookies (Consent Mode básico).
// GA4, Microsoft Clarity y el píxel de TikTok NO se descargan ni se ejecutan hasta que la persona
// acepta la categoría correspondiente. Sin una decisión válida, todo lo opcional queda denegado.
// - Analíticas: Google Analytics 4 y Microsoft Clarity.
// - Publicitarias: píxel de TikTok.
// La elección se guarda en localStorage ("ptr_consent", versión y fecha) durante 6 meses.
// Si localStorage falla, se aplica la denegación y la elección vale solo para la página abierta.
// API para landing-final.js: window.ptrConsent.get(), onChange(fn), gaStatus() y open().
// Va antes de landing-final.js (ambos con defer): así la API ya existe cuando se usa.
(() => {
  'use strict';
  const STORAGE_KEY = 'ptr_consent';
  const VERSION = 1;
  const MAX_AGE_MONTHS = 6;
  const GA_ID = 'G-CMX0YC67EN';
  const TIKTOK_PIXEL_ID = 'DBMH8CJC77U4J2JR0CI0';
  const CLARITY_ID = 'zcrndukdg8';
  const DENIED = Object.freeze({analytics: false, ads: false});

  // Cookies e identificadores propios de cada herramienta, para limpiarlos al revocar.
  // Las cookies que cada proveedor guarda en su propio dominio no son accesibles desde aquí.
  const CLEANUP = {
    analytics: {cookies: /^(?:_ga(?:_.+)?|_gid|_gat(?:_.+)?|_clck|_clsk)$/, storage: /^(?:_clck|_clsk)$/},
    ads: {cookies: /^(?:_ttp|_tt_enable_cookie|ttcsid(?:_.+)?|_ttclid|ttclid)$/, storage: /^(?:tt_|_tt)/}
  };

  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || raw.v !== VERSION || typeof raw.analytics !== 'boolean' || typeof raw.ads !== 'boolean') return null;
      const saved = new Date(raw.ts);
      if (isNaN(saved.getTime())) return null;
      const expires = new Date(saved.getTime());
      expires.setMonth(expires.getMonth() + MAX_AGE_MONTHS);
      const now = Date.now();
      // Fecha futura (reloj alterado) o vencida: no es una decisión válida.
      if (saved.getTime() > now + 86400000 || now >= expires.getTime()) return null;
      return {analytics: raw.analytics, ads: raw.ads};
    } catch (e) {
      return null;
    }
  };

  const write = choice => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({v: VERSION, analytics: choice.analytics, ads: choice.ads, ts: new Date().toISOString()}));
      return true;
    } catch (e) {
      return false; // sin almacenamiento: la elección vale solo para esta página
    }
  };

  const stored = read();
  let decided = Boolean(stored);
  let current = stored || DENIED;
  const loaded = {ga: false, clarity: false, tiktok: false};
  let gaStatus = 'idle'; // idle | loading | loaded | error
  const listeners = [];

  window.ptrConsent = Object.freeze({
    get: () => ({analytics: current.analytics, ads: current.ads}),
    decided: () => decided,
    onChange: fn => { if (typeof fn === 'function') listeners.push(fn); },
    gaStatus: () => gaStatus,
    open: () => { if (ui) show(true, null); }
  });

  /* ---------- Carga de herramientas (una sola vez por página) ---------- */

  const inject = (src, onload, onerror) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    if (onload) script.addEventListener('load', onload);
    if (onerror) script.addEventListener('error', onerror);
    document.head.appendChild(script);
  };

  const loadGA = () => {
    if (loaded.ga) return;
    loaded.ga = true;
    gaStatus = 'loading';
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    // Estado predeterminado denegado antes de cualquier inicialización; luego, la elección.
    // Los permisos publicitarios de Google siguen denegados: el banner no los solicita.
    window.gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    inject('https://www.googletagmanager.com/gtag/js?id=' + GA_ID, () => { gaStatus = 'loaded'; }, () => { gaStatus = 'error'; });
  };

  const loadClarity = () => {
    if (loaded.clarity) return;
    loaded.clarity = true;
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    inject('https://www.clarity.ms/tag/' + CLARITY_ID);
    // Señal de consentimiento para Clarity: analítica concedida, publicidad de Microsoft denegada.
    window.clarity('consentv2', {ad_Storage: 'denied', analytics_Storage: 'granted'});
  };

  // Código base oficial del píxel de TikTok, ejecutado solo con consentimiento publicitario.
  const loadTikTok = () => {
    if (loaded.tiktok) return;
    loaded.tiktok = true;
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
      var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script")
      ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
      ttq.load(TIKTOK_PIXEL_ID);
      ttq.page();
    }(window, document, 'ttq');
  };

  /* ---------- Revocación y limpieza ---------- */

  const cookieDomains = () => {
    const parts = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < parts.length - 1; i++) domains.push(parts.slice(i).join('.'));
    return domains;
  };

  const clean = category => {
    const rules = CLEANUP[category];
    document.cookie.split(';').forEach(part => {
      const name = part.split('=')[0].trim();
      if (!name || !rules.cookies.test(name)) return;
      cookieDomains().forEach(domain => {
        document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
      });
    });
    ['localStorage', 'sessionStorage'].forEach(area => {
      try {
        const store = window[area];
        Object.keys(store).filter(key => rules.storage.test(key)).forEach(key => store.removeItem(key));
      } catch (e) { /* almacenamiento no disponible */ }
    });
  };

  // Detiene de inmediato lo que esté cargado en esta página (después se recarga igual).
  const stop = category => {
    try {
      if (category === 'analytics') {
        if (loaded.ga) {
          window['ga-disable-' + GA_ID] = true; // corte oficial de envíos de GA4
          window.gtag('consent', 'update', {analytics_storage: 'denied'});
        }
        if (loaded.clarity) window.clarity('consentv2', {ad_Storage: 'denied', analytics_Storage: 'denied'});
      } else if (loaded.tiktok && window.ttq) {
        window.ttq.revokeConsent();
        window.ttq.disableCookie();
      }
    } catch (e) { /* la limpieza continúa igual */ }
    clean(category);
  };

  const apply = next => {
    current = {analytics: Boolean(next.analytics), ads: Boolean(next.ads)};
    if (!current.analytics) stop('analytics');
    if (!current.ads) stop('ads');
    // Una herramienta ya ejecutada no puede descargarse: recargar garantiza que no envíe nada más.
    const mustReload = (!current.analytics && (loaded.ga || loaded.clarity)) || (!current.ads && loaded.tiktok);
    if (!mustReload) {
      if (current.analytics) { loadGA(); loadClarity(); }
      if (current.ads) loadTikTok();
    }
    listeners.forEach(fn => { try { fn(window.ptrConsent.get()); } catch (e) { /* un oyente no frena a los demás */ } });
    if (mustReload) location.reload();
  };

  // Estado inicial: lo denegado se limpia (restos de una decisión vencida o revocada).
  if (!current.analytics) clean('analytics');
  if (!current.ads) clean('ads');
  if (current.analytics) { loadGA(); loadClarity(); }
  if (current.ads) loadTikTok();

  // Cambio de elección en otra pestaña del mismo sitio.
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const next = read();
    decided = Boolean(next);
    if (ui) { if (decided) hide(); else show(false, null); }
    apply(next || DENIED);
  });

  /* ---------- Banner ---------- */

  const banner = document.getElementById('cookie-banner');
  const ui = banner && {
    prefs: banner.querySelector('#cookie-prefs'),
    analytics: banner.querySelector('#cookie-analytics'),
    ads: banner.querySelector('#cookie-ads'),
    configure: banner.querySelector('[data-consent="configure"]'),
    save: banner.querySelector('[data-consent="save"]')
  };
  let returnFocus = null;

  // Reserva espacio al final de la página para que el banner no tape el pie.
  const reserveSpace = () => {
    document.documentElement.style.setProperty('--cookie-space', banner.hidden ? '0px' : banner.offsetHeight + 24 + 'px');
  };

  const expand = open => {
    ui.prefs.hidden = !open;
    ui.configure.hidden = open;
    ui.save.hidden = !open;
    ui.configure.setAttribute('aria-expanded', String(open));
    reserveSpace();
  };

  function show(expanded, opener) {
    returnFocus = opener || null;
    ui.analytics.checked = current.analytics;
    ui.ads.checked = current.ads;
    banner.hidden = false;
    document.documentElement.classList.add('cookie-banner-open');
    expand(Boolean(expanded));
    if (expanded) ui.analytics.focus();
  }

  function hide() {
    banner.hidden = true;
    document.documentElement.classList.remove('cookie-banner-open');
    reserveSpace();
  }

  const choose = choice => {
    write(choice);
    decided = true;
    const target = returnFocus;
    hide();
    // El foco no queda en un botón oculto: vuelve al enlace del pie o al contenido.
    const focusTarget = target && target.isConnected ? target : document.getElementById('contenido');
    if (focusTarget) focusTarget.focus({preventScroll: true});
    apply(choice);
  };

  if (ui) {
    banner.addEventListener('click', event => {
      const button = event.target.closest('[data-consent]');
      if (!button) return;
      const action = button.dataset.consent;
      if (action === 'accept') choose({analytics: true, ads: true});
      else if (action === 'reject') choose(DENIED);
      else if (action === 'save') choose({analytics: ui.analytics.checked, ads: ui.ads.checked});
      else if (action === 'configure') { expand(true); ui.analytics.focus(); }
    });
    // Escape cierra sin cambios solo si ya existe una decisión.
    banner.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !decided) return;
      const target = returnFocus;
      hide();
      if (target) target.focus();
    });
    document.querySelectorAll('[data-consent-open]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => show(true, button));
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (!banner.hidden) reserveSpace(); }).observe(banner);
    else window.addEventListener('resize', () => { if (!banner.hidden) reserveSpace(); });
    if (!decided) show(false, null);
  }
})();
