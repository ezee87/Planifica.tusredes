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

## Medición

GA4 (`G-CMX0YC67EN`), Microsoft Clarity (`zcrndukdg8`) y el píxel de TikTok (`DBMH8CJC77U4J2JR0CI0`) se cargan y operan en cada visita, sin banner ni consentimiento previo. `analytics.js` los inicializa (va con `defer`, antes de `landing-final.js`):

| Herramienta | Configuración |
| --- | --- |
| GA4 | `analytics_storage: granted` desde el inicio; `ad_storage`, `ad_user_data` y `ad_personalization` siguen en `denied` (no hay Google Ads). Un solo `config`, con la URL (y sus UTM) ya cargada. |
| Clarity | `consentv2` con `ad_Storage` y `analytics_Storage` en `granted` antes de descargar el tag; `track` queda como lo define el proyecto. |
| TikTok Pixel | `enableCookie()` y `grantConsent()` antes del primer `page()`. |

`landing-final.js` envía `begin_checkout` (GA4) e `InitiateCheckout` (TikTok) al hacer clic en los botones de Mercado Pago y PayPal (doble clic deduplicado durante 2 segundos), y agrega al enlace de checkout de Systeme.io: UTM, `ttclid`, `fbclid`, `gclid`, `ad_consent=granted`, `ga_client_id` y `ga_session_id`. Si un clic ocurre antes de que GA4 entregue los identificadores, se espera como máximo 1 segundo y se navega igual.

`Purchase` sigue exclusivamente en Apps Script, con su deduplicación existente.

La CSP (`scripts/build.mjs` la genera y sincroniza en `vercel.json` y `_headers`) permite la recolección de las tres herramientas: subdominios de `google-analytics.com` y `analytics.google.com`, `*.clarity.ms` (incluido `c.clarity.ms/c.gif`), `c.bing.com`, `worker-src blob:` para Clarity y `analytics.tiktok.com`. Los scripts inline pasan solo por hash; no se usa `unsafe-inline` para scripts.

Cómo comprobar cada una (en la landing publicada, desde un celular o con emulación móvil, abriéndola con `?utm_source=tiktok&utm_medium=paid&utm_campaign=prueba`):

- **GA4:** en Network, `g/collect` con `gcs=G101` y cookie `_ga`. Para DebugView, agregar `debug_mode` solo durante la prueba y quitarlo después.
- **Clarity:** `clarity.ms/collect` responde 204 y aparecen las cookies `_clck` y `_clsk`; la sesión aparece en el panel de Clarity.
- **TikTok:** `api/v2/pixel` con `LandingPageView` y `Pageview`, y `InitiateCheckout` al hacer clic en un botón de pago. Confirmar en TikTok Events Manager.

`npm test` usa proveedores y checkouts simulados e intercepta las solicitudes externas. Cubre la medición en la primera visita sin banner, `begin_checkout` e `InitiateCheckout` por clic, la atribución a ambos checkouts, GA4 lento o bloqueado, almacenamiento bloqueado, la CSP, accesibilidad y anchos de 320 a 1920 px. No confirma recepción en los paneles de producción ni modifica servicios externos.

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
