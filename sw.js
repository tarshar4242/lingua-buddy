const cacheName = "lingua-buddy-v9";
const assets = [
  "./",
  "./index.html",
  "./styles.css?v=6",
  "./imports.css?v=1",
  "./app.js?v=7",
  "./imports.js?v=1",
  "./manifest.webmanifest?v=5",
  "./supabase-config.js?v=2",
  "./setup.html",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
