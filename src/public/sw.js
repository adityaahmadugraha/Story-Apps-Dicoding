console.log(">> SW loaded at", new Date().toISOString());

const CACHE_NAME = "story-app-cache-v2";

const ASSETS_TO_CACHE = ["./", "./index.html", "./manifest.json", "./images/logo.png"];

async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
          console.log("✅ Cached:", asset);
        } catch (err) {
          console.warn("⚠️ Gagal cache:", asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log("🗑️ Deleting old cache:", key);
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Notifikasi", {
      body: data.body || "Ini pesan notifikasi",
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  if (url.origin === "https://story-api.dicoding.dev" && url.pathname.includes("/stories")) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(JSON.stringify({ error: false, message: "Offline mode", listStory: [] }), { headers: { "Content-Type": "application/json" } });
          });
        })
    );
    return;
  }

  if (event.request.destination === "image") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(event.request).then((networkResponse) => {
            const clone = networkResponse.clone();
            caches.open("image-cache").then((cache) => cache.put(event.request, clone));
            return networkResponse;
          })
        );
      })
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request)));
});
