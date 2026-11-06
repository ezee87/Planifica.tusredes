# Auditoría de Planifica tus Redes

Fecha: 17 de octubre de 2026. Cambios locales; no se publicó en Netlify ni se realizaron transacciones, envíos de formularios o pruebas de carga.

## Resultado y alcance

Se revisaron todos los HTML, CSS y JavaScript públicos, imágenes, rutas y configuración disponibles. Es una landing estática sin dependencias de producción, fuentes remotas, analítica, funciones serverless ni procesamiento remoto de imágenes. La aplicación vendida y las automatizaciones de compra no están en este proyecto; sus prestaciones no pueden certificarse desde esta landing.

Se conservaron el copy completo (comparación de `body.innerText`), precios, valores de referencia, bonos, orden y estructura de secciones, tarjeta de compra, fuentes, paleta y enlaces de pago. Las alturas de todas las secciones en desktop son iguales al original. Los cinco documentos legales HTML y los textos legales incluidos en JavaScript permanecen intactos. Se ajustó únicamente la resolución de recursos en la plantilla técnica `legal/index.html`.

Excepciones técnicas explícitas: el navbar se adapta en varias filas en mobile para evitar desborde y mantener todos los enlaces; el foco usa los colores existentes sobre un halo claro; las animaciones decorativas conservan sus formas y efectos, pero terminan a los cinco segundos para no requerir un control de pausa (WCAG 2.2.2). Se mantiene `prefers-reduced-motion`, el hover y las transiciones de navegación. No se afirma que las animaciones estén completamente inalteradas.

## Hallazgos y correcciones

| Severidad | Hallazgo | Resolución |
| --- | --- | --- |
| Alta, pendiente | El mecanismo de arrepentimiento descrito en los documentos no tiene enlace directo en la landing. Su formulario se genera con JS y no existe una declaración HTML estática para detección de Netlify Forms. | Requiere revisar la configuración de Forms y la exposición del mecanismo antes del lanzamiento. No se agregaron formularios ni se alteraron textos legales. No se confirmó recepción ni notificaciones. |
| Media | Navbar de 449 px en viewport de 375 px: una regla final `inline-flex` anulaba la ocultación mobile y causaba desborde. | Ajuste localizado con flex-wrap, conserva destinos y todos los enlaces; sin menú nuevo. |
| Media | Ausencia de CSP, protección contra embedding y otras cabeceras en proyecto y respuesta publicada inspeccionada. | `_headers`: CSP con hashes de scripts inline, `nosniff`, `DENY`, política de referente y permisos restringidos. |
| Media | Animación decorativa infinita sin control de pausa. | Un ciclo de cinco segundos; sin animación cuando se solicita movimiento reducido. |
| Media | Imágenes originales sumaban 4.332.327 bytes. | WebP sin pérdida, mismas dimensiones y píxeles RGBA; se conservan originales. |
| Media, preventiva | La raíz contiene `.netlify/db`, archivos internos y ahora evidencias que no deben publicarse. No se constató exposición remota. | Build con lista explícita de archivos públicos y `publish = "dist"`; `.gitignore` excluye datos internos. |
| Baja | El visor legal creaba `<base>` con JS; el precargador intentaba descargar CSS/JS desde rutas inexistentes. | Base declarada antes de los recursos, manteniendo adaptación para apertura local. Desaparecen los 404 de recursos del visor. |
| Baja | Desplazamiento a anclas sumaba `scroll-padding` y `scroll-margin`; foco de algunos controles tenía poca diferenciación sobre fondos oscuros. | Un único desplazamiento dependiente de la altura real del header y foco de dos tonos existentes. |
| Baja | Consulta del mapa de documentos permitía claves heredadas como `constructor`. | Verificación de propiedad propia antes de renderizar. Previene error de robustez; no se detectó un XSS explotable. |

## Seguridad

No se encontraron secretos, credenciales, dependencias sospechosas, scripts desconocidos, `eval`, seguimiento ni entradas de usuario interpoladas sin escape en los archivos públicos revisados. `commercial.js` escapa Markdown antes de producir HTML; sus `innerHTML` usan textos locales o mensajes constantes. Los formularios existentes incluyen límites de longitud, validación nativa y honeypot, pero su recepción del lado servidor no está validada.

