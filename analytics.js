// Medición: GA4, Microsoft Clarity y píxel de TikTok. Se cargan y operan siempre, en cada
// visita, sin banner ni condiciones (decisión del negocio). Va con defer, antes de landing-final.js.
// - GA4: analytics_storage concedido desde el inicio; ad_* de Google siguen denegados (no hay Google Ads).
// - Clarity: consentimiento concedido y track habilitado.
// - TikTok: cookies habilitadas y consentimiento concedido antes del primer page().
// API para landing-final.js: window.ptrAnalytics.gaStatus() → loading | loaded | error.
(() => {
  'use strict';
  const GA_ID = 'G-CMX0YC67EN';
  const TIKTOK_PIXEL_ID = 'DBMH8CJC77U4J2JR0CI0';
  const CLARITY_ID = 'zcrndukdg8';
  let gaStatus = 'loading';

  window.ptrAnalytics = Object.freeze({gaStatus: () => gaStatus});

  const inject = (src, onload, onerror) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    if (onload) script.addEventListener('load', onload);
    if (onerror) script.addEventListener('error', onerror);
    document.head.appendChild(script);
  };

  // GA4: consentimiento y configuración se encolan antes de descargar gtag.js; un solo config
  // (un solo page_view). La URL ya trae las UTM cuando esto corre.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {allow_google_signals: false, allow_ad_personalization_signals: false});
  inject('https://www.googletagmanager.com/gtag/js?id=' + GA_ID, () => { gaStatus = 'loaded'; }, () => { gaStatus = 'error'; });

  // Clarity: la decisión se encola antes de descargar el tag. El proyecto ya trae track:true.
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
  window.clarity('consentv2', {ad_Storage: 'granted', analytics_Storage: 'granted'});
  inject('https://www.clarity.ms/tag/' + CLARITY_ID);

  // TikTok: cargador oficial del píxel.
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
    var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script")
    ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
    ttq.load(TIKTOK_PIXEL_ID);
    ttq.enableCookie();
    ttq.grantConsent();
    ttq.page();
  }(window, document, 'ttq');
})();
