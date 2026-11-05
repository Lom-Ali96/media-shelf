// Lets the app open without internet: try the network first, fall back to the last saved copy.
const CACHE = 'media-shelf';
const FILES = ['./', 'index.html', 'app.js', 'logic.js', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return; // lookups and GitHub sync go straight to the internet
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
