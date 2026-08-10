const CACHE_NAME = 'financas-pro-v22';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css?v=22',
  './js/storage.js?v=22',
  './js/theme.js?v=22',
  './js/toast.js?v=22',
  './js/confirm.js?v=22',
  './js/chart.js?v=22',
  './js/app.js?v=22',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Rede primeiro: sempre busca a versão mais recente quando online,
  // e só usa o cache como reserva para uso offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      }))
  );
});
