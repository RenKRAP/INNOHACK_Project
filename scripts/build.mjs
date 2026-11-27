import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/vendor/', root), { recursive: true });
await cp(new URL('public/', root), new URL('dist/', root), { recursive: true });
await cp(new URL('model/', root), new URL('dist/model/', root), { recursive: true });
await cp(new URL('node_modules/leaflet/dist/', root), new URL('dist/vendor/leaflet/', root), { recursive: true });
const pkg = JSON.parse((await readFile(new URL('package.json', root), 'utf8')).replace(/^\uFEFF/, ''));
await writeFile(new URL('dist/version.json', root), JSON.stringify({ version: pkg.version }));
console.log('Local application built in dist/');
