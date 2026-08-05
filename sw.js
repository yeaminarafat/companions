/* Companions of the Prophet ﷺ — service worker
   Cache-first over a full precache: once installed the app never needs the network. */
const VERSION = 'companions-25fb02e5f6';
const ASSETS = [
  "./",
  "index.html",
  "app.js",
  "family.js",
  "quiz.js",
  "data.js",
  "manifest.webmanifest",
  "fonts.css",
  "robots.txt",
  "amiri_v30_J7aRnpd8CGxBHpUgtLMS7JNKIjk.woff2",
  "amiri_v30_J7aRnpd8CGxBHpUrtLMS7JNKIjk.woff2",
  "amiri_v30_J7aRnpd8CGxBHpUutLMS7JNK.woff2",
  "amiri_v30_J7acnpd8CGxBHp2VkaY6zp5gGDAbnCA.woff2",
  "amiri_v30_J7acnpd8CGxBHp2VkaY_zp5gGDAb.woff2",
  "amiri_v30_J7acnpd8CGxBHp2VkaYxzp5gGDAbnCA.woff2",
  "amiri_v30_J7afnpd8CGxBHpUrhL8Y67FIEjgjpQ.woff2",
  "amiri_v30_J7afnpd8CGxBHpUrhLEY67FIEjg.woff2",
  "amiri_v30_J7afnpd8CGxBHpUrhLQY67FIEjgjpQ.woff2",
  "apple-touch-icon.png",
  "crimsonpro_v28_q5uBsoa5M_tv7IihmnkabARekY1wDeChrlWhBw.woff2",
  "crimsonpro_v28_q5uBsoa5M_tv7IihmnkabARekYNwDeChrlU.woff2",
  "crimsonpro_v28_q5uDsoa5M_tv7IihmnkabARVoYF6CsKjnlQ.woff2",
  "crimsonpro_v28_q5uDsoa5M_tv7IihmnkabARboYF6CsKj.woff2",
  "favicon-32.png",
  "icon-192.png",
  "icon-512-maskable.png",
  "icon-512.png",
  "inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2",
  "inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2"
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(ASSETS)).catch(err => {
      /* one bad URL must not abort the whole install — cache what we can */
      return caches.open(VERSION).then(c => Promise.all(
        ASSETS.map(u => c.add(u).catch(() => null))
      ));
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    })
  );
});
