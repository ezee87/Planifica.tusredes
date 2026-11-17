// Dependencias de auditoría instaladas con npm ci.
const {chromium}=require('playwright');
const {default:AxeBuilder}=require('@axe-core/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../dist'), output=path.resolve(__dirname,'../auditoria');fs.mkdirSync(output,{recursive:true});
const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../vercel.json'),'utf8'));
assert.equal(config.outputDirectory,'dist');
const headers=Object.fromEntries(config.headers[0].headers.map(({key,value})=>[key,value]));
const netlifyHeaders=fs.readFileSync(path.resolve(__dirname,'../_headers'),'utf8');
const netlifyCsp=netlifyHeaders.split('\n').find(l=>l.trim().startsWith('Content-Security-Policy:')).trim().slice('Content-Security-Policy: '.length);
assert.equal(headers['Content-Security-Policy'],netlifyCsp,'Mantener sincronizada la CSP de Vercel y Netlify');
assert.equal(config.rewrites.find(r=>r.source==='/api/contacto').destination,'https://planificatusredes.netlify.app/');
assert(netlifyHeaders.includes('X-Robots-Tag: noindex, follow'));
assert(!headers['X-Robots-Tag'],'Vercel debe seguir siendo indexable');
assert(!config.redirects.some(r=>r.source==='/'||r.source.includes(':path')),'No redirigir el receptor de formularios');
const publicFiles=fs.readdirSync(root,{recursive:true}).filter(f=>fs.statSync(path.join(root,f)).isFile());
for(const file of publicFiles){
 assert(!/(^|[\\/])(?:\.|scripts|node_modules|auditoria|package(?:-lock)?\.json|vercel\.json|netlify\.toml|_headers|_redirects)/.test(file),'Archivo interno publicado: '+file);
 assert(/\.(?:html|css|js|svg|webp|png|woff2|xml|txt|webm|mp4)$/.test(file),'Extensión pública inesperada: '+file);
 if(file.endsWith('.png'))assert(/^(?:favicon-(?:32|192)|apple-touch-icon)\.png$/.test(file),'Solo se publican los íconos PNG del sitio, no los originales: '+file);
 if(/\.(?:webm|mp4)$/.test(file))assert(/^video[\\/]hero-final\.(?:webm|mp4)$/.test(file),'Solo se publican los videos definitivos del hero: '+file);
 if(file.endsWith('.html')){
  const html=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n?/g,'\n');
  assert(!html.includes('https://planificatusredes.netlify.app'),'Enlace público antiguo: '+file);
  for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))assert(netlifyCsp.includes("'sha256-"+createHash('sha256').update(match[1]).digest('base64')+"'"),'Hash CSP faltante: '+file);
 }
}
const canonicalOrigin='https://planificatusredes-steel.vercel.app';
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(sitemapUrls.length,7);assert.equal(new Set(sitemapUrls).size,7);
assert(fs.readFileSync(path.join(root,'robots.txt'),'utf8').includes('Sitemap: '+canonicalOrigin+'/sitemap.xml'));
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(name.length>1 && name.endsWith('/')){res.writeHead(308,{Location:name.slice(0,-1)});return res.end();}
 const redirect=config.redirects.find(r=>r.source===name);
 if(redirect){res.writeHead(308,{Location:redirect.destination});return res.end();}
 const rewrite=config.rewrites.find(r=>r.source===name);
 if(rewrite)name=rewrite.destination;
 if(name==='/')name='/index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){console.log('404',name);res.writeHead(404);return res.end();}
 const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain','.webm':'video/webm','.mp4':'video/mp4'}[path.extname(file)];
 const assetRule=config.headers.find(r=>r.source==='/'+name.split('/')[1]+'/:path*');
 const assetHeaders=Object.fromEntries((assetRule?.headers||[]).map(({key,value})=>[key,value]));
 res.writeHead(200,{...headers,...assetHeaders,'Content-Type':type||'text/plain'});res.end(fs.readFileSync(file));
});
let auditBrowser;
(async()=>{await new Promise(r=>server.listen(8766,'127.0.0.1',r));const browser=auditBrowser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[],results=[];
 // Ninguna prueba puede alcanzar un servicio externo ni enviar un POST real.
 const isolate=async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin==='http://127.0.0.1:8766'&&request.method()==='GET')return route.continue();
  if(url.origin==='https://analytics.tiktok.com'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:'/* Pixel aislado durante la auditoría local. */'});
  if(url.href==='https://www.googletagmanager.com/gtag/js?id=G-CMX0YC67EN'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:'/* GA4 aislado durante la auditoría local. */'});
  if(url.href==='https://www.clarity.ms/tag/zcrndukdg8'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:'/* Clarity aislado durante la auditoría local. */'});
  return route.abort('blockedbyclient');
 };
 await context.route('**/*',isolate);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text())});
 await page.goto('http://127.0.0.1:8766/');
 assert.equal(await page.locator('script[src*="clarity.ms/tag/"]').count(),1,'Una sola etiqueta de Clarity');
 assert.equal(await page.locator('script[src*="clarity.ms/tag/"]').getAttribute('src'),'https://www.clarity.ms/tag/zcrndukdg8');
 assert(await page.locator('script[src*="clarity.ms/tag/"]').evaluate(script=>script.async&&script.parentElement===document.head));
 assert.equal(await page.evaluate(()=>typeof window.clarity),'function','Clarity convive con GA4 y TikTok');
 assert.equal(await page.locator('script[src*="/gtag/js"]').count(),1,'Una sola etiqueta de GA4');
 assert.equal(await page.locator('script[src*="/gtm.js"]').count(),0,'Sin Google Tag Manager');
 assert.equal(await page.locator('script[src*="/gtag/js"]').getAttribute('src'),'https://www.googletagmanager.com/gtag/js?id=G-CMX0YC67EN');
 assert.equal(await page.locator('script[src*="/gtag/js"]').getAttribute('async'),'');
 assert.deepEqual(await page.evaluate(()=>window.dataLayer.map(entry=>Array.from(entry)).filter(entry=>entry[0]==='config')),[['config','G-CMX0YC67EN']],'Una sola configuración: page_view automático');
 assert(await page.evaluate(()=>window.dataLayer.some(entry=>entry[0]==='js'&&entry[1] instanceof Date)));
 assert.deepEqual(await page.evaluate(()=>Object.keys(window.ttq._i)),['DBMH8CJC77U4J2JR0CI0'],'Conservar el píxel de TikTok');
 assert.equal(await page.evaluate(()=>window.ttq.filter(entry=>entry[0]==='page').length),1);
 const cspDirectives=Object.fromEntries(netlifyCsp.split(';').map(part=>part.trim().split(/\s+/)).map(([name,...values])=>[name,values]));
 assert(cspDirectives['script-src'].includes('https://www.googletagmanager.com'));
 assert(!cspDirectives['script-src'].some(value=>['*',"'unsafe-inline'","'unsafe-eval'"].includes(value)));
 for(const directive of ['img-src','connect-src'])for(const origin of ['https://www.googletagmanager.com','https://www.google-analytics.com','https://region1.google-analytics.com'])assert(cspDirectives[directive].includes(origin),'CSP de GA4: '+directive+' '+origin);
 // Respaldo oficial de gtag.js (/g/collect en www.google.com): host exacto, sin comodines de Google.
 assert(cspDirectives['connect-src'].includes('https://www.google.com'),'CSP de GA4: connect-src https://www.google.com');
 for(const directive of Object.keys(cspDirectives))assert(!cspDirectives[directive].some(value=>/^https:\/\/\*\.google\./.test(value)),'Sin comodines de Google en '+directive);
 for(const origin of ['https://www.clarity.ms','https://scripts.clarity.ms'])assert(cspDirectives['script-src'].includes(origin),'Scripts de Clarity: '+origin);
 for(const directive of ['img-src','connect-src'])assert(cspDirectives[directive].includes('https://*.clarity.ms'),'Recolección regional de Clarity: '+directive);
 assert(cspDirectives['img-src'].includes('https://c.bing.com'),'Imagen de sincronización de Clarity');
 assert.deepEqual(cspDirectives['default-src'],["'self'"],'Conservar la política por defecto');
 // Etapa 2: orden definitivo, secciones retiradas y oferta reorganizada.
 assert.deepEqual(await page.locator('main > section').evaluateAll(s=>s.map(e=>e.id||e.className)),['hero','funcionalidades','como-funciona','precio','faq','final'],'Orden definitivo de la landing');
 assert.equal(await page.locator('.problem,.comparison,.comparison-mobile,.demo,.demo-item,.features-section').count(),0,'Comparación y capturas estáticas retiradas');
 assert.equal(await page.locator('#funcionalidades h2').textContent(),'Todo tu contenido organizado en un solo lugar');
 assert.deepEqual(await page.locator('#funcionalidades .feature h3').allTextContents(),['Planificá las publicaciones de tus clientes','Guardá tus ideas para después','Sabé qué está pendiente y qué ya publicaste']);
 assert.equal(await page.locator('#como-funciona .step').count(),3);
 assert.equal(await page.locator('#precio h2').textContent(),'Todo lo que te llevás hoy');
 assert.equal(await page.locator('#precio .section-heading .lead').innerHTML(),'Acceso completo y tres bonos incluidos.<br><strong>Pago único, sin suscripciones.</strong>','Subtítulo con salto de línea intencional');
 const offerOrder=await page.locator('#precio').evaluate(s=>['.purchase','.offer-bonuses','.guarantee-card','.offer-footnote'].map(sel=>s.querySelector(sel)).map((el,i,all)=>i===0||Boolean(all[i-1].compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)));
 assert(offerOrder.every(Boolean),'Oferta: compra, bonos, garantía e información');
 assert.equal(await page.locator('#precio .offer-product,#precio .included,#precio .purchase-highlight,#precio .purchase-app,#precio .purchase-bonuses').count(),0,'Sin bloques anteriores en la tarjeta');
 // Tarjeta «Lo que recibís»: cuatro filas con su valor, resumen, botones y garantía, en ese orden.
 assert.equal(await page.locator('.purchase-title').textContent(),'Lo que recibís');
 const rows=await page.locator('.value-row').evaluateAll(items=>items.map(li=>[li.querySelector('.value-name').textContent.replace(/\s+/g,' ').trim(),li.querySelector('.value-amount').textContent]));
 assert.deepEqual(rows,[['Planifica tus redes — Acceso completo','$28.000 ARS'],['Bono 1 30 ideas de contenido listas para adaptar','$19.000 ARS'],['Bono 2 Guía práctica de organización para community managers','$16.000 ARS'],['Bono 3 3 calendarios de contenido listos para adaptar','$19.000 ARS']],'Filas de productos y valores');
 assert.equal(rows.reduce((sum,[,amount])=>sum+Number(amount.replace(/\D/g,'')),0),82000,'El valor del conjunto es la suma de las filas');
 assert(await page.locator('.value-row').first().evaluate(e=>e.classList.contains('is-app')),'La aplicación es la fila destacada');
 const purchaseOrder=await page.locator('.purchase').evaluate(card=>['.purchase-title','.value-list','.value-total','.payment-label','.price','.foreign-price','.purchase-options','.purchase-guarantee','.purchase-help'].map(sel=>card.querySelector(sel)).every((el,i,all)=>i===0||Boolean(all[i-1].compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)));
 assert(purchaseOrder,'Productos, valor de referencia, precio, botones y garantía, en ese orden');
 assert.equal(await page.locator('.purchase-guarantee-title').textContent(),'Probala durante 7 días, sin riesgo.');
 assert.equal(await page.locator('.purchase-guarantee-text').textContent(),'Si no es lo que necesitabas, podés solicitar el reembolso dentro de los primeros 7 días.');
 assert.equal(await page.locator('.bonus-heading h3').textContent(),'Conocé los 3 bonos que recibís con tu compra');
 assert.deepEqual(await page.locator('.offer-bonuses .bonus h4').allTextContents(),['30 ideas de contenido listas para adaptar','Guía práctica de organización para community managers','3 calendarios de contenido listos para adaptar']);
 assert.deepEqual(await page.locator('.offer-bonuses .value-tag strong').allTextContents(),['$19.000 ARS','$16.000 ARS','$19.000 ARS'],'Valores de referencia de los bonos');
 assert.equal(await page.locator('.offer-bonuses .price,.offer-bonuses .button').count(),0,'Las tarjetas de bonos no repiten precio ni botones');
 assert.equal(await page.locator('.value-total del').textContent(),'$82.000 ARS');
 assert.equal(await page.locator('.value-total').count(),1,'Un solo valor de referencia del conjunto');
 assert.equal(await page.locator('.purchase .price').textContent(),'$28.000 ARS');
 assert.equal(await page.locator('.purchase .payment-label').textContent(),'TU PRECIO HOY · ARGENTINA');
 assert.equal(await page.locator('.purchase .foreign-price').textContent(),'O USD 19 para compras desde otros países.');
 assert.equal(await page.locator('.purchase-help').textContent(),'Pago seguro · Acceso por email tras la confirmación');
 assert.equal(await page.locator('.guarantee-card h3').textContent(),'Probala durante 7 días');
 assert.equal(await page.locator('.guarantee-card a').getAttribute('href'),'/legal/devoluciones');
 assert.deepEqual(await page.locator('.faq summary').allTextContents(),['¿Es un pago único?','¿Puedo gestionar varios clientes con una sola compra?','¿Cómo recibo el acceso?','¿Y si no me sirve?','¿Mis datos son privados?','¿Planifica tus redes publica automáticamente en Instagram, TikTok o Facebook?'],'Seis preguntas frecuentes');
 // Video del hero: WebM principal, MP4 alternativa, sin audio ni controles y sin precargar ningún formato.
 const heroVideo=page.locator('.hero-video');
 assert.deepEqual(await heroVideo.evaluate(v=>({muted:v.muted,loop:v.loop,playsInline:v.playsInline,controls:v.controls,preload:v.getAttribute('preload'),autoplay:v.autoplay,poster:v.getAttribute('poster'),w:v.getAttribute('width'),h:v.getAttribute('height'),sources:[...v.querySelectorAll('source')].map(s=>[s.getAttribute('data-src').split('?')[0],s.type,s.hasAttribute('src')])})),{muted:true,loop:true,playsInline:true,controls:false,preload:'none',autoplay:false,poster:'imagenes/hero-poster.webp?v=dc1403e2',w:'738',h:'1516',sources:[['video/hero-final.webm','video/webm; codecs="vp9"',false],['video/hero-final.mp4','video/mp4',false]]});
 assert.equal(await page.locator('link[rel=preload][as=image]').getAttribute('href'),await heroVideo.getAttribute('poster'),'Portada precargada: es el LCP');
 assert.equal(await page.locator('link[rel=preload][as=image]').getAttribute('fetchpriority'),'high');
 assert.equal(await page.locator('link[rel=preload][as=video],link[rel=preload][href*="/video/"]').count(),0,'Sin precarga de video');
 // Movimiento reducido (contexto de esta auditoría): queda la imagen estática y no se descarga video.
 await page.waitForTimeout(300);
 assert.equal(await heroVideo.evaluate(v=>v.currentSrc),'','Movimiento reducido: sin video');
 assert(await page.locator('.hero-media-toggle').isHidden());
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/video/')).length),0);
 await page.goto('http://127.0.0.1:8766/contacto.html');
 for(const width of [320,375,390,393,430,768,1280,1366,1440,1920]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8766/');
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode()}))});
  assert.equal(await page.locator('h1').count(),1);
  // Favicon y logo nuevos (logo-r): PNG optimizados para la pestaña y WebP para el logo visible.
  assert.deepEqual(await page.locator('link[rel=icon],link[rel=apple-touch-icon]').evaluateAll(links=>links.map(l=>[l.rel,l.getAttribute('href').split('?')[0],l.getAttribute('sizes')])),[['icon','favicon-32.png','32x32'],['icon','favicon-192.png','192x192'],['apple-touch-icon','apple-touch-icon.png',null]]);
  for(const img of await page.locator('img.logo,img.value-logo').all())assert(await img.evaluate(i=>i.complete&&i.naturalWidth===128&&i.getAttribute('src').startsWith('imagenes/logo.webp')),'Logo cargado');
  assert.equal(await page.locator('.brand .logo').count(),2,'Logo en encabezado y pie');
  assert(await page.locator('.value-total del').evaluate(e=>e.getBoundingClientRect().height<40 && getComputedStyle(e).whiteSpace==='nowrap'));
  if(width<=800){
   assert(await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height<=81));
   const toggle=page.locator('.menu-toggle');await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await toggle.evaluate(e=>e===document.activeElement));
   await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'true');await page.keyboard.press('Tab');assert(await page.locator(':focus').evaluate(e=>e.closest('#section-links')!==null));await page.keyboard.press('Escape');
  }
  // Video: proporción original, dentro del ancho y con el espacio reservado desde el primer render.
  const media=await page.locator('.hero-media').evaluate(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,left:r.left,right:r.right}});
  assert(Math.abs(media.h/media.w-1516/738)<0.01,'Proporción original del video: '+width);
  assert(media.left>=0&&media.right<=width,'Video dentro del ancho: '+width);
  // Botones de compra: lado a lado y del mismo tamaño desde 601 px; apilados en móvil.
  const [mpBox,ppBox]=await page.locator('.purchase-options .button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,w:r.width,h:r.height}}));
  if(width>600)assert(Math.abs(mpBox.top-ppBox.top)<1&&Math.abs(mpBox.w-ppBox.w)<1&&Math.abs(mpBox.h-ppBox.h)<1,'Botones horizontales e iguales: '+width);
  else assert(ppBox.top>mpBox.top+mpBox.h-1,'Botones apilados en móvil: '+width);
  const heroTops=await page.locator('.hero .eyebrow,.hero h1,.hero-stage,.hero .lead,.hero .button,.hero .trust').evaluateAll(els=>els.map(e=>[e.className||e.tagName,e.getBoundingClientRect().top]));
  const top=name=>heroTops.find(([n])=>n.includes(name))[1];
  if(width<=600)assert(top('eyebrow')<top('H1')&&top('H1')<top('hero-stage')&&top('hero-stage')<top('lead')&&top('lead')<top('button')&&top('button')<top('trust'),'Orden móvil del hero: '+width);
  else assert(media.left>width/2,'Escritorio: video a la derecha del texto');
  await page.locator('body').click({position:{x:1,y:1}});

  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  results.push({width,overflow:false,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  await page.screenshot({path:path.join(output,`landing-${width}.png`),fullPage:true});
  for(const id of ['como-funciona','funcionalidades','precio']){
   if(width<=800) await page.locator('.menu-toggle').click();
   await page.locator(`.nav-links a[href="#${id}"]`).first().click();await page.waitForTimeout(100);
   assert.equal(await page.locator('.nav-links [aria-current="location"]').getAttribute('href'),'#'+id);
   assert(await page.locator('#'+id).evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('header').getBoundingClientRect().bottom));
  }
  await page.setViewportSize({width,height:width>1050?(width>=1440?900:768):900});
  await page.locator('.nav-buy').click();await page.waitForTimeout(150);
  const arrival=await page.evaluate(()=>{const hb=document.querySelector('.site-header').getBoundingClientRect().bottom,r=s=>document.querySelector(s).getBoundingClientRect();return {header:hb,heading:r('#precio h2').top,price:r('.purchase .price').bottom,buttons:r('.purchase-options .paypal').bottom,vh:innerHeight};});
  assert(arrival.heading>=arrival.header,'«Comprar» muestra el comienzo de la oferta: '+width);
  // 1280/1366×768: el precio a la vista al llegar; desde 1440×900, la tarjeta hasta los botones.
  if(width>1050)assert((width>=1440?arrival.buttons:arrival.price)<=arrival.vh,'Escritorio: precio y compra visibles al llegar a la oferta: '+width+' '+JSON.stringify(arrival));
 }
 await page.goto('http://127.0.0.1:8766/');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('class'),'skip');await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'contenido');
 for(const summary of await page.locator('summary').all()){
  await summary.focus();await page.keyboard.press('Enter');assert(await summary.evaluate(e=>e.parentElement.open));await page.keyboard.press('Space');assert(!(await summary.evaluate(e=>e.parentElement.open)));
 }
 await page.locator('summary').first().focus();await page.keyboard.press('Shift+Tab');assert(!(await page.locator(':focus').evaluate(e=>e.tagName==='SUMMARY')));
 const hrefs=await page.locator('a').evaluateAll(links=>links.map(l=>l.getAttribute('href')));
 for(const href of hrefs.filter(h=>h.startsWith('#')))assert.equal(await page.locator(href).count(),1);
 assert.deepEqual(hrefs.filter(h=>h.startsWith('https:')),['https://soporte-planificatusredes.systeme.io/checkout-arg','https://soporte-planificatusredes.systeme.io/checkout']);
 assert.equal(await page.locator('form[name=planifica-soporte],form[name=planifica-reclamos]').count(),0);
 assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),canonicalOrigin+'/imagenes/contenido.webp');
 for(const url of sitemapUrls){
  assert(url.startsWith(canonicalOrigin+'/'));
  const response=await page.goto('http://127.0.0.1:8766'+new URL(url).pathname);assert.equal(response.status(),200);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),url);
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),url);
  for(const [key,value] of Object.entries(headers))assert.equal(response.headers()[key.toLowerCase()],value);
  for(const href of await page.locator('link[rel=icon],link[rel=apple-touch-icon]').evaluateAll(links=>links.map(l=>l.href))){const icon=await page.request.get(href);assert.equal(icon.status(),200,'Ícono accesible desde '+url+': '+href);assert.equal(icon.headers()['content-type'],'image/png');}
 }
 for(const file of publicFiles)assert.equal((await page.request.get('http://127.0.0.1:8766/'+file.replaceAll('\\','/'))).status(),200);
 for(const slug of ['terminos','licencia','privacidad','devoluciones','respaldos']){
  for(const suffix of ['', '/', '.html']){const r=await page.goto('http://127.0.0.1:8766/legal/'+slug+suffix);assert.equal(r.status(),200);assert.equal(await page.locator('main h1').count(),1);}
  const legacy=fs.readFileSync(path.join(root,'legal',slug+'.html'),'utf8');
  const legacyText=await page.evaluate(html=>Array.from(new DOMParser().parseFromString(html,'text/html').querySelector('main').querySelectorAll('h1,h2,h3,p,li'),el=>el.textContent.replace(/\s+/g,' ').trim()),legacy);
  const currentText=await page.locator('.legal-document').evaluate(el=>Array.from(el.querySelectorAll('h1,h2,h3,p,li'),node=>node.textContent.replace(/\s+/g,' ').trim()));
  assert.deepEqual(currentText,legacyText,'Versiones legales coherentes: '+slug);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({legal:slug,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 }
 await page.goto('http://127.0.0.1:8766/arrepentimiento');assert.equal(await page.locator('form').count(),1);await page.locator('button[type=submit]').click();assert.equal(await page.locator(':focus').getAttribute('id'),'email');
 await page.goto('http://127.0.0.1:8766/contacto.html');
 const form=page.locator('form[name=contacto]');assert.equal(await form.getAttribute('method'),'POST');assert.equal(await form.getAttribute('netlify'),'');
 assert.equal(await page.locator('[name=form-name]').inputValue(),'contacto');assert(await page.locator('[name=bot-field]').isHidden());
 await page.locator('button[type=submit]').click();assert.equal(await page.locator(':focus').getAttribute('id'),'email');
 assert.equal(await form.getAttribute('netlify-honeypot'),'bot-field');
 await page.goto('http://127.0.0.1:8766/contacto.html');
 for(const width of [320,375,393,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({contact:width,violations:axe.violations.map(v=>v.id)});
  await page.screenshot({path:path.join(output,`contacto-${width}.png`),fullPage:true});
 }
 assert.deepEqual(errors,[],'Sin errores de carga o ejecución antes de simular fallos de red');
 await page.locator('#nombre').fill('Prueba local');await page.locator('#email').fill('prueba@example.test');await page.locator('#motivo').selectOption({label:'Consulta general'});await page.locator('#mensaje').fill('Simulación interceptada: ñ, á, + & =; sin envío real.');
 let posts=0;let mode=422;
 await page.route('http://127.0.0.1:8766/api/contacto',async route=>{
  assert.equal(route.request().method(),'POST');posts++;const body=new URLSearchParams(route.request().postData());
  assert.equal(body.get('form-name'),'contacto');for(const key of ['nombre','email','motivo','mensaje','bot-field'])assert(body.has(key));
  assert.equal(body.get('nombre'),'Prueba local');assert.equal(body.get('email'),'prueba@example.test');assert.equal(body.get('motivo'),'Consulta general');assert.equal(body.get('mensaje'),'Simulación interceptada: ñ, á, + & =; sin envío real.');assert.equal(body.get('bot-field'),'');
  assert.equal(route.request().headers()['content-type'],'application/x-www-form-urlencoded');
  await new Promise(r=>setTimeout(r,150));
  if(mode==='network')return route.abort('failed');
  await route.fulfill({status:mode,body:'Respuesta local simulada'});
 });
 await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('No se pudo'));assert(await form.isVisible());assert.equal(posts,1);
 for(const failure of [500,'network']){mode=failure;await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('No se pudo'));assert(await form.isVisible());assert.equal(await page.locator('#email').inputValue(),'prueba@example.test');assert(!await page.locator('button[type=submit]').isDisabled());}
 mode=200;await page.locator('button[type=submit]').click();await form.evaluate(f=>f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})));await page.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('Consulta recibida'));assert.equal(posts,4);assert(await form.isHidden());
 const noJs=await browser.newContext({javaScriptEnabled:false});await noJs.route('**/*',isolate);const fallback=await noJs.newPage();await fallback.goto('http://127.0.0.1:8766/contacto.html');assert(await fallback.locator('form').isHidden());assert(await fallback.locator('noscript a[href="mailto:soporte.planificatusredes@gmail.com"]').isVisible());await noJs.close();
 results.push({form:'Campos completos, honeypot, validación, errores 422/500/red, éxito 200 y duplicados comprobados; respaldo sin JavaScript por correo. Sin POST real.',seo:sitemapUrls,publicFiles});
 assert(errors.every(message=>/^Failed to load resource: (?:the server responded with a status of (?:422|500) |net::ERR_FAILED)/.test(message)),'Solo errores de red simulados');
 assert(results.every(result=>!result.violations?.length),'Sin infracciones de accesibilidad en las vistas comprobadas');
 results.push({keyboard:'skip, 6 FAQ Enter/Space, Shift+Tab, native invalid email, pausa del video con teclado',links:hrefs,expectedFormErrors:errors});
 // Sin movimiento reducido: el video se pide recién después de "load", se reproduce y se puede pausar con teclado.
 const motion=await browser.newContext({reducedMotion:'no-preference',viewport:{width:390,height:844}});await motion.route('**/*',isolate);
 const mp=await motion.newPage();const motionErrors=[];mp.on('pageerror',e=>motionErrors.push(e.message));
 await mp.goto('http://127.0.0.1:8766/',{waitUntil:'load'});
 await mp.waitForFunction(()=>{const v=document.querySelector('.hero-video');return v.readyState>=2&&!v.paused;},null,{timeout:15000});
 assert.match(await mp.locator('.hero-video').evaluate(v=>v.currentSrc),/\/video\/hero-final\.webm\?v=557741e8$/,'WebM como fuente principal');
 const timing=await mp.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0];return {load:nav.loadEventStart,video:performance.getEntriesByType('resource').filter(e=>e.name.includes('/video/')).map(e=>[e.name.split('/').pop(),e.startTime])};});
 assert(timing.video.length>=1&&timing.video.every(([name,start])=>name.startsWith('hero-final.webm')&&start>=timing.load),'El video se descarga después de load y en un solo formato: '+JSON.stringify(timing));
 const toggleButton=mp.locator('.hero-media-toggle');assert(await toggleButton.isVisible());
 await toggleButton.focus();await mp.keyboard.press('Enter');
 assert(await mp.locator('.hero-video').evaluate(v=>v.paused));assert.equal(await toggleButton.getAttribute('aria-label'),'Reproducir la demostración');
 await mp.keyboard.press('Space');await mp.waitForFunction(()=>!document.querySelector('.hero-video').paused);assert.equal(await toggleButton.getAttribute('aria-label'),'Pausar la demostración');
 // Solo el hero: el resto ya se audita sin animaciones y aquí las apariciones están a mitad de transición.
 const motionAxe=await new AxeBuilder({page:mp}).include('.hero').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({video:'reproducción',violations:motionAxe.violations.map(v=>v.id)});
 assert.deepEqual(motionErrors,[]);assert(!motionAxe.violations.length,'Sin infracciones con el video en reproducción: '+JSON.stringify(motionAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>[n.target,n.failureSummary])}))));
 await motion.close();
 fs.writeFileSync(path.join(output,'resultados.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));await browser.close();server.close();
})().catch(async e=>{console.error(e);await auditBrowser?.close();server.close();process.exit(1)});
