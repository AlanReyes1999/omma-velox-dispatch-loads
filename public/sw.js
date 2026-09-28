/* OMMA Dispatch — service worker.
   Hace que la app instalada abra al instante y siga abriendo sin señal en campo.
   · Código y página: red primero (si hay red siempre llega la versión más nueva), caché de respaldo.
   · Fuentes, íconos y librerías: caché primero (no cambian).
   · El estado compartido (/api/state) nunca pasa por aquí: siempre va al servidor. */
const CACHE = 'ovd-shell-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/fonts.css', 'assets/css/tokens-pastel.css', 'assets/css/components-cards.css', 'assets/css/motion.css', 'assets/css/app.css',
  'assets/js/vendor/chart.umd.min.js', 'assets/js/chartkit.js', 'assets/js/ui-kit.js', 'assets/js/seed.js', 'assets/js/engine.js',
  'assets/js/reducer.js', 'assets/js/parser.js', 'assets/js/store.js', 'assets/js/viz.js', 'assets/js/app.js',
  'assets/fonts/plus-jakarta-sans-latin.woff2', 'assets/fonts/manrope-latin.woff2', 'assets/fonts/jetbrains-mono-latin.woff2',
  'assets/img/logo-omma.svg', 'assets/img/icon.svg', 'assets/img/icon-192.png', 'assets/img/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function put(req, res) {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
  return res;
}
/* red con tiempo límite: con señal mala no se queda colgada la apertura */
function network(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf('/api/') === 0) return;
  if (/\/assets\/(fonts|img|js\/vendor)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
    return;
  }
  e.respondWith(
    network(req, 4000).then(res => put(req, res)).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
