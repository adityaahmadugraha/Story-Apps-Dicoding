import HomePresenter from "./home-presenter.js";
import { saveStory, isStorySaved } from "../../utils/db.js";
let L;
let storyIcon;

async function loadLeaflet() {
  if (L) return L;
  const leafletModule = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  L = leafletModule.default;

  storyIcon = L.icon({
    iconUrl: require("leaflet/dist/images/marker-icon.png"),
    shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  return L;
}

export default class HomePage {
  #presenter;
  #map;
  #markers = [];

  async render() {
    return `
    <section class="container">
      <div id="loader" class="loader hidden">
        <div class="spinner"></div>
        <p>Sedang memuat data...</p>
      </div>

      <div id="refresh-notif" class="refresh-notif hidden">
        <span></span>
      </div>

      <div id="story-list" class="story-list" tabindex="-1"></div>
      <div id="map" style="height: 400px; margin-top:20px;"></div>
      <div class="progress-bar-container hidden">
        <div class="progress-bar"></div>
      </div>
    </section>
  `;
  }

  async afterRender() {
    console.log("HomePage.afterRender() mulai");

    await loadLeaflet();

    this.loader = document.querySelector("#loader");
    this.storyList = document.querySelector("#story-list");
    this.mapElement = document.querySelector("#map");
    this.refreshNotif = document.querySelector("#refresh-notif");

    if (this.refreshNotif) {
      this.refreshNotif.addEventListener("click", () => {
        this.refreshNotif.classList.add("hidden");
        this.#presenter?.loadStories();
      });
    }
    this.progressBar = document.querySelector(".progress-bar-container");

    if (this.#map) {
      console.log("Hapus map lama dulu");
      this.#map.remove();
      this.#map = null;
    }

    console.log("Inisialisasi map baru");
    this.#map = L.map(this.mapElement).setView([-2.5489, 118.0149], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.#map);

    setTimeout(() => {
      console.log("invalidateSize() awal");
      this.#map.invalidateSize(true);
    }, 300);

    this.#presenter = new HomePresenter({ view: this });
    await this.#presenter.loadStories();
  }

  hideRefreshNotif() {
    console.log("hideRefreshNotif()");
    if (this.refreshNotif) {
      this.refreshNotif.classList.add("hidden");
    }
  }

  showLoading() {
    console.log("showLoading()");
    if (!this.loader) return;
    this.loader.classList.remove("hidden");
    if (this.progressBar) this.progressBar.classList.remove("hidden");
  }

  hideLoading() {
    console.log("hideLoading()");
    if (!this.loader) return;
    this.loader.classList.add("hidden");
    if (this.progressBar) this.progressBar.classList.add("hidden");
  }

  showStories(stories) {
    console.log(`showStories() dengan ${stories.length} story`);

    if (this.refreshNotif) {
      this.refreshNotif.classList.add("hidden");
    }

    if (this.storyList) {
      this.storyList.innerHTML = stories
        .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
        .map((story) => {
          const date = story.createdAt || story.timestamp ? new Date(story.createdAt || story.timestamp).toISOString().split("T")[0] : "-";

          let photoSrc = story.photoUrl || story.photoBase64;
          if (story.photo instanceof File || story.photo instanceof Blob) {
            photoSrc = URL.createObjectURL(story.photo);
          }

          return `
            <article class="story-item" data-id="${story.id}">
              ${photoSrc ? `<img src="${photoSrc}" alt="Foto dari ${story.name || "Offline User"}" />` : ""}
              <div class="story-content">
                <div class="story-header">
                  <h2>${story.name || "Offline User"}</h2>
                  <button class="bookmark-btn" data-id="${story.id}" aria-label="Simpan story ini" title="Simpan story">
                    <i class="fa-regular fa-bookmark"></i>
                  </button>
                </div>
                <p>${story.description}</p>
                <small>Tanggal: ${date}</small>
                ${story.status === "pending_sync" ? "<span class='badge badge-warning'>Menunggu Sync</span>" : ""}
              </div>
            </article>
          `;
        })
        .join("");

      this._wireBookmarkButtons(stories);
    }

    this.renderMap(stories);

    setTimeout(() => {
      if (this.#map) {
        console.log("invalidateSize() setelah showStories()");
        this.#map.invalidateSize(true);
      }
    }, 300);
  }

  async _wireBookmarkButtons(stories) {
    const buttons = this.storyList.querySelectorAll(".bookmark-btn");
    for (const btn of buttons) {
      const id = btn.dataset.id;
      const alreadySaved = await isStorySaved(id);
      if (alreadySaved) {
        btn.classList.add("saved");
        btn.querySelector("i").className = "fa-solid fa-bookmark";
      }

      btn.addEventListener("click", async () => {
        const story = stories.find((s) => String(s.id) === String(id));
        if (!story) return;

        if (btn.classList.contains("saved")) return;

        await saveStory(story);
        btn.classList.add("saved");
        btn.querySelector("i").className = "fa-solid fa-bookmark";
        btn.setAttribute("aria-label", "Story sudah tersimpan");
      });
    }
  }

  showError(message) {
    console.log("showError():", message);
    if (!this.storyList) return;
    this.storyList.innerHTML = `
    <div class="error-message" role="alert">
      <p>${message}</p>
      <p>🔄 Coba muat ulang ketika online</p>
    </div>`;

    this.hideLoading();
  }

  renderMap(stories) {
    console.log(`renderMap() dengan ${stories.length} story`);

    if (!this.#map) {
      console.warn("Map belum siap, skip renderMap()");
      return;
    }

    this.#markers.forEach((marker) => this.#map.removeLayer(marker));
    this.#markers = [];

    const locatableStories = stories.filter((s) => s.lat && s.lon);
    console.log(`Jumlah story dengan lokasi: ${locatableStories.length}`);

    locatableStories.forEach((story) => {
      const popupContent = `<b>${story.name || "Offline Story"}</b><br>${story.description}`;
      const marker = L.marker([story.lat, story.lon], { icon: storyIcon }).addTo(this.#map).bindPopup(popupContent);
      this.#markers.push(marker);
    });

    if (this.#markers.length > 0) {
      console.log("Fit bounds untuk semua marker");
      this.#map.fitBounds(
        this.#markers.map((m) => m.getLatLng()),
        { padding: [20, 20] },
      );
    } else {
      console.log("Tidak ada marker untuk ditampilkan");
    }
  }

  showRefreshNotif() {
    console.log("showRefreshNotif()");
    if (!this.refreshNotif) return;
    this.refreshNotif.querySelector("span").textContent = "✅ Data diperbarui! Klik untuk memuat ulang.";
    this.refreshNotif.classList.remove("hidden");

    if (this.progressBar) this.progressBar.classList.add("hidden");
    if (this.loader) this.loader.classList.add("hidden");
  }
}
