const CACHE = 'gps-campo-v3';
const ARCHIVOS_BASE = [
  '/index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Instalación: cachea archivos base
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(ARCHIVOS_BASE.map(url => c.add(url)))
    )
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE && k !== CACHE+'_tiles')
             .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase: siempre network, respuesta vacía si falla
  if(url.hostname.includes('supabase.co')){
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({error:'offline'}),
          {status:200, headers:{'Content-Type':'application/json'}})
      )
    );
    return;
  }

  // Tiles del mapa: cache-first
  if(url.hostname.includes('tile.openstreetmap.org') ||
     url.hostname.includes('arcgisonline.com')){
    e.respondWith(
      caches.open(CACHE+'_tiles').then(async cache => {
        const cached = await cache.match(e.request);
        if(cached) return cached;
        try {
          const resp = await fetch(e.request);
          if(resp.ok) cache.put(e.request, resp.clone());
          return resp;
        } catch {
          // Tile gris 256x256 como fallback
          const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8e4dc"/></svg>`;
          return new Response(canvas, {headers:{'Content-Type':'image/svg+xml'}});
        }
      })
    );
    return;
  }

  // App shell: cache-first, SIEMPRE responde con index.html si falla
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(resp => {
        // Guardar en caché si es exitoso
        if(resp.ok){
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() =>
        // Si todo falla, devolver index.html del caché
        caches.match('/index.html')
      );
    })
  );
});

// Mensaje desde la app para forzar actualización del caché
self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});
