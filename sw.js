const CACHE = 'gps-campo-v1';
const ARCHIVOS = [
  '/',
  '/index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
];

// Instalación: cachea todos los archivos base
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para archivos de app, network-first para tiles y Supabase
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Tiles del mapa: network-first con fallback a caché
  if(url.hostname.includes('tile.openstreetmap.org')){
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE+'_tiles').then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Supabase: siempre network (no cachear datos del servidor)
  if(url.hostname.includes('supabase.co')){
    e.respondWith(fetch(e.request).catch(() => new Response('{}',{headers:{'Content-Type':'application/json'}})));
    return;
  }

  // Todo lo demás: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
