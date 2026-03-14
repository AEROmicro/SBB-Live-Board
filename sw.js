self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('sbb-v1').then((cache) => cache.addAll(['index.html', 'style.css', 'script.js', 'manifest.json']))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
