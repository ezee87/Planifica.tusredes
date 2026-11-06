# Ajustes finales — 17 de octubre de 2026

Los cinco ajustes están implementados localmente y `dist/` está actualizado. No se realizó ningún despliegue, compra ni envío real de formulario.

## Cambios

1. **Contacto:** `contacto.html` contiene el formulario estático `contacto`, con POST, `data-netlify="true"`, honeypot `bot-field` oculto y fuera del foco, `form-name=contacto` y campos `nombre`, `email`, `motivo`, `mensaje`. Nombre opcional; email, motivo y mensaje obligatorios. Mantiene los textos solicitados, aviso sobre datos sensibles y enlace de regreso. `contacto.css` utiliza la paleta y tipografía existentes.
2. **Envío:** `contacto.js` envía URL-encoded al mismo origen, incluye todos los campos, bloquea envíos simultáneos y anuncia éxito solamente ante respuesta HTTP satisfactoria. Ante error conserva los datos y permite reintentar. En `file://` informa que el envío requiere el sitio publicado. Sin JS queda el POST HTML nativo y la confirmación estándar de Netlify. No hay backend, CAPTCHA ni dependencias nuevas.
3. **Navegación:** el footer lleva a `/contacto.html` y adapta el destino al abrir por doble clic. La alternativa por email en FAQ y documentos sigue disponible. El texto existente «BOTÓN DE ARREPENTIMIENTO» ahora enlaza al contacto en el documento estático y el visor. Las rutas `/arrepentimiento` y `/arrepentimiento/` redirigen al formulario público nuevo, evitando el antiguo formulario no detectable. No se reescribieron condiciones legales.
4. **Navbar mobile:** una fila con marca, Comprar y botón de menú. Hasta 360 px se prioriza el isotipo y se conserva el nombre accesible de la marca. Los tres enlaces de sección son los mismos nodos que usa desktop. El menú abre con clic/Enter/Espacio, mueve el foco al primer enlace, admite Tab y cierra con Escape, selección, clic exterior o salida del foco. Escape devuelve el foco al botón. Conserva `aria-current`, foco visible y posición bajo el header sticky. Sin JS los enlaces permanecen accesibles como alternativa desplegada.
5. **Comparación:** hasta 600 px se muestran los cuatro problemas y luego las cuatro soluciones, con un encabezado por grupo, tarjetas blanca/verde existentes y separadores. La estructura desktop permanece intacta. Las dos representaciones usan `display:none` alternativamente: no se anuncian simultáneamente ni reciben foco. No cambian las frases ni el orden dentro de cada grupo.
6. **Precio:** `$64.000 ARS` conserva valor, color, tachado y tamaño; se evita el salto de línea con `white-space:nowrap` y `flex-shrink:0`.
7. **Favicon:** SVG local con calendario blanco sobre verde y bordes redondeados, reconstruido porque la marca visible era un carácter, no un archivo SVG independiente. Referenciado en todas las páginas públicas, incluido el visor y contacto. No se cambió el logo visible. No se necesitó PNG de respaldo.

## Archivos

Nuevos: `contacto.html`, `contacto.css`, `contacto.js`, `landing-final.js`, `favicon.svg` y este informe.

Modificados: `index.html`, `audit-fixes.css`, `commercial.js` (enlace del visor), `legal/*.html` (favicon; además enlace en devoluciones), `_redirects`, `scripts/build.mjs`, `scripts/audit.cjs` y salida generada en `dist/` y `auditoria/`. `_headers` se regeneró con el build; no se debilitó la CSP ni se habilitaron scripts inline sin hash. `netlify.toml` mantiene el comando y directorio de publicación.

El build limpia exclusivamente su salida `dist/`, incluye 21 archivos públicos y excluye PNG originales no usados, informes, pruebas, respaldos, bases de datos y herramientas. Los originales siguen disponibles fuera de `dist`. La configuración `netlify.toml` se conserva en la raíz para el proceso de build, no como archivo servido a visitantes.

