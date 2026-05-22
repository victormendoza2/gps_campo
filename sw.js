const CACHE = 'gps-campo-v2';
const ARCHIVOS_BASE = [
  '/',
  '/index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS_BASE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CACHE+'_tiles').map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase: siempre network, nunca cachear
  if(url.hostname.includes('supabase.co')){
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({error:'sin_conexion'}),
          {headers:{'Content-Type':'application/json'}})
      )
    );
    return;
  }

  // Tiles OSM: cache-first, fallback a tile gris
  if(url.hostname.includes('tile.openstreetmap.org') ||
     url.hostname.includes('arcgisonline.com')){
    e.respondWith(
      caches.open(CACHE+'_tiles').then(async cache => {
        const cached = await cache.match(e.request);
        if(cached) return cached;
        try {
          const resp = await fetch(e.request);
          cache.put(e.request, resp.clone());
          return resp;
        } catch {
          // Tile gris de 1x1px como fallback
          return new Response(
            atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
            {headers:{'Content-Type':'image/png'}}
          );
        }
      })
    );
    return;
  }

  // App shell: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() =>
      caches.match('/index.html')
    ))
  );
});
