// Service worker do PWA: cache-first para arquivos estáticos,
// network-first (sem cache) para a API.
const CACHE = 'fablecrm-v1';
const ASSETS = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/api.js', '/js/ui.js', '/js/charts.js', '/js/app.js',
  '/js/views-core.js', '/js/views-crm.js', '/js/views-telecom.js', '/js/views-admin.js',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api')) return; // API sempre na rede
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || caches.match('/index.html'));
      return cached || fetched;
    })
  );
});
