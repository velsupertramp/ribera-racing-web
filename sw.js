// Caché de Ribera Racing en la web (Claude, 06/10/2026). Lo registra src/ui/version-web.js.
// Páginas: la copia guardada al momento y la red la renueva detrás (desde el 21/11; antes, primero la red).
// Ficheros con ?v= (game.js y modelos con su huella): de la caché; si no están, se bajan una vez y se guardan, y se
// borran las copias del mismo fichero con otra huella. El resto: la copia guardada al momento y se refresca detrás.
const CACHE = 'rr-web-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
const guardar = async (cache, req, res) => { if (res && res.status === 200 && res.type !== 'opaque') { try { await cache.put(req, res.clone()); } catch (e) { /* sin sitio */ } } return res; };
// La página nueva solo se guarda cuando ya está guardado el game.js que pide: si no, abrirla sin red fallaría
const renovarPagina = async (c, req) => {
  const res = await fetch(req); if (!res || res.status !== 200 || res.type === 'opaque') return res;
  try {
    const m = /game\.js\?v=[0-9a-f]+/.exec(await res.clone().text());
    if (m) { const gu = new URL(m[0], req.url).href; if (!(await c.match(gu))) { const g = await fetch(gu); if (!g.ok) return res; await c.put(gu, g.clone()); } }
    await c.put(req, res.clone());
  } catch (err) { /* sin sitio o sin red: se queda la copia anterior */ }
  return res;
};
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url); if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith('/version.json') || u.pathname.endsWith('/sw.js') || u.pathname.endsWith('/offline-f8.json')) return; // la lista de «guardar en el móvil» siempre de la red
  const pagina = req.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('/');
  if (pagina) {
    // 21/11 (Adrian, pueblo con poca cobertura): primero la copia guardada, al momento, y la red la renueva detrás para
    // la próxima vez. Con red lenta o sin red el juego abre igual; el aviso de versión nueva sigue saliendo.
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req) || await c.match(req, { ignoreSearch: true });
      const red = renovarPagina(c, req).catch(() => null);
      if (hit) { e.waitUntil(red); return hit; }
      return (await red) || Response.error();
    }));
    return;
  }
  if (u.searchParams.has('v')) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await guardar(c, req, await fetch(req));
      try { for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) await c.delete(k); } } catch (err) { /* nada */ }
      return res;
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const red = fetch(req).then((res) => guardar(c, req, res)).catch(() => hit || Response.error());
    return hit || red;
  }));
});
