# Uso: node scripts/build.mjs && python scripts/zip-netlify.py dist planifica-tus-redes-netlify.zip
"""Verifica referencias de dist y crea un zip apto para Netlify Drop.

- Rutas con '/', sin carpeta contenedora (index.html en la raíz del zip).
- Permisos Unix explícitos: 644 archivos, 755 carpetas (create_system=3).
- Entradas de carpeta incluidas, fechas válidas, orden determinista.
"""
import os, re, sys, time, zipfile, urllib.parse

root, out = sys.argv[1], sys.argv[2]

files = []
for d, dirs, fs in os.walk(root):
    dirs.sort()
    for f in sorted(fs):
        files.append(os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/'))
fileset = set(files)

# 1) Toda referencia local de HTML/CSS debe existir (mayúsculas incluidas).
redirects = {l.split()[0] for l in open(os.path.join(root, '_redirects'), encoding='utf-8')
             if l.strip() and not l.startswith('#')}
missing = []
for f in files:
    if not f.endswith(('.html', '.css')):
        continue
    txt = open(os.path.join(root, f), encoding='utf-8').read()
    base = re.search(r'<base\s+href="([^"]+)"', txt)
    basedir = base.group(1).strip('/') if base else os.path.dirname(f)
    refs = re.findall(r'<(?!base)[^>]*?(?:src|href)="([^"#]+)', txt) + re.findall(r'url\(["\']?([^)"\']+)', txt)
    for r in refs:
        if re.match(r'^(https?:|mailto:|data:|tel:|//)', r):
            continue
        p = urllib.parse.urlsplit(r).path
        if not p:
            continue
        t = p.lstrip('/') if p.startswith('/') else os.path.normpath(os.path.join(basedir, p)).replace(os.sep, '/')
        if t in ('', '.') or t in fileset or '/' + t in redirects or t + '/index.html' in fileset:
            continue
        missing.append((f, r))
if missing:
    sys.exit(f'Referencias rotas: {missing}')
for required in ['index.html', '_headers', '_redirects']:
    if required not in fileset:
        sys.exit(f'Falta {required}')
if 'netlify.toml' in fileset:
    sys.exit('netlify.toml no debe ir en el zip de despliegue manual')

# 2) Zip con metadatos Unix correctos.
now = time.localtime()[:6]
dirs = sorted({'/'.join(f.split('/')[:i]) + '/' for f in files for i in range(1, f.count('/') + 1)})
if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d in dirs:
        info = zipfile.ZipInfo(d, now)
        info.create_system = 3
        info.external_attr = (0o040755 << 16) | 0x10
        z.writestr(info, b'')
    for f in files:
        info = zipfile.ZipInfo(f, now)
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        with open(os.path.join(root, f), 'rb') as fh:
            z.writestr(info, fh.read())

# 3) Releer el zip y comprobar integridad byte a byte.
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    names = [i.filename for i in z.infolist() if not i.is_dir()]
    assert sorted(names) == sorted(files)
    for i in z.infolist():
        assert '\\' not in i.filename and not i.filename.startswith('/')
        mode = i.external_attr >> 16
        assert mode & 0o444 == 0o444, (i.filename, oct(mode))
    for f in files:
        assert z.read(f) == open(os.path.join(root, f), 'rb').read(), f
print(f'OK: {len(files)} archivos, {len(dirs)} carpetas, referencias completas, {os.path.getsize(out)/1024/1024:.2f} MB')
for f in files:
    print('  ' + f)
