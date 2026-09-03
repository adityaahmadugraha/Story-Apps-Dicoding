import Models from "../../models/models.js";
import StoryDB from "../../utils/db.js";
import CONFIG from "../../config";

export default class HomePresenter {
  #view;
  #models;

  constructor({ view, models = Models }) {
    this.#view = view;
    this.#models = models;
    this.initOnlineListener();
  }

  initOnlineListener() {
    window.addEventListener("online", async () => {
      console.log("🌐 [ONLINE EVENT] Event 'online' terpicu pada", new Date().toISOString());
      await this.loadStories();
    });
  }

  async syncOfflineStories(token) {
    if (StoryDB.isSyncInProgress()) {
      console.log("🔒 [SYNC] Sync sudah berjalan, skip panggilan ini.");
      return;
    }

    StoryDB.setSyncInProgress(true);
    console.log("🔓 [SYNC] Mengunci proses sync, mulai...");

    let successCount = 0;

    try {
      await StoryDB.cleanDuplicatePendingStories();

      let pendingStories = await StoryDB.getPendingStories();
      console.log(
        `📋 [SYNC] Ditemukan ${pendingStories.length} pending stories:`,
        pendingStories.map((s) => s.id),
      );

      if (!pendingStories || pendingStories.length === 0) {
        console.log("✅ [SYNC] Tidak ada yang perlu di-sync.");
        return;
      }

      for (const story of pendingStories) {
        try {
          console.log(`📤 [SYNC] Mengirim story ${story.id}...`);

          let photoToSend;
          if (story.photoBase64) {
            const photoBlob = dataURLtoBlob(story.photoBase64);
            photoToSend = new File([photoBlob], "synced_photo.jpg", {
              type: photoBlob.type,
              lastModified: Date.now(),
            });
          } else if (story.photo) {
            photoToSend = story.photo;
          } else {
            console.warn(`⚠️ [SYNC] Story ${story.id} tidak punya foto, skip.`);
            continue;
          }

          const dataToSend = {
            description: story.description,
            photo: photoToSend,
            lat: story.lat,
            lon: story.lon,
          };

          const response = await this.#models.addStory(dataToSend, token);

          if (response && (response.error === false || response.status === "success")) {
            await StoryDB.deleteStory(story.id);
            successCount++;
            console.log(`✅ [SYNC] Story ${story.id} berhasil dikirim & dihapus dari pending.`);
            localStorage.setItem("newStoryAdded", "true");
          } else {
            console.error(`❌ [SYNC] Sync gagal untuk story ${story.id}:`, response);
          }
        } catch (syncErr) {
          console.error(`💥 [SYNC] Error individual untuk story ${story.id}:`, syncErr);
        }
      }

      if (successCount > 0 && this.#view.showSnackbar) {
        this.#view.showSnackbar(`Sync sukses: ${successCount} story dikirim ke server!`);
      }
    } catch (err) {
      console.error("💥 [SYNC] Error keseluruhan:", err);
      if (this.#view.showSnackbar) {
        this.#view.showSnackbar("❌ Gagal sync offline stories.", true);
      }
    } finally {
      StoryDB.setSyncInProgress(false);
      console.log("🔓 [SYNC] Selesai, lock dilepas.");
    }
  }

  async loadStories() {
    const token = this.#models.getToken();
    let stories = [];

    try {
      this.#view.showLoading();

      if (navigator.onLine && token) {
        try {
          const data = await this.#models.getStories(token);
          const serverStories = data?.listStory || [];

          await StoryDB.clearSyncedStories();

          await StoryDB.bulkPutStories(serverStories, "synced");

          await this.syncOfflineStories(token);
        } catch (err) {
          console.warn("Server gagal/network error. Lanjut ambil dari IndexedDB...", err);
        }
      }

      stories = await StoryDB.getAllStories();

      if (stories.length === 0) {
        this.#view.showError("Tidak ada cerita.");
        return;
      }

      this.#view.showStories(stories);

      if (localStorage.getItem("newStoryAdded") === "true") {
        localStorage.removeItem("newStoryAdded");
        if (this.#view.showRefreshNotif) {
          this.#view.showRefreshNotif();
        }
      }
    } catch (err) {
      let errorMessage = "Gagal memuat data. Cek koneksi atau token Anda.";
      if (err.message?.includes("401") || err.status === 401) {
        errorMessage = "Token tidak valid atau expired. Silakan login ulang.";
      } else if (err.message?.includes("fetch") || err.name === "TypeError") {
        errorMessage = "Koneksi bermasalah. Coba lagi nanti.";
      }
      this.#view.showError(errorMessage);
    } finally {
      this.#view.hideLoading();
    }
  }
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
