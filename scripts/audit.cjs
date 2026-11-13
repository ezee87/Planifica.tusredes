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
 assert(/\.(?:html|css|js|svg|webp|woff2|xml|txt)$/.test(file),'Extensión pública inesperada: '+file);
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
 const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'}[path.extname(file)];
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
 for(const origin of ['https://www.clarity.ms','https://scripts.clarity.ms'])assert(cspDirectives['script-src'].includes(origin),'Scripts de Clarity: '+origin);
 for(const directive of ['img-src','connect-src'])assert(cspDirectives[directive].includes('https://*.clarity.ms'),'Recolección regional de Clarity: '+directive);
 assert(cspDirectives['img-src'].includes('https://c.bing.com'),'Imagen de sincronización de Clarity');
 assert.deepEqual(cspDirectives['default-src'],["'self'"],'Conservar la política por defecto');
 await page.goto('http://127.0.0.1:8766/contacto.html');
 for(const width of [320,375,393,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8766/');
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode()}))});
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('link[rel=icon]').getAttribute('href'),'favicon.svg');
  assert.equal((await page.request.get('http://127.0.0.1:8766/favicon.svg')).status(),200);
  assert(await page.locator('.value-total del').evaluate(e=>e.getBoundingClientRect().height<40 && getComputedStyle(e).whiteSpace==='nowrap'));
  if(width<=800){
   assert(await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height<=81));
   const toggle=page.locator('.menu-toggle');await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await toggle.evaluate(e=>e===document.activeElement));
   await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'true');await page.keyboard.press('Tab');assert(await page.locator(':focus').evaluate(e=>e.closest('#section-links')!==null));await page.keyboard.press('Escape');
  }
  if(width<=600){assert(await page.locator('.comparison').isHidden());assert.equal(await page.locator('.comparison-mobile li').count(),8);assert.equal(await page.locator('.comparison-mobile h3').count(),2);}
  else assert(await page.locator('.comparison-mobile').isHidden());
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
 results.push({keyboard:'skip, 11 FAQ Enter/Space, Shift+Tab, native invalid email',links:hrefs,expectedFormErrors:errors});
 fs.writeFileSync(path.join(output,'resultados.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));await browser.close();server.close();
})().catch(async e=>{console.error(e);await auditBrowser?.close();server.close();process.exit(1)});
