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
      await this.loadStories();
    });
  }

  async syncOfflineStories(token) {
    if (StoryDB.isSyncInProgress()) {
      return;
    }

    let pendingStories = await StoryDB.getPendingStories();
    if (!pendingStories || pendingStories.length === 0) {
      return;
    }

    StoryDB.setSyncInProgress(true);
    let successCount = 0;

    try {
      await StoryDB.cleanDuplicatePendingStories();
      pendingStories = await StoryDB.getPendingStories();

      for (const story of pendingStories) {
        try {
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

            localStorage.setItem("newStoryAdded", "true");
            console.log("Offline story synced & deleted:", story.id);
          } else {
            console.error("Sync gagal untuk story:", story.id, response);
          }
        } catch (syncErr) {
          console.error("Individual sync error untuk story", story.id, ":", syncErr);
        }
      }

      if (successCount > 0) {
        if (this.#view.showSnackbar) {
          this.#view.showSnackbar(`Sync sukses: ${successCount} story dikirim ke server!`);
        }
      }
    } catch (err) {
      console.error("Sync error keseluruhan:", err);
      if (this.#view.showSnackbar) {
        this.#view.showSnackbar("❌ Gagal sync offline stories.", true);
      }
    } finally {
      StoryDB.setSyncInProgress(false);
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
