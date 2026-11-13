// Lista explícita: nunca publicar bases locales, informes ni herramientas de auditoría.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,rmSync,lstatSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const forVercel=process.env.VERCEL==='1'||process.argv.includes('--vercel');
const files=['index.html','commercial.js','commercial.css','audit-fixes.css','landing-final.js','design.css','design.js','contacto.html','contacto.css','contacto.js','favicon.svg','robots.txt','sitemap.xml',
 ...readdirSync(resolve(root,'legal')).filter(x=>/\.(html|css)$/.test(x)).map(x=>'legal/'+x),
 ...readdirSync(resolve(root,'imagenes')).filter(x=>/\.webp$/.test(x)).map(x=>'imagenes/'+x),
 ...readdirSync(resolve(root,'fonts')).filter(x=>/\.woff2$/.test(x)).map(x=>'fonts/'+x)];
// dist es exclusivamente una salida generada; limpiar evita publicar recursos obsoletos.
const output=resolve(root,'dist');
if(output!==resolve(root,'dist') || (existsSync(output)&&lstatSync(output).isSymbolicLink())) throw Error('Destino de build no seguro');
const hashes=new Set();
for(const file of files.filter(x=>x.endsWith('.html'))){
 const html=readFileSync(resolve(root,file),'utf8').replace(/\r\n?/g,'\n');
 for(const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
  hashes.add("'sha256-"+createHash('sha256').update(match[1]).digest('base64')+"'");
}
// Netlify inyecta el badge público dentro de un iframe srcdoc que hereda esta CSP.
// Autorizar solo su contenido exacto evita el error sin permitir scripts inline genéricos.
hashes.add("'sha256-BkKP2XO6WOEc3kXOiLr2ZoY83hamalKjPY9xBcbXVuw='");
// GA4: etiqueta oficial y recolección estándar/regional, sin dominios de publicidad.
// Clarity balancea la recolección entre subdominios; sus scripts usan dos hosts concretos.
const csp=`default-src 'self'; script-src 'self' https://analytics.tiktok.com https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms ${[...hashes].join(' ')}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://*.clarity.ms https://c.bing.com; font-src 'self'; connect-src 'self' https://analytics.tiktok.com https://analytics-ipv6.tiktokw.us https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://*.clarity.ms; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests`;
const configPath=resolve(root,'vercel.json');
const config=JSON.parse(readFileSync(configPath,'utf8'));
const vercelCsp=config.headers.find(rule=>rule.source==='/(.*)').headers.find(header=>header.key==='Content-Security-Policy');
// Vercel lee vercel.json antes del build: rechazar una configuración obsoleta.
// El build local sincroniza ambos archivos antes de preparar el despliegue.
if(process.env.VERCEL==='1'&&vercelCsp.value!==csp) throw Error('CSP desactualizada: ejecutar npm run build localmente e incluir vercel.json y _headers en los cambios.');
vercelCsp.value=csp;
writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
const headers=`/*
  Content-Security-Policy: ${csp}
  X-Robots-Tag: noindex, follow
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cache-Control: public, max-age=0, must-revalidate

/imagenes/*
  Cache-Control: public, max-age=604800, must-revalidate

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`;
writeFileSync(resolve(root,'_headers'),headers);
// Los archivos de reglas solo se publican cuando el destino es Netlify.
const publicFiles=forVercel?files:[...files,'_headers','_redirects'];
rmSync(output,{recursive:true,force:true});
for(const file of publicFiles){
 const target=resolve(root,'dist',file);mkdirSync(resolve(target,'..'),{recursive:true});copyFileSync(resolve(root,file),target);
}
console.log(`Preparados ${publicFiles.length} archivos públicos para ${forVercel?'Vercel':'Netlify'} en dist; sin despliegue.`);
