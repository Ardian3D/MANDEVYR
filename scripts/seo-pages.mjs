import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const client = join(process.cwd(), 'dist', 'client');
const home = readFileSync(join(client, 'index.html'), 'utf8');
const origin = 'https://www.mandevyr.my.id';

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function setMeta(html, name, value) {
  const pattern = new RegExp(`(<meta\\s+(?:name|property)="${name}"\\s+content=")[^"]*("\\s*/?>)`, 'i');
  if (!pattern.test(html)) throw new Error(`Missing ${name} in base HTML`);
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
}

function routePage({ route, title, description, body, indexable }) {
  let html = home.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(`<link rel="canonical" href="${origin}/"`, `<link rel="canonical" href="${origin}${route}"`);
  html = setMeta(html, 'description', description);
  html = setMeta(html, 'robots', indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow');
  html = setMeta(html, 'og:title', title);
  html = setMeta(html, 'og:description', description);
  html = setMeta(html, 'og:url', `${origin}${route}`);
  html = setMeta(html, 'twitter:title', title);
  html = setMeta(html, 'twitter:description', description);
  const root = /<div id="root"><!-- ROOT_BOOT_START -->[\s\S]*?<!-- ROOT_BOOT_END --><\/div>/;
  if (!root.test(html)) throw new Error('Missing marked root boot content');
  html = html.replace(root, `<div id="root">${body}</div>`);
  html = html.replace(/    <script type="application\/ld\+json">[^\n]+<\/script>\n/g, '');
  const folder = join(client, route.slice(1));
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.html'), html);
}

routePage({
  route: '/docs',
  title: 'MANDEVYR Docs | Arc Vault Research & Product Roadmap',
  description: 'Read how MANDEVYR checks Arc vault sources, protects wallet-approved actions, and verifies MDVYR holder utility and agent API boundaries.',
  body: '<main style="max-width:760px;margin:12vh auto;padding:24px;color:#e9eee5;font:18px/1.7 Arial,sans-serif"><h1>MANDEVYR Documentation</h1><p>MANDEVYR documents Arc vault research, wallet-signed mandates and actions, MDVYR holder utility, and agent API boundaries.</p><p><a href="/" style="color:#c1dcad">MANDEVYR home</a></p></main>',
  indexable: true,
});

routePage({
  route: '/app',
  title: 'Explore Arc Vaults | MANDEVYR',
  description: 'Explore curated Morpho vaults on Arc with live onchain source checks and a personal watchlist in MANDEVYR.',
  body: '',
  indexable: false,
});