## Verificación

Se ejecutó `node scripts/build.mjs` y la auditoría ampliada con Chrome headless, Playwright y axe-core. Viewports: **320, 375, 393, 430, 768, 1280 y 1440 px**.

- Landing y contacto sin desborde horizontal; cero infracciones axe detectadas en los siete tamaños. También cero en los cinco documentos legales.
- Navbar mobile de una fila, altura máxima comprobada de 81 px; apertura por teclado, Escape, retorno de foco, recorrido de enlaces y navegación a las tres secciones comprobados. Indicador activo y separación del header conservados.
- Comparación mobile: dos encabezados, ocho afirmaciones; estructura desktop oculta únicamente en mobile. Precio completo en una línea en todos los tamaños.
- Formulario estático, atributos Netlify, honeypot, campos, validación nativa y acceso público comprobados. Pruebas interceptadas: HTTP 422 conserva formulario; HTTP 200 muestra confirmación; segundo intento simultáneo no produce otro POST. Todos los campos y Content-Type comprobados. El 422 que figura en el registro de consola es deliberado, generado por la simulación de error.
- Favicon responde 200 en el servidor local de pruebas y está incluido en build. Las rutas legales y anclas siguen resolviendo bajo la CSP. Los checkouts conservan exactamente sus URL; no se operaron pasarelas.
- Once FAQ abren con Enter y cierran con Espacio; salto al contenido y Shift+Tab conservados.
- Comparación del código previo: hero, mockups/galería, oferta completa, FAQ, CTA final y scripts inline idénticos; comparación desktop idéntica. Los textos de todos los documentos legales siguen iguales al retirar sus etiquetas HTML. Animaciones y reglas de movimiento reducido no se modificaron en esta intervención.

Capturas completas: `auditoria/landing-ANCHO.png` y `auditoria/contacto-ANCHO.png`. Detalles mobile: `auditoria/landing-375-detalle.png` y `auditoria/contacto-375-detalle.png`. Resultados: `auditoria/resultados.json` y `auditoria/regresion-final.json`. Se revisó visualmente el encabezado compacto, hero y contacto mobile. Las capturas completas permiten revisar el resto de la página en desktop y mobile.

No se comprobó recepción real en Netlify, entrega de notificaciones, lectores de pantalla, dispositivos físicos ni otros motores de navegador. Una simulación HTTP satisfactoria no demuestra que Netlify haya detectado o almacenado el formulario.

## Publicación y comprobación posterior

1. Antes de publicar, habilitar la detección de formularios en el panel del sitio Netlify. El formulario se detecta durante el despliegue al analizar el HTML estático. [Configuración oficial](https://docs.netlify.com/manage/forms/setup/).
2. Ejecutar `node scripts/build.mjs` y revisar `dist/`. En un despliegue desde repositorio, conservar `netlify.toml`; para publicación manual, seleccionar únicamente `dist/`. No se ejecutó este paso remoto.
3. Después del despliegue autorizado, confirmar que `contacto` aparece en Forms y revisar los campos detectados. Abrir `/contacto.html`, los enlaces de footer/devoluciones y `/arrepentimiento`; comprobar favicon y cabeceras.
4. Realizar entonces un único envío real de prueba con datos no sensibles y un email controlado. Confirmar tanto la pantalla de éxito como la entrada en Forms; revisar también spam si no aparece. No basta con observar un HTTP 200.
5. Configurar la notificación al correo que corresponda y verificar que llegue. La página no configura automáticamente las notificaciones del panel. [Notificaciones oficiales](https://docs.netlify.com/manage/forms/notifications/).
6. Confirmar que el equipo atiende consultas y devoluciones dentro del plazo comunicado. No se implementó procesamiento automático de reembolsos.

El informe de auditoría anterior se conserva como registro histórico; los pendientes sobre falta de un formulario estático y acceso público ahora tienen implementación local. Su validación operativa sigue pendiente del despliegue y la prueba real autorizados.
