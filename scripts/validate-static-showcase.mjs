import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'static-showcase');
const manifest = JSON.parse(await fs.readFile(path.join(repo, 'docs/static-showcase-manifest.json'), 'utf8'));
const files = await fs.readdir(root, { recursive: true, withFileTypes: true });
const relativeFiles = files.filter(f => f.isFile()).map(f => path.relative(root, path.join(f.parentPath ?? f.path, f.name)).replaceAll('\\', '/'));
const deployed = new Set(relativeFiles);
const allowedExtensions = new Set(['.html', '.css', '.woff2', '.woff', '.png', '.svg', '.webp', '.jpg', '.jpeg', '.ico', '.avif', '.txt']);
const blockedPath = /^\/(?:api|chat|admin|login)(?:\/|$)/;
const decode = s => s.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
function checkLocalLink(value, sourceFile) {
  if (!value || value.startsWith('#') || value.startsWith('data:')) return;
  const u = new URL(decode(value), 'https://showcase.local/' + sourceFile);
  if (u.origin !== 'https://showcase.local') return;
  assert(!blockedPath.test(u.pathname), `Disabled link in ${sourceFile}: ${value}`);
  const target = decodeURIComponent(u.pathname).replace(/^\//, '');
  assert(deployed.has(target) || deployed.has(target.replace(/\/$/, '') + '/index.html') || (target === '' && deployed.has('index.html')), `Missing target in ${sourceFile}: ${value}`);
}

let htmlCount = 0;
for (const file of relativeFiles) {
  assert(allowedExtensions.has(path.extname(file)), `Executable or unexpected artifact: ${file}`);
  assert(!/^api\//.test(file), `API artifact: ${file}`);
  if (file.startsWith('assets/')) {
    const hash = createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex').slice(0, 20);
    assert.equal(path.basename(file, path.extname(file)), hash, `Asset filename must change with its content: ${file}`);
  }
  if (!/\.(html|css|svg)$/.test(file)) continue;
  const text = await fs.readFile(path.join(root, file), 'utf8');
  if (file.endsWith('.html')) {
    htmlCount++;
    assert(!/<(?:script|iframe|form|button|input|select|textarea)\b/i.test(text), `Active runtime/control in ${file}`);
    assert(!/\bid="[BPS]:\d+"/.test(text), `Unresolved streamed content in ${file}`);
    assert(!/\son[a-z]+\s*=/i.test(text), `Event handler in ${file}`);
    assert(!/(?:javascript:|self\.__next_f|_next\/)/i.test(text), `Runtime reference in ${file}`);
    assert(/<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">/.test(text), `Missing noindex in ${file}`);
    if (file !== '404.html') assert(text.includes('Archived 2026-09-06') && text.includes('Read-only examples'), `Missing archive disclosure in ${file}`);
    for (const m of text.matchAll(/\b(?:href|src)="([^"]+)"/g)) checkLocalLink(m[1], file);
    for (const m of text.matchAll(/<(?:img|link)\b[^>]+(?:src|href)="([^"]+)"[^>]*>/g)) {
      if (/rel="canonical"/.test(m[0])) continue;
      assert(!/^https?:/i.test(m[1]), `Remote automatic resource in ${file}: ${m[1]}`);
    }
  }
  if (file.endsWith('.css')) {
    assert(!/@import\b/.test(text), `External CSS import in ${file}`);
    for (const m of text.matchAll(/url\(([^)]+)\)/g)) checkLocalLink(m[1].replace(/^["']|["']$/g, ''), file);
  }
  if (file.endsWith('.svg')) assert(!/<script\b|\son[a-z]+\s*=|<foreignObject\b/i.test(text), `Active SVG in ${file}`);
}
assert.equal((await fs.readFile(path.join(root, 'robots.txt'), 'utf8')).trim(), 'User-agent: *\nDisallow: /');
assert.equal(htmlCount, manifest.routes.length + 1, 'Unexpected/missing page');
assert(manifest.routes.length >= 50 && manifest.routes.length <= 110, 'Unbounded or incomplete archive');
for (const route of manifest.routes) assert(deployed.has(route.file), `Manifest page missing: ${route.file}`);
for (const portfolio of new Set(manifest.routes.map(r => r.path.match(/^\/portfolio\/([^/]+)$/)?.[1]).filter(Boolean))) {
  assert(manifest.routes.some(r => r.path === `/portfolio/${portfolio}/international`), `Missing international view: ${portfolio}`);
}
console.log(`Static showcase verified: ${manifest.routes.length} public pages, ${deployed.size} files; no scripts, APIs, forms, missing internal links, or remote automatic resources.`);
