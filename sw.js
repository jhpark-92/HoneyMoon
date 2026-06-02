const CACHE = 'honeymoon-v2';
const ASSETS = [
  '/HoneyMoon/',
  '/HoneyMoon/index.html',
  '/HoneyMoon/style.css',
  '/HoneyMoon/script.js',
  '/HoneyMoon/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/variable/pretendardvariable.min.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API 요청(Google, Apps Script)은 항상 네트워크
  if (url.includes('googleapis.com') ||
      url.includes('script.google.com') ||
      url.includes('photon.komoot.io') ||
      url.includes('nominatim.openstreetmap.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 정적 자산: 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
