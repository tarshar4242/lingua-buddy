const cacheName = "lingua-buddy-v12";
const assets = [
  "./",
  "./index.html",
  "./styles.css?v=6",
  "./imports.css?v=1",
  "./app.js?v=7",
  "./segments.js?v=1",
  "./imports.js?v=1",
  "./speech-rate.js?v=1",
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

async function combinedImportsResponse(event) {
  const cache = await caches.open(cacheName);
  const importsResponse = (await cache.match("./imports.js?v=1")) || (await fetch(event.request));
  const speechRateResponse = (await cache.match("./speech-rate.js?v=1")) || (await fetch("./speech-rate.js?v=1"));
  const importsText = await importsResponse.text();
  const speechRateText = await speechRateResponse.text();
  return new Response(`${importsText}\n\n${speechRateText}`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/imports.js")) {
    event.respondWith(combinedImportsResponse(event));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
