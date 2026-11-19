# Planifica tus redes

Landing estática en español, con recursos locales y formulario de contacto de Netlify.

## Desarrollo y validación

Requiere Node.js 22 o posterior y Google Chrome para la auditoría.

```sh
npm ci
npm run build
npm test
```

El build genera `dist/`, copia únicamente recursos públicos y calcula los hashes CSP de los scripts inline. La auditoría comprueba navegación, vistas móviles, páginas legales y el formulario con respuestas simuladas; guarda resultados en `auditoria/`. No envía consultas reales.

## Consentimiento y medición

El bloqueo anterior era Consent Mode básico: `consent.js` no descargaba GA4, Clarity ni TikTok hasta aceptar. Además, `begin_checkout` exigía consentimiento analítico y la revocación recargaba la página, reiniciando etiquetas y visitas.

| Herramienta | Sin aceptar / al rechazar | Con consentimiento |
| --- | --- | --- |
| GA4 | Consent Mode avanzado: señales de `page_view` y `begin_checkout` sin cookies analíticas. | Cookies e identificadores reales de navegador y sesión; atribución al checkout existente. |
| Clarity | Interacciones y visitas sin cookies persistentes; identificadores por página e informes limitados. | Cookies analíticas para reconocer sesiones y visitas recurrentes. |
| TikTok Pixel | Sin decisión: arranque inmediato con cookies propias deshabilitadas y un `PageView`; el SDK genera `LandingPageView`. Un rechazo vigente impide cargarlo; rechazar en la página detiene eventos futuros. | Habilita cookies propias e `InitiateCheckout` por clic válido; doble clic deduplicado durante 2 segundos. Aceptar no repite la visita. |

GA4 y Clarity reciben permisos denegados antes de inicializarse. El tag real de Clarity puede anteponer un arranque con `track:true` a su cola: el cargador fuerza `track:false` y deja que `consentv2` habilite las cookies después. La CSP permite la recolección de Clarity exclusivamente en `/collect` y bloquea la sincronización publicitaria (`c.clarity.ms/c.gif`, `c.bing.com`). Ese bloqueo puede aparecer en la consola como una infracción CSP esperada; no bloquea la analítica. Los permisos publicitarios de Google y Microsoft permanecen denegados incluso al aceptar TikTok.

Los cambios de consentimiento no recargan ni reconfiguran las etiquetas. Al revocar se limpian cookies e identificadores accesibles, se invalidan respuestas GA4 pendientes y se actualizan ambos checkouts. Una nueva aceptación vuelve a solicitar los identificadores. La preferencia versión 2 dura seis meses y vuelve a mostrar el aviso a quienes tenían la política anterior.

El SDK real de TikTok puede volver a escribir `ttcsid` durante interacciones posteriores a `revokeConsent()` y `disableCookie()`. Un SDK descargado con retraso también puede procesar un permiso que ya fue revocado. Por eso, antes de cargar las herramientas se protegen sus cookies opcionales conocidas y la escritura de sus identificadores locales: se permiten borrados y escrituras con consentimiento vigente, y se impide crear o recrear identificadores sin aceptación. Las demás cookies y claves conservan su acceso normal. Si el navegador no admite esa protección, las herramientas de medición no se inician. TikTok no recibe `grantConsent()` mientras el visitante no haya aceptado; el envío inicial usa el comportamiento de arranque inmediato del SDK.

`Purchase` sigue exclusivamente en Apps Script, con su deduplicación existente. No se cambiaron ese archivo, los destinos de Systeme.io, los IDs ni los contratos de GA4/TikTok Events API. `ga_client_id` y `ga_session_id` siguen viajando solo con consentimiento analítico; `ttclid`, `fbclid`, `gclid` y `ad_consent=granted`, solo con consentimiento publicitario. Las UTM conservan su flujo existente.

Sin cookies propias no significa sin tratamiento de datos ni una exención legal automática: Google, Microsoft y TikTok reciben información técnica y de uso. En TikTok, deshabilitar cookies propias no garantiza que el navegador omita cookies de terceros existentes. El envío inicial incluye la URL y sus parámetros y no equivale a una visita anónima. Esta configuración no certifica una base jurídica para todos los países. Tampoco recupera todos los usuarios, sesiones o conversiones observadas: el modelado de GA4 depende de la elegibilidad y el volumen de la propiedad; Clarity pierde continuidad entre páginas. Las compras sin los identificadores/consentimientos exigidos por el servidor mantienen las exclusiones existentes.

