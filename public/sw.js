// Service worker SonarID.
// - Halaman dan kode: utamakan jaringan (versi terbaru), cache hanya saat offline.
// - Rekaman suara (/voice) dan komponen AI (/vendor): cache lebih dulu, karena berukuran besar dan
//   jarang berubah. Bila daftar berkas (manifest) berubah, cache bagian itu dibersihkan.
// Foto KTP dan swafoto tidak pernah melewati service worker (hanya ada di memori halaman).
const CACHE = 'sonarid-v3';
const ASSETS = 'sonarid-assets-v1';
const MANIFESTS = { '/voice/manifest.json': '/voice/', '/vendor/vendor.json': '/vendor/' };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function purge(prefix) {
  const c = await caches.open(ASSETS);
  const keys = await c.keys();
  await Promise.all(keys.filter((k) => new URL(k.url).pathname.startsWith(prefix)).map((k) => c.delete(k)));
}

async function manifestFirst(req, prefix) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.clone().text();
      const old = await c.match(req);
      if (old && (await old.text()) !== text) await purge(prefix);
      await c.put(req, res.clone());
    }
    return res;
  } catch {
    const hit = await c.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(req) {
  const c = await caches.open(ASSETS);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) c.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  } catch {
    const hit = await caches.match(req);
    return hit || caches.match('/index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return; // biarkan browser menangani permintaan sebagian
  const path = url.pathname;
  if (MANIFESTS[path]) event.respondWith(manifestFirst(req, MANIFESTS[path]));
  else if (path.startsWith('/voice/') || path.startsWith('/vendor/')) event.respondWith(cacheFirst(req));
  else event.respondWith(networkFirst(req));
});
