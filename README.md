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

`vercel.json` define el framework estático, `npm run build`, la salida `dist`, las rutas legales y las cabeceras de seguridad. Node.js queda fijado en 22.x. Hacer push a `main` dispara el despliegue si la integración Git está activa; desplegar el último commit, no repetir el despliegue del commit anterior.

El formulario usa `/api/contacto`, una reescritura hacia el receptor existente en `https://planificatusredes.netlify.app/`. Mantener ese sitio y Netlify Forms activos, con el formulario `contacto` y sus notificaciones configuradas. En el dominio original de Netlify se conserva el POST directo. Las pruebas interceptan los envíos: no verifican entrega real de correo.

Las cabeceras de Vercel deben mantenerse sincronizadas con `_headers`; si cambia un script inline, ejecutar el build y actualizar sus hashes en `vercel.json` antes del commit. Vercel no interpreta `_headers` ni `_redirects`.