Referencias oficiales: [Consent Mode de Google](https://developers.google.com/tag-platform/security/concepts/consent-mode), [API consentv2 de Clarity](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2), [límites de Clarity sin cookies](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-without-cookie-consent), [consentimiento de TikTok Pixel](https://ads.tiktok.com/resources/help/article/how-to-use-cookies-with-tiktok-pixel) y [requisitos del modelado de GA4](https://support.google.com/analytics/answer/11161109?hl=en).

`npm test` usa proveedores y checkouts simulados e intercepta las solicitudes externas. Cubre la primera visita, decisiones por categoría, revocación y nueva aceptación, duplicaciones, callbacks tardíos, atribución, almacenamiento bloqueado, accesibilidad y anchos de 320 a 1920 px. No confirma recepción en los paneles de producción ni modifica servicios externos.

La verificación adicional usa los scripts oficiales descargados de GA4, Clarity y TikTok e intercepta toda recolección. Comprueba `LandingPageView` y `Pageview` reales de TikTok antes de aceptar, ausencia de cookies propias e identificadores locales, señales GA4 con `gcs=G100`, y ausencia de solicitudes nuevas a TikTok después de rechazar e interactuar. También comprueba que aceptar no repita la visita y que un doble clic posterior produzca un solo InitiateCheckout. Los borrados de cookies que realiza `disableCookie()` están permitidos. El detalle local está en `auditoria/vendor-results.json` (ignorado por Git). Las 30 pruebas en memoria de `runAllTests()` del Apps Script existente también se verifican sin enviar compras reales.

## Publicación en Netlify

Importar este repositorio y usar la configuración de `netlify.toml`: comando `npm run build`, directorio público `dist`. Usar Node.js 22 o posterior. Netlify procesa `_redirects`, `_headers` y el formulario HTML de contacto. Verificar la detección del formulario `contacto` y configurar sus notificaciones en el panel de Netlify.

El servidor de producción debe soportar las reglas de Netlify: un servidor estático básico no procesa los formularios ni las rutas legales sin extensión. Los enlaces de pago y el píxel de TikTok mantienen la configuración existente.

No se versionan compilaciones, archivos ZIP, informes de auditoría, credenciales ni configuración local de Netlify.

## Publicación en Vercel

La landing usa `https://planificatusredes-steel.vercel.app/`; la aplicación es un proyecto independiente. `vercel.json` define el framework estático, `npm run build -- --vercel`, la salida `dist`, las rutas legales y las cabeceras de seguridad. Node.js queda fijado en 22.x. Hacer push a `main` dispara el despliegue si la integración Git está activa; desplegar el último commit, no repetir el despliegue del commit anterior.

El formulario usa `/api/contacto`, una reescritura hacia el receptor existente en `https://planificatusredes.netlify.app/`. Mantener ese sitio y Netlify Forms activos, con el formulario `contacto` y sus notificaciones configuradas. En el dominio original de Netlify se conserva el POST directo. Las pruebas interceptan los envíos: no verifican entrega real de correo.

El build local sincroniza automáticamente los hashes CSP de `_headers` y `vercel.json`. Ejecutarlo antes de preparar los cambios para Vercel. Como Vercel lee su configuración antes del build, el build remoto falla si detecta hashes obsoletos. La salida para Vercel excluye `_headers` y `_redirects`; `npm run build` conserva la salida compatible con Netlify.

Canonical, Open Graph, sitemap y robots usan el nuevo dominio. `_headers` añade `X-Robots-Tag: noindex, follow` exclusivamente en Netlify, sin redirigir ni bloquear el receptor de formularios; se aplicará cuando se actualice ese sitio. No configurar redirecciones generales sobre el receptor.

Sin JavaScript, contacto muestra el correo de soporte y oculta el formulario para evitar un POST a una página estática. Las pruebas cubren errores HTTP, fallas de red, éxito, campos, honeypot y envíos duplicados con respuestas simuladas; no prueban recepción real ni correo.
