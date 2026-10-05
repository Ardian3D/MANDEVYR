import { readFile, writeFile } from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const [source,gsap]=await Promise.all([readFile(new URL('film.html',root),'utf8'),readFile(new URL('assets/gsap.min.js',root),'utf8')]);
await writeFile(new URL('index.html',root),source.replace('/* GSAP_BUNDLE */',()=>gsap.replace(/<\/script/gi,'<\\/script')));
console.log('Built standalone index.html; no server or CDN required.');
