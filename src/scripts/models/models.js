import CONFIG from "../config";
import { getOfflineStories, addOfflineStory, deleteOfflineStory, updateStoryStatus } from "../utils/db.js";

class Models {
  saveToken(token) {
    localStorage.setItem("token", token);
  }
  getToken() {
    return localStorage.getItem("token");
  }
  removeToken() {
    localStorage.removeItem("token");
  }
  isAuthenticated() {
    return !!localStorage.getItem("token");
  }

  async register({ name, email, password }) {
    const res = await fetch(`${CONFIG.BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    return res.json();
  }

  async login({ email, password }) {
    const res = await fetch(`${CONFIG.BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  }

  async getStories(token) {
    const API_URL = `${CONFIG.BASE_URL}/stories`;
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if ("caches" in window) {
        const cache = await caches.open("story-app-cache-v1");
        cache.put(API_URL, new Response(JSON.stringify(data)));
      }

      return data;
    } catch (err) {
      console.warn("⚠️ Gagal ambil dari server, fallback ke cache:", err);
      if ("caches" in window) {
        const cached = await caches.match(API_URL);
        if (cached) return cached.json();
      }
      return { error: true, message: "Offline mode dan cache tidak tersedia", listStory: [] };
    }
  }

  async addStory({ description, photo, lat, lon }, token) {
    if (!navigator.onLine) {
      let photoData = null;
      if (photo instanceof File) {
        photoData = await this.fileToBase64(photo);
      } else if (typeof photo === "string") {
        photoData = photo;
      }

      const offlineStory = { description: description.trim(), photo: photoData, lat: parseFloat(lat), lon: parseFloat(lon) };
      const savedStory = await addOfflineStory(offlineStory);
      console.log("📱 Models: Offline story disimpan via wrapper (ID):", savedStory.id);

      return { offline: true, error: false, message: "Story disimpan sementara (offline)", data: savedStory };
    }

    const formData = new FormData();
    formData.append("description", description);

    let filePhoto = null;
    if (photo instanceof File) filePhoto = photo;
    else if (typeof photo === "string" && photo.startsWith("data:")) {
      filePhoto = this.base64ToFile(photo, "photo.jpg");
    }

    if (!filePhoto) return { error: true, message: "Photo tidak valid" };
    formData.append("photo", filePhoto);

    if (lat) formData.append("lat", lat);
    if (lon) formData.append("lon", lon);

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/stories`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Server menolak request:", res.status, text);
        return { error: true, message: `Server Error (${res.status}): ${text}` };
      }

      return res.json();
    } catch (networkErr) {
      console.error("Kesalahan Jaringan/Fetch:", networkErr.message);
      return { error: true, message: `Gagal terhubung ke server: ${networkErr.message}` };
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  base64ToFile(base64String, fileName) {
    try {
      if (!base64String.startsWith("data:")) return null;
      const arr = base64String.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
      return new File([u8arr], fileName, { type: mime });
    } catch (err) {
      console.error("Gagal convert base64 ke File:", err);
      return null;
    }
  }

  async subscribePushNotification(subscription, token) {
    const subscriptionJson = subscription.toJSON();
    const res = await fetch(`${CONFIG.BASE_URL}/notifications/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscriptionJson.endpoint,
        keys: {
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
        },
      }),
    });
    return res.json();
  }

  async unsubscribePushNotification(endpoint, token) {
    const res = await fetch(`${CONFIG.BASE_URL}/notifications/subscribe`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint }),
    });
    return res.json();
  }

  async sendNotification({ title, body }) {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, { body, icon: "/favicon.png", badge: "/favicon.png" });
      return { message: "Notification shown locally" };
    }
    return { error: true, message: "Service Worker not supported" };
  }
}

export default new Models();
