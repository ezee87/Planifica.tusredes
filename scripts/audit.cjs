// Dependencias de auditoría instaladas con npm ci.
const {chromium}=require('playwright');
const {default:AxeBuilder}=require('@axe-core/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'), output=path.resolve(__dirname,'../auditoria');fs.mkdirSync(output,{recursive:true});
const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../vercel.json'),'utf8'));
assert.equal(config.outputDirectory,'dist');
const headers=Object.fromEntries(config.headers[0].headers.map(({key,value})=>[key,value]));
const netlifyCsp=fs.readFileSync(path.join(root,'_headers'),'utf8').split('\n').find(l=>l.trim().startsWith('Content-Security-Policy:')).trim().slice('Content-Security-Policy: '.length);
assert.equal(headers['Content-Security-Policy'],netlifyCsp,'Mantener sincronizada la CSP de Vercel y Netlify');
assert.equal(config.rewrites.find(r=>r.source==='/api/contacto').destination,'https://planificatusredes.netlify.app/');
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
 const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)];
 res.writeHead(200,{...headers,'Content-Type':type||'text/plain'});res.end(fs.readFileSync(file));
});
(async()=>{await new Promise(r=>server.listen(8766,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text())});
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
 for(const slug of ['terminos','licencia','privacidad','devoluciones','respaldos']){
  for(const suffix of ['', '/', '.html']){const r=await page.goto('http://127.0.0.1:8766/legal/'+slug+suffix);assert.equal(r.status(),200);assert.equal(await page.locator('main h1').count(),1);}
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({legal:slug,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 }
 await page.goto('http://127.0.0.1:8766/arrepentimiento');assert.equal(await page.locator('form').count(),1);await page.locator('button[type=submit]').click();assert.equal(await page.locator(':focus').getAttribute('id'),'email');
 await page.goto('http://127.0.0.1:8766/contacto.html');
 const form=page.locator('form[name=contacto]');assert.equal(await form.getAttribute('method'),'POST');assert.equal(await form.getAttribute('netlify'),'');
 assert.equal(await page.locator('[name=form-name]').inputValue(),'contacto');assert(await page.locator('[name=bot-field]').isHidden());
 await page.locator('button[type=submit]').click();assert.equal(await page.locator(':focus').getAttribute('id'),'email');
 await page.goto('http://127.0.0.1:8766/contacto.html');
 for(const width of [320,375,393,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({contact:width,violations:axe.violations.map(v=>v.id)});
  await page.screenshot({path:path.join(output,`contacto-${width}.png`),fullPage:true});
 }
 await page.locator('#nombre').fill('Prueba local');await page.locator('#email').fill('prueba@example.test');await page.locator('#motivo').selectOption({label:'Consulta general'});await page.locator('#mensaje').fill('Simulaci?n interceptada, sin env?o real.');
 let posts=0;let mode='error';
 await page.route('http://127.0.0.1:8766/api/contacto',async route=>{
  assert.equal(route.request().method(),'POST');posts++;const body=new URLSearchParams(route.request().postData());
  assert.equal(body.get('form-name'),'contacto');for(const key of ['nombre','email','motivo','mensaje','bot-field'])assert(body.has(key));
  assert.equal(route.request().headers()['content-type'],'application/x-www-form-urlencoded');
  await new Promise(r=>setTimeout(r,150));await route.fulfill({status:mode==='error'?422:200,body:'Respuesta local simulada'});
 });
 await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('No se pudo'));assert(await form.isVisible());assert.equal(posts,1);
 mode='success';await page.locator('button[type=submit]').click();await form.evaluate(f=>f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})));await page.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('Consulta recibida'));assert.equal(posts,2);assert(await form.isHidden());
 results.push({form:'HTML static, native validation, mocked 422/200, fields and duplicate protection passed; no real POST'});
 results.push({keyboard:'skip, 11 FAQ Enter/Space, Shift+Tab, native invalid email',links:hrefs,errors});
 fs.writeFileSync(path.join(output,'resultados.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});
