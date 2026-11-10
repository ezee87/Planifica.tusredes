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
