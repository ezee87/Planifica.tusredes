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
 const trackerHosts=/(^|\.)(googletagmanager\.com|google-analytics\.com|tiktok\.com|tiktokw\.us|clarity\.ms)$/;
 const mainTrackerRequests=[];page.on('request',r=>{if(trackerHosts.test(new URL(r.url()).hostname))mainTrackerRequests.push(r.url());});
 await page.goto('http://127.0.0.1:8766/');
 // Medición inicial: GA4, Clarity y TikTok operan desde la primera visita, sin banner.
 assert.equal(await page.locator('#cookie-banner,[data-consent-open]').count(),0,'Sin banner de cookies');
 assert.equal(await page.locator('script[src*="clarity.ms"],script[src*="/gtag/js"]').count(),2,'GA4 y Clarity desde la primera carga');
 assert.deepEqual(await page.evaluate(()=>[typeof window.gtag,typeof window.ttq,typeof window.clarity,typeof window.dataLayer]),['function','object','function','object'],'GA4, TikTok y Clarity inicializados desde la primera carga');
 assert.deepEqual(await page.locator('script[src]').evaluateAll(s=>s.filter(e=>!e.src.startsWith('https:')).map(e=>e.getAttribute('src'))),['analytics.js','landing-final.js','design.js'],'Scripts propios conservados');
 const cspDirectives=Object.fromEntries(netlifyCsp.split(';').map(part=>part.trim().split(/\s+/)).map(([name,...values])=>[name,values]));
 assert(cspDirectives['script-src'].includes('https://www.googletagmanager.com'));
 assert(!cspDirectives['script-src'].some(value=>['*',"'unsafe-inline'","'unsafe-eval'"].includes(value)));
 // GA4: hosts exactos y subdominios de recolección (regionales y de analytics.google.com), más el respaldo en www.google.com.
 for(const directive of ['img-src','connect-src'])for(const origin of ['https://www.googletagmanager.com','https://www.google-analytics.com','https://*.google-analytics.com','https://analytics.google.com','https://*.analytics.google.com','https://www.google.com'])assert(cspDirectives[directive].includes(origin),'CSP de GA4: '+directive+' '+origin);
 // Solo esos comodines de Google: ningún host de publicidad de Google.
 for(const directive of Object.keys(cspDirectives))assert(!cspDirectives[directive].some(value=>/^https:\/\/\*\.google\./.test(value)||/doubleclick|googleadservices|googlesyndication/.test(value)),'Sin hosts de publicidad de Google en '+directive);
 for(const origin of ['https://www.clarity.ms','https://scripts.clarity.ms'])assert(cspDirectives['script-src'].includes(origin),'Scripts de Clarity: '+origin);
 for(const directive of ['img-src','connect-src'])for(const origin of ['https://*.clarity.ms','https://c.bing.com'])assert(cspDirectives[directive].includes(origin),'Clarity: '+directive+' '+origin);
 assert(cspDirectives['worker-src'].includes('blob:'),'Clarity: worker-src blob:');
 for(const directive of ['img-src','connect-src'])assert(cspDirectives[directive].includes('https://analytics.tiktok.com'),'TikTok: '+directive);
 assert(cspDirectives['connect-src'].includes('https://analytics-ipv6.tiktokw.us'),'TikTok: connect-src IPv6');
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
 assert.deepEqual(hrefs.filter(h=>h.startsWith('https:')).map(h=>h.split('?')[0]),['https://soporte-planificatusredes.systeme.io/checkout-arg','https://soporte-planificatusredes.systeme.io/checkout']);
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
 assert(mainTrackerRequests.some(url=>new URL(url).hostname==='analytics.tiktok.com'),'TikTok se carga en la primera visita');
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
 // ---------- Medición sin consentimiento (analytics.js + landing-final.js) ----------
 // Herramientas simuladas: GA4 guarda sus cookies y responde gtag('get'); TikTok y Clarity registran
 // sus llamadas. El checkout de Systeme.io se responde localmente: nada sale de la máquina.
 {
  const LANDING='http://127.0.0.1:8766/';
  const SYSTEME='https://soporte-planificatusredes.systeme.io';
  const GA_TAG='https://www.googletagmanager.com/gtag/js?id=G-CMX0YC67EN';
  const CLIENT_ID='1617605705.1794937607',SESSION_ID='1794937607',TTCLID='E.C.P.CtYBPruebaSimulada0123456789';
  const QUERY='?utm_source=tiktok&utm_medium=paid&utm_campaign=lanzamiento&ttclid='+TTCLID+'&fbclid=fb_prueba_123&gclid=gc_prueba_123';
  const fakeGa=delay=>`(function(){
var v={client_id:'${CLIENT_ID}',session_id:'${SESSION_ID}'},dl=window.dataLayer,consent='denied';window.__gaHits=[];
function h(a){if(!a)return;if(a[0]==='consent'&&a[1]==='default')consent=a[2].analytics_storage;
if(a[0]==='config'){if(consent==='granted'){document.cookie='_ga=GA1.1.${CLIENT_ID}; path=/';document.cookie='_ga_CMX0YC67EN=GS2.1.s${SESSION_ID}$o1$g0$t${SESSION_ID}$j60$l0$h0; path=/';}}
if(a[0]==='config'||a[0]==='event')window.__gaHits.push({event:a[0]==='config'?'page_view':a[1],consent:consent,cookies:document.cookie});
if(a[0]==='get'&&typeof a[3]==='function')setTimeout(function(){a[3](v[a[2]])},${delay});}
for(var i=0;i<dl.length;i++)h(dl[i]);var p=dl.push;dl.push=function(){for(var j=0;j<arguments.length;j++)h(arguments[j]);return p.apply(dl,arguments)};})();`;
  const FAKE_TT=`(function(){var q=window.ttq;window.__ttHits=[];
function h(a){if(a[0]==='page'||a[0]==='track')window.__ttHits.push(a);}
q.forEach(h);var p=q.push;q.push=function(){for(var i=0;i<arguments.length;i++)h(arguments[i]);return p.apply(q,arguments)};})();`;
  const FAKE_CLARITY=`(function(){var q=window.clarity.q||[];
function h(a){if(a[0]==='consentv2'){window.__clarityConsent=a[1];if(a[1].analytics_Storage==='granted'){document.cookie='_clck=simulado; path=/';}}}
q.forEach(h);window.clarity=function(){h(arguments)};})();`;
  let gaMode={delay:50};
  const trackerRequests=[],checkoutVisits=[];
  const trackingRoute=async route=>{
   const request=route.request(),url=new URL(request.url());
   if(trackerHosts.test(url.hostname))trackerRequests.push(url.href);
   if(url.origin===SYSTEME&&request.method()==='GET'){checkoutVisits.push(url.href);return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Checkout simulado</title>'});}
   if(url.href===GA_TAG&&request.method()==='GET'){
    const mode={...gaMode};
    if(mode.scriptDelay)await new Promise(r=>setTimeout(r,mode.scriptDelay));
    return mode.block?route.abort('blockedbyclient'):route.fulfill({contentType:'application/javascript',body:fakeGa(mode.delay)});
   }
   if(url.origin==='https://analytics.tiktok.com'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:FAKE_TT});
   if(url.href==='https://www.clarity.ms/tag/zcrndukdg8'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:FAKE_CLARITY});
   return isolate(route);
  };
  const ctx=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});await ctx.route('**/*',trackingRoute);
  const cp=await ctx.newPage();const trackingErrors=[];
  cp.on('pageerror',e=>trackingErrors.push(e.message));cp.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))trackingErrors.push(m.text()+' @ '+m.location().url)});
  const params=href=>Object.fromEntries(new URL(href).searchParams);
  const state=page=>page.evaluate(()=>{
   const dl=(window.dataLayer||[]).map(e=>Array.from(e));
   const tt=Array.isArray(window.ttq)?window.ttq:[];
   return {
    globals:[typeof window.gtag,typeof window.ttq,typeof window.clarity],
    scripts:[...document.scripts].map(s=>s.src).filter(s=>/googletagmanager|tiktok|clarity/.test(s)),
    configs:dl.filter(e=>e[0]==='config').length,
    gaHits:window.__gaHits||[],
    ttHits:window.__ttHits||[],
    ttCalls:tt.map(e=>e[0]),
    clarityConsent:window.__clarityConsent,
    consentOrder:dl.filter(e=>['consent','js','config'].includes(e[0])).map(e=>e[0]==='consent'?e[0]+':'+e[1]+':'+e[2].analytics_storage:e[0]),
    ttTracks:tt.filter(e=>e[0]==='track').length,
    beginCheckouts:dl.filter(e=>e[0]==='event'&&e[1]==='begin_checkout').length,
    cookies:document.cookie,
    attribution:(()=>{try{return sessionStorage.getItem('ptr_attribution')||''}catch(e){return ''}})(),
    links:[...document.querySelectorAll('a[data-checkout]')].map(a=>a.href)
   };
  });
  const reset=async()=>{await ctx.clearCookies();await cp.goto(LANDING);await cp.evaluate(()=>{localStorage.clear();sessionStorage.clear();});trackerRequests.length=0;checkoutVisits.length=0;gaMode={delay:50};};
  // Clic en un checkout sin salir de la página (para contar eventos).
  const clickWithoutLeaving=async(selector,double=false)=>{
   await cp.evaluate(()=>{window.__stay=e=>{if(e.target.closest('a[data-checkout]'))e.preventDefault()};window.addEventListener('click',window.__stay);});
   if(double)await cp.locator(selector).dblclick();else await cp.locator(selector).click();
   await cp.evaluate(()=>window.removeEventListener('click',window.__stay));
  };
  const base=href=>{const u=new URL(href);return u.origin+u.pathname;};
  const CHECKOUTS=[SYSTEME+'/checkout-arg',SYSTEME+'/checkout'];
  const assertLink=(href,{ga=true}={},label='')=>{
   const p=params(href);
   assert.equal(p.utm_source,'tiktok','UTM conservadas: '+label);assert.equal(p.utm_medium,'paid');assert.equal(p.utm_campaign,'lanzamiento');
   assert.equal(p.ttclid,TTCLID,'ttclid conservado: '+label);assert.equal(p.fbclid,'fb_prueba_123');assert.equal(p.gclid,'gc_prueba_123');assert.equal(p.ad_consent,'granted');
   if(ga){assert.equal(p.ga_client_id,CLIENT_ID,'ga_client_id: '+label);assert.equal(p.ga_session_id,SESSION_ID,'ga_session_id: '+label);}else assert(!('ga_client_id' in p)&&!('ga_session_id' in p),'Sin identificadores GA4 inventados: '+label);
  };
  const assertLinks=(s,opts,label)=>{
   assert.deepEqual(s.links.map(base),CHECKOUTS,'Destinos de checkout intactos: '+label);
   s.links.forEach(href=>assertLink(href,opts,label));
  };

  // Primera visita: sin banner, las tres herramientas cargadas y operando desde el inicio.
  await reset();await cp.goto(LANDING+QUERY);await cp.waitForTimeout(400);
  let s=await state(cp);
  assert.equal(await cp.locator('#cookie-banner,[data-consent-open],[data-consent]').count(),0,'Sin banner de cookies');
  assert.equal(await cp.evaluate(()=>localStorage.getItem('ptr_consent')),null,'Sin decisión de consentimiento guardada');
  assert.deepEqual(s.globals,['function','object','function']);
  assert.equal(s.scripts.filter(u=>u===GA_TAG).length+s.scripts.filter(u=>/clarity/.test(u)).length+s.scripts.filter(u=>/tiktok/.test(u)).length,3,'GA4, Clarity y TikTok una vez cada uno');
  assert(await cp.evaluate(()=>[...document.scripts].filter(e=>/googletagmanager|clarity/.test(e.src)).every(e=>e.async&&e.parentElement===document.head)));
  assert(trackerRequests.some(u=>/tiktok/.test(u)),'TikTok se carga en la primera visita');
  assert.deepEqual(s.consentOrder,['consent:default:granted','js','config'],'analytics_storage concedido antes del primer page_view');
  assert.equal(s.gaHits.length,1);assert.equal(s.gaHits[0].event,'page_view');assert.equal(s.gaHits[0].consent,'granted');
  assert.equal(s.configs,1,'Una sola configuración de GA4');
  assert(/_ga=/.test(s.cookies),'Cookies de GA4 disponibles');
  assert.deepEqual(s.clarityConsent,{ad_Storage:'granted',analytics_Storage:'granted'},'Clarity con consentimiento concedido');
  assert(/_clck=/.test(s.cookies),'Clarity registra la sesión');
  assert.equal(s.ttCalls.filter(c=>c==='grantConsent').length,1);assert.equal(s.ttCalls.filter(c=>c==='enableCookie').length,1);
  assert.equal(s.ttCalls.filter(c=>['disableCookie','revokeConsent','holdConsent'].includes(c)).length,0,'TikTok nunca se deshabilita');
  assert.deepEqual(s.ttCalls.filter(c=>['enableCookie','grantConsent','page'].includes(c)),['enableCookie','grantConsent','page'],'TikTok habilitado antes del primer page');
  assert.equal(s.ttHits.filter(h=>h[0]==='page').length,1,'Una visita enviada por TikTok');
  // Atribución: UTM, ids de clic e ids de GA4 llegan a ambos checkouts.
  assertLinks(s,{ga:true},'primera visita');
  assert(/utm_source/.test(s.attribution)&&new RegExp(TTCLID).test(s.attribution),'UTM y ttclid conservados en sessionStorage');

  // begin_checkout e InitiateCheckout salen siempre, una vez por clic, con identificador único.
  await clickWithoutLeaving('a[data-checkout="mercado_pago"]');s=await state(cp);
  assert.equal(s.beginCheckouts,1,'begin_checkout (Mercado Pago)');assert.equal(s.ttTracks,1,'InitiateCheckout (Mercado Pago)');
  assert.equal(s.gaHits.at(-1).event,'begin_checkout');assert.equal(s.gaHits.at(-1).consent,'granted');
  await cp.waitForTimeout(2100);await clickWithoutLeaving('a[data-checkout="paypal"]');s=await state(cp);
  assert.equal(s.beginCheckouts,2,'begin_checkout (PayPal)');assert.equal(s.ttTracks,2,'InitiateCheckout (PayPal)');
  await cp.waitForTimeout(2100);await clickWithoutLeaving('a[data-checkout="paypal"]',true);s=await state(cp);
  assert.equal(s.beginCheckouts,3,'Doble clic: un solo begin_checkout');assert.equal(s.ttTracks,3,'Doble clic: un solo InitiateCheckout');
  const eventIds=await cp.evaluate(()=>window.ttq.filter(e=>e[0]==='track').map(e=>e[3].event_id));
  assert.equal(new Set(eventIds).size,3,'Identificador único por inicio de compra');
  const ttPayload=await cp.evaluate(()=>window.ttq.filter(e=>e[0]==='track')[0].slice(1,3));
  assert.equal(ttPayload[0],'InitiateCheckout');assert.equal(ttPayload[1].currency,'ARS');assert.equal(ttPayload[1].value,28000);
  await cp.locator('a[data-checkout="paypal"]').evaluate(link=>{link.addEventListener('click',e=>e.preventDefault(),{once:true});link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));});
  s=await state(cp);assert.equal(s.beginCheckouts,3,'Clic sintético sin eventos');assert.equal(s.ttTracks,3);
  assert.equal(s.gaHits.filter(h=>h.event==='page_view').length,1,'page_view único');
  assert(await cp.evaluate(()=>!window.dataLayer.some(e=>e[0]==='event'&&e[1]==='purchase')&&!window.ttq.some(e=>e[0]==='track'&&e[1]==='Purchase')),'Purchase reservado al servidor existente');
  await Promise.all([cp.waitForURL(url=>url.href.startsWith(SYSTEME+'/checkout?')),cp.locator('a[data-checkout="paypal"]').click()]);
  assert.equal(base(checkoutVisits.at(-1)),CHECKOUTS[1]);assertLink(checkoutVisits.at(-1),{ga:true},'navegación PayPal');

  // Volver a la landing en la misma pestaña, sin parámetros en la URL: UTM y ttclid se conservan.
  await cp.goto(LANDING);await cp.waitForTimeout(300);s=await state(cp);
  assertLinks(s,{ga:true},'segunda página sin parámetros en la URL');

  // Compra inmediata con GA4 lento: se espera como máximo 1 s y el checkout lleva todo.
  await reset();gaMode={delay:400};await cp.goto(LANDING+QUERY);
  let started=Date.now();
  await Promise.all([cp.waitForURL(SYSTEME+'/**'),cp.locator('a[data-checkout="mercado_pago"]').click()]);
  assert(Date.now()-started<1600,'Espera acotada');
  assert.equal(base(checkoutVisits.at(-1)),CHECKOUTS[0]);assertLink(checkoutVisits.at(-1),{ga:true},'compra inmediata');
  // GA4 muy lento: se navega a 1 s sin identificadores (nunca se inventan).
  await reset();gaMode={delay:5000};await cp.goto(LANDING+QUERY);started=Date.now();
  await Promise.all([cp.waitForURL(SYSTEME+'/**'),cp.locator('a[data-checkout="mercado_pago"]').click()]);
  const waited=Date.now()-started;assert(waited>=900&&waited<2000,'Espera máxima de 1 s: '+waited);
  assertLink(checkoutVisits.at(-1),{ga:false},'GA4 lento');
  // GA4 bloqueado: no se espera.
  await reset();gaMode={block:true};await cp.goto(LANDING+QUERY);await cp.waitForTimeout(300);started=Date.now();
  await Promise.all([cp.waitForURL(SYSTEME+'/**'),cp.locator('a[data-checkout="mercado_pago"]').click()]);
  assert(Date.now()-started<700,'GA4 bloqueado: navegación sin espera');
  assertLink(checkoutVisits.at(-1),{ga:false},'GA4 bloqueado');
  // Sin parámetros de campaña: el checkout no inventa UTM ni ttclid.
  await reset();await cp.goto(LANDING);await cp.waitForTimeout(300);s=await state(cp);
  assert(s.links.every(h=>!/utm_|ttclid/.test(h)),'Sin campaña no hay UTM ni ttclid');

  // El único error esperado es el bloqueo simulado de gtag.js (y ninguna violación de CSP).
  assert.deepEqual(trackingErrors.filter(m=>!(m.includes('ERR_BLOCKED_BY_CLIENT')&&m.endsWith(' @ '+GA_TAG))),[],'Sin errores ni violaciones de CSP durante las pruebas de medición');
  await ctx.close();

  // localStorage no disponible: la medición y la página siguen funcionando.
  const noStorage=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});await noStorage.route('**/*',trackingRoute);
  await noStorage.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Almacenamiento bloqueado','SecurityError');}});});
  const ns=await noStorage.newPage();const nsErrors=[];ns.on('pageerror',e=>nsErrors.push(e.message));
  trackerRequests.length=0;gaMode={delay:50};
  await ns.goto(LANDING+QUERY);await ns.waitForTimeout(400);
  s=await state(ns);assert.deepEqual(s.globals,['function','object','function'],'Sin localStorage: la medición carga igual');
  assertLinks(s,{ga:true},'sin localStorage');
  assert(await ns.locator('.menu-toggle').count()===1&&(await ns.locator('h1').count())===1,'La página sigue funcionando');
  assert.deepEqual(nsErrors,[],'Sin errores sin localStorage');
  await noStorage.close();
  results.push({medicion:'GA4 (analytics_storage concedido antes del primer page_view), Clarity (consentv2 concedido) y TikTok (enableCookie + grantConsent antes de page) en cada visita, sin banner; begin_checkout e InitiateCheckout una vez por clic (doble clic y clic sintético sin eventos); Purchase solo en servidor; UTM, ttclid, fbclid, gclid, ad_consent e ids de GA4 en ambos checkouts; compra inmediata (espera ≤1 s), GA4 lento/bloqueado; sin errores de CSP; localStorage bloqueado.'});
 }
 fs.writeFileSync(path.join(output,'resultados.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));await browser.close();server.close();
})().catch(async e=>{console.error(e);await auditBrowser?.close();server.close();process.exit(1)});
