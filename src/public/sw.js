console.log(">> SW loaded at", new Date().toISOString());

const CACHE_NAME = "story-app-cache-v3";
const IMAGE_CACHE_NAME = "story-app-image-cache-v1";

const ASSETS_TO_CACHE = ["./", "./index.html", "./manifest.json", "./favicon.png", "./images/logo.png", "./app.bundle.js", "./app.css"];

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
    }),
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
            if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
              console.log("🗑️ Deleting old cache:", key);
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
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
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (url.origin === "https://story-api.dicoding.dev" && url.pathname.includes("/stories")) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cachedResponse) =>
              cachedResponse ||
              new Response(JSON.stringify({ error: false, message: "Offline mode", listStory: [] }), {
                headers: { "Content-Type": "application/json" },
              }),
          ),
        ),
    );
    return;
  }

  if (event.request.destination === "image") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((networkResponse) => {
            const clone = networkResponse.clone();
            caches.open(IMAGE_CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return networkResponse;
          })
          .catch(() => new Response("", { status: 408, statusText: "Offline - image unavailable" }));
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return new Response("", { status: 408, statusText: "Offline - resource unavailable" });
      });
    }),
  );
});
