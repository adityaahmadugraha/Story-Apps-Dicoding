import Models from "../../models/models";
import StoryDB from "../../utils/db.js";

export default class AddPresenter {
  #view;
  #model;
  #auth;
  #isSubmitting = false;
  #syncListenerAdded = false;

  constructor(view, model = Models, auth = Models) {
    this.#view = view;
    this.#model = model;
    this.#auth = auth;
    this.initSyncListener();
  }

  async submitStory({ description, photo, lat, lon }) {
    if (this.#isSubmitting) {
      console.warn("⏳ Sedang dalam proses submit, skip duplikat.");
      return;
    }

    const token = this.#auth.getToken();
    if (!token) {
      this.#view.showSnackbar("⚠️ Anda harus login terlebih dahulu", true);
      this.#view.redirectToLogin();
      return;
    }

    if (!description || !photo || !lat || !lon) {
      this.#view.showSnackbar("⚠️ Semua field harus diisi!", true);
      return;
    }

    this.#isSubmitting = true;
    this.#view.showLoading();

    try {
      let response;
      const isOnline = navigator.onLine;

      if (isOnline) {
        try {
          response = await this.#model.addStory({ description, photo, lat, lon }, token);
        } catch (networkErr) {
          console.warn("Network error during submit:", networkErr);
          response = null;
        }
      }

      if (!isOnline || !response || response.offline || response.error) {
        const offlineStory = {
          description: description.trim(),
          photo,
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          id: crypto.randomUUID(),
          status: "pending_sync",
        };
        await StoryDB.addOfflineStory(offlineStory);
        this.#view.showSnackbar("📥 Story disimpan sementara. Akan di-sync saat online!");
      } else {
        if (response && (response.error === false || response.status === "success")) {
          localStorage.setItem("newStoryAdded", "true");
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification("Story berhasil dibuat", {
              body: `Anda telah membuat story baru: ${description}`,
              icon: "/favicon.png",
            });
          }
          this.#view.showSnackbar("✅ Cerita berhasil ditambahkan secara online!");
        } else {
          throw new Error(response.message || "Gagal menambahkan cerita");
        }
      }
    } catch (err) {
      console.error(err);
      this.#view.showSnackbar(`❌ ${err.message}`, true);
    } finally {
      this.#view.hideLoading();
      this.#isSubmitting = false;
      this.#view.redirectToHome();
    }
  }

  initSyncListener() {
    if (this.#syncListenerAdded) return;

    if (navigator.onLine) {
      this.triggerSync();
    }

    window.addEventListener("online", async () => {
      if (StoryDB.isSyncInProgress()) {
        console.log("Sync sudah berjalan, skip.");
        return;
      }
      this.#view.showSnackbar("🔄 Koneksi kembali! Menyinkronkan data offline...");
      await this.triggerSync();
    });

    this.#syncListenerAdded = true;
  }

  async triggerSync() {
    if (!navigator.onLine || StoryDB.isSyncInProgress()) {
      console.log("Offline atau sync sedang berjalan, skip.");
      return;
    }

    const token = this.#auth.getToken();
    if (!token) {
      console.log("No token, skip sync.");
      return;
    }

    StoryDB.setSyncInProgress(true);
    try {
      await StoryDB.cleanDuplicatePendingStories();

      const pendingStories = await StoryDB.getPendingStories();
      if (pendingStories.length === 0) {
        console.log("No pending stories to sync.");
        return;
      }

      this.#view.showLoading();

      let successCount = 0;
      for (const story of pendingStories) {
        try {
          const dataToSend = {
            description: story.description,
            photo: story.photo,
            lat: story.lat,
            lon: story.lon,
          };

          const response = await this.#model.addStory(dataToSend, token);

          if (response && (response.error === false || response.status === "success")) {
            await StoryDB.deleteStory(story.id);
            successCount++;
            localStorage.setItem("newStoryAdded", "true");
            this.#view.showSnackbar(`✅ Story "${story.description.substring(0, 20)}..." berhasil di-sync!`);
          } else {
            console.error("Sync gagal untuk story:", story.id);
            this.#view.showSnackbar(`❌ Gagal sync story "${story.description.substring(0, 20)}..."`, true);
          }
        } catch (syncErr) {
          console.error("Individual sync error:", syncErr);
        }
      }

      this.#view.hideLoading();
      this.#view.showSnackbar(`🔄 Selesai sync: ${successCount}/${pendingStories.length} item berhasil.`);
    } catch (err) {
      console.error("Sync error:", err);
      this.#view.showSnackbar("❌ Gagal sync, coba lagi nanti.", true);
    } finally {
      StoryDB.setSyncInProgress(false);
    }
  }
}
