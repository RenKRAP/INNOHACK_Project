import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchWeather } from './weather.mjs';
import { WeatherError } from './kim-weather.mjs';
import { loadLocalEnv } from './env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };
export function createApp({ staticRoot = resolve(root, 'dist'), weatherLoader = fetchWeather } = {}) {
  staticRoot = resolve(staticRoot);
  const cache = new Map(), pending = new Map();
  return http.createServer(async (req, res) => {
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return json(405, { error: 'Method not allowed' }); }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return json(200, { status: 'ok', service: 'OnSeafog', deployment: 'local-only' });
      if (url.pathname === '/api/weather') {
        const mode = url.searchParams.get('mode') || 'forecast';
        if (!['archive', 'forecast'].includes(mode)) return json(400, { error: 'mode must be archive or forecast' });
        const latText = url.searchParams.get('lat'), lonText = url.searchParams.get('lon');
        let location;
        if (latText !== null || lonText !== null) {
          const latitude = Number(latText), longitude = Number(lonText);
          if (!latText?.trim() || !lonText?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return json(400, { error: 'lat (-90~90)과 lon (-180~180)을 함께 입력해 주세요.' });
          location = { latitude: Number(latitude.toFixed(5)), longitude: Number(longitude.toFixed(5)) };
        }
        if (mode === 'archive' && !location) return json(200, JSON.parse(await readFile(resolve(root, 'data/july-2026.json'), 'utf8')));
        const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
        const start = mode === 'archive' ? '2026-07-01' : today;
        const end = mode === 'archive' ? '2026-07-31' : new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
        const key = `${mode}:${start}:${location ? `${location.latitude},${location.longitude}` : 'default'}`;
        const cached = cache.get(key), ttl = mode === 'forecast' ? 300000 : 86400000;
        if (url.searchParams.get('refresh') !== '1' && cached && Date.now() - cached.cachedAt < ttl) return json(200, cached.data);
        if (!pending.has(key)) {
          const task = Promise.resolve().then(() => weatherLoader(start, end, mode === 'forecast', undefined, location)).then(data => {
            cache.delete(key);
            cache.set(key, { cachedAt: Date.now(), data });
            while (cache.size > 32) cache.delete(cache.keys().next().value);
            return data;
          }).finally(() => pending.delete(key));
          pending.set(key, task);
        }
        try { return json(200, await pending.get(key)); }
        catch (error) { return error instanceof WeatherError
          ? json(error.status, { error: error.message, code: error.code })
          : json(502, { error: '선택한 위치의 기상자료를 가져오지 못했습니다. 네트워크와 자료 제공기관 연결을 확인한 뒤 다시 시도해 주세요.' }); }
      }
      if (url.pathname.startsWith('/api/')) return json(404, { error: 'API not found' });
      const decoded = decodeURIComponent(url.pathname);
      const path = resolve(staticRoot, '.' + (decoded === '/' ? '/index.html' : decoded));
      if (!path.startsWith(staticRoot + sep)) return json(403, { error: 'Forbidden' });
      try {
        if (!(await stat(path)).isFile()) return json(404, { error: 'Not found' });
        res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : await readFile(path));
      } catch (error) {
        if (error.code === 'ENOENT') return json(404, { error: 'Not found. Run npm run build first.' });
        throw error;
      }
    } catch { json(500, { error: '요청을 처리하지 못했습니다.' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  loadLocalEnv(root);
  const port = Number(process.env.PORT || 4173);
  const server = createApp();
  server.listen(port, '127.0.0.1', () => console.log(`OnSeafog local preview: http://127.0.0.1:${port} (not deployed)`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
