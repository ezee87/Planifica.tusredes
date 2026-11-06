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