Las únicas URL HTTPS de terceros en el código son los dos enlaces de checkout de Systeme.io. Se navega en la misma pestaña; no existe `target="_blank"` que requiera `noopener`. Mercado Pago, PayPal y MailerLite se mencionan como proveedores, pero esta landing no carga sus scripts. Los enlaces `mailto:` abren el cliente de correo y no prueban que el buzón reciba mensajes.

La CSP permite recursos y POST al mismo origen y los scripts inline existentes mediante hashes SHA-256 regenerados por el build. Conserva estilos inline para no alterar la composición. Bloquea objetos, embedding, scripts inline nuevos y manejadores HTML; no bloquea navegación normal hacia los checkouts. No añade funciones de reporte ni servicios facturables. Estas cabeceras se probaron con un servidor local que reproduce las rutas y cabeceras; resta comprobar su aplicación real después de un despliegue autorizado. No equivalen a protección contra agotamiento de créditos. [Cabeceras de Netlify](https://docs.netlify.com/manage/routing/headers/).

## Pruebas realizadas

- Chrome headless real, Playwright y axe-core, instalados fuera del proyecto en una carpeta temporal. Ninguna dependencia nueva en la landing.
- Viewports de 320, 375, 768, 1280 y 1440 px: sin scroll horizontal. Axe con reglas WCAG 2 A/AA, 2.1 AA y 2.2 AA: **cero infracciones detectadas** en esos cinco tamaños y en los cinco documentos del visor legal.
- Un H1, nombres accesibles, imágenes con alt específico, SVG decorativos ocultos, landmarks y estructura de encabezados revisados. FAQ conserva `details/summary` nativos y su estado expandido.
- Tab y Enter en el salto al contenido; foco efectivo en `main`; once FAQ abren con Enter y cierran con Espacio; Shift+Tab sale hacia el enlace anterior. Navbar probado por clic en los cinco anchos: `aria-current="location"` correcto y títulos debajo del header. La implementación mantiene actualización al hacer scroll mediante listener pasivo y `requestAnimationFrame`.
- Se comprobó resolución de todas las anclas internas y de las cinco rutas legales, incluyendo variantes con barra final y `.html`, con cabeceras aplicadas. Campo de email del formulario existente recibe foco al intentar enviarlo vacío. No se envió información.
- Capturas completas en cinco tamaños y revisión visual de la composición desktop/mobile: hero, mockups, comparación, funcionalidades, pasos, compra, bonos, garantía, FAQ, cierre y footer. Capturas originales y corregidas disponibles. No se reclama igualdad píxel a píxel de las capturas del navegador; sí igualdad RGBA de los archivos de imagen decodificados, copy y geometría desktop.
- Carga con CSP: cero errores de JavaScript/consola tras corregir el visor. El navegador solicita además un favicon inexistente (404 incidental); no afecta contenido ni interacción.
- Comprobación sintáctica de JavaScript y ejecución del build satisfactorias.
- GET de baja frecuencia contra producción: landing, cinco documentos legales y ambos checkouts devolvieron **HTTP 200**, sin cambio de destino en checkouts. Evidencia en `auditoria/enlaces-publicados.json`. No se verificaron importes ni funcionamiento interno de las pasarelas.
- Movimiento reducido: `animation-name: none`. Movimiento normal: un ciclo de cinco segundos.
- Reflow equivalente a zoom 200 % y 400 % de un viewport de 1280 × 900 mediante tamaños CSS de 640 × 450 y 320 × 225: sin desborde horizontal. Esto **no es una prueba del zoom nativo de la interfaz del navegador**. A 400 % el header ocupa una parte considerable de la altura; conviene comprobar comodidad de navegación real.

Limitaciones: no se usaron NVDA/JAWS/VoiceOver, dispositivos físicos iPhone/Android ni Safari/Firefox; no se midieron Core Web Vitals de campo, LCP/CLS reales ni condiciones móviles de red. Las dimensiones explícitas de imágenes ya estaban presentes y se conservaron. Axe no certifica por sí solo cumplimiento integral de WCAG. El visor legal depende de JavaScript; con JS desactivado sus rutas reescritas no muestran el documento. Su alternativa estática existente no se cambió por la restricción sobre documentos legales.

## Rendimiento y consumo

| Recurso | Original | Optimizado |
| --- | ---: | ---: |
| Calendario | 1.293.543 B | 839.538 B |
| Banco de ideas | 1.497.118 B | 903.766 B |
| Seguimiento | 1.541.666 B | 937.430 B |
| Total imágenes únicas | 4.332.327 B | 2.680.734 B |

Reducción de imágenes: **38,1 %**, sin reducción de resolución ni compresión con pérdida. El calendario se reutiliza en hero y galería con la misma URL: no son dos archivos distintos. No hay duplicados binarios entre los tres originales. Los PNG se conservan como fuentes; los visitantes de la landing descargan WebP. Esto aumenta el tamaño del paquete de despliegue, pero reduce la transferencia por visita.

Página completa: aproximadamente **4,38 MB → 2,73 MB** de recursos sin compresión HTTP (−37,7 %). Carga principal HTML + CSS correctivo + hero: aproximadamente 0,89 MB; la carga efectiva de imágenes lazy depende de proximidad al viewport y decisión del navegador. Tres imágenes únicas, HTML y CSS suman cinco recursos, más la eventual petición de favicon; no hay llamadas a terceros durante la lectura. Se mantiene `fetchpriority="high"`, dimensiones explícitas y `decoding="async"`, además de lazy loading en la galería. No se promete mejora medida de LCP.

Imágenes: caché de navegador de siete días; HTML/CSS/JS revalidan. Al cambiar una imagen antes de esos siete días debe cambiarse su nombre/URL, ya que el nombre no tiene hash. No se usa `immutable` en archivos sin versión.

Según la documentación vigente consultada, Free tiene 300 créditos con límite estricto; producción cuesta 15 créditos por deploy, transferencia 20 créditos/GB y solicitudes 2 créditos/10.000. Los formularios son gratuitos en planes por créditos. Agotar el saldo pausa los proyectos del equipo. Como estimación, 1.000 visitas completas sin caché de 2,73 MB representan unos 54,6 créditos de transferencia más aproximadamente un crédito por solicitudes, sin contar otros sitios, deploys o consumos. No es una cuota garantizada: bots, recargas, caché y tráfico compartido cambian el resultado. [Créditos de Netlify](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/).

Free admite dos reglas de rate limiting en código por proyecto. No se activaron: sin una línea base de tráfico no puede elegirse un umbral que evite bloquear usuarios detrás de una IP compartida; además, el límite por IP no garantiza un techo global de consumo. La optimización y las cabeceras tampoco detienen una campaña distribuida de solicitudes. Revisar uso del equipo y notificaciones en el panel antes del lanzamiento. [Disponibilidad y límites](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/).

## Revisión comercial pendiente

Pago único, ausencia de suscripción obligatoria, garantía comercial de siete días, licencia individual indefinida, almacenamiento local sin sincronización y ausencia de publicación automática son coherentes entre landing y documentos disponibles. No se modificaron esas afirmaciones.

No pueden verificarse en este repositorio: entrega efectiva del código por email, funcionamiento y compatibilidad de la aplicación, disponibilidad operativa, respuesta en 48 horas, entrega de los tres bonos y fundamento comercial de sus valores de referencia. La suma aritmética es correcta: 28.000 + 13.000 + 10.000 + 13.000 = 64.000 ARS. Los documentos aclaran que el código de activación es compartido: no debe confundirse con una cuenta individual segura. Revisar que la automatización y atención reales cumplan lo prometido. Esto es una revisión de coherencia técnica, no un dictamen legal.

## Archivos y reproducción

Cambios: `index.html`, `audit-fixes.css`, ajuste de robustez en `commercial.js`, base técnica de `legal/index.html`, variante de ruta en `_redirects`, tres WebP, `_headers`, `netlify.toml`, `.gitignore` y scripts. `commercial.css`, `legal/legal.css`, cinco documentos legales y PNG originales no se alteraron.

Ejecutar `node scripts/build.mjs` antes de cualquier revisión o futuro despliegue: regenera hashes CSP y prepara `dist/`. No editar a mano los hashes. Publicar únicamente `dist/`, nunca la raíz con `.netlify/db` o evidencias. El build no publica ni invoca Netlify. Si se usa arrastrar y soltar, ejecutar primero el build y seleccionar `dist/`.

Para repetir las pruebas, instalar `playwright` y `@axe-core/playwright` en una carpeta de herramientas externa, definir `PTR_TOOLS` a esa carpeta y ejecutar `node scripts/audit.cjs` con Chrome instalado. El servidor de pruebas se limita a `127.0.0.1:8766` y no acepta POST. Las evidencias de `auditoria/` quedan fuera de la lista de publicación.
