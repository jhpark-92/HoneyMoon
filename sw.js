const CACHE = 'honeymoon-cache';

// 외부 라이브러리 (버전 고정 → 캐시 우선)
const EXTERNAL = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/variable/pretendardvariable.min.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([
        '/HoneyMoon/',
        '/HoneyMoon/index.html',
        '/HoneyMoon/style.css',
        '/HoneyMoon/script.js',
        '/HoneyMoon/manifest.json',
        ...EXTERNAL,
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API 요청은 항상 네트워크
  if (url.includes('googleapis.com') ||
      url.includes('script.google.com') ||
      url.includes('photon.komoot.io') ||
      url.includes('nominatim.openstreetmap.org') ||
      url.includes('basemaps.cartocdn.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 외부 라이브러리: 캐시 우선 (CDN 버전 고정)
  if (EXTERNAL.includes(url)) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
    return;
  }

  // 앱 자체 파일: 네트워크 우선 → 캐시 갱신 → 오프라인 시 캐시 폴백
  // 버전 번호 수동 관리 불필요
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
