/**
 * SERVICE WORKER DE EVADÍ
 * Guarda la app en el cel para que abra al instante y sin señal.
 * Las peticiones a Apps Script no pasan por aquí: siempre van directo a la red.
 *
 * IMPORTANTE: cada vez que cambies cualquier archivo en GitHub, sube VERSION
 * (evadi-v2, evadi-v3...). Sin ese cambio no aparece el aviso de "Hay versión nueva".
 */
var VERSION = 'evadi-v25';

var ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './icono-192.png',
  './icono-512.png',
  './icono-maskable-512.png',
  './apple-touch-icon.png'
];

// Descarga todo fresco (sin caché del navegador) y lo guarda
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(ARCHIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    })
  );
  // No se activa solo: espera a que toques "Actualizar"
});

// La app manda 'saltar' cuando tocas "Actualizar"
self.addEventListener('message', function (e) {
  if (e.data === 'saltar') self.skipWaiting();
});

// Borra versiones viejas y toma el control
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.filter(function (k) {
        return k.indexOf('evadi-') === 0 && k !== VERSION;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Primero lo guardado; si no está, la red
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // Apps Script y otros: directo a la red

  e.respondWith(
    caches.open(VERSION).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (r) {
        if (r) return r;
        if (req.mode === 'navigate') {
          return c.match('./index.html').then(function (x) { return x || fetch(req); });
        }
        return fetch(req);
      });
    })
  );
});
