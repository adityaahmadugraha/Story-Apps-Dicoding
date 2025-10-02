import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../../styles/add.css";
import AddPresenter from "./add-presenter";

const customIcon = L.icon({
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default class AddPage {
  async render() {
    return `
      <section class="container">
        <form id="add-form">
          <label for="description">Deskripsi:</label>
          <textarea id="description" name="description"></textarea>

          <label>Foto:</label>
          <div class="camera-container">
            <video id="camera" autoplay playsinline style="width:100%; max-height:300px; display:none;"></video>
            <canvas id="canvas" style="display:none;"></canvas>
            <div class="camera-actions">
              <button type="button" id="start-camera">📷 Kamera</button>
              <button type="button" id="take-photo" style="display:none;">📸 Ambil Foto</button>
              <button type="button" id="delete-photo" style="display:none;">🗑 Hapus Foto</button>
            </div>
          </div>

          <div id="photo-preview-container" style="margin-top:10px; display:none;">
            <p>📸 Hasil Foto:</p>
            <img id="photo-preview" src="" alt="Preview Foto" style="max-width:100%; border:1px solid #ccc; border-radius:8px;" />
          </div>

          <input type="hidden" id="photo" name="photo" />
          <label>Pilih Lokasi:</label>
          <div id="map-add" style="height:300px;"></div>
          <input type="hidden" id="lat" name="lat" />
          <input type="hidden" id="lon" name="lon" />

          <div id="loader" class="loader hidden"></div>
          <button type="submit">Tambah</button>
        </form>
      </section>
      <div id="toast" class="toast"></div>
    `;
  }

  async afterRender() {
    this.toast = document.querySelector("#toast");
    this.loader = document.querySelector("#loader");
    this.presenter = new AddPresenter(this);

    this.video = document.querySelector("#camera");
    this.canvas = document.querySelector("#canvas");
    this.photoInput = document.querySelector("#photo");
    this.previewContainer = document.querySelector("#photo-preview-container");
    this.previewImg = document.querySelector("#photo-preview");

    this.startBtn = document.querySelector("#start-camera");
    this.takeBtn = document.querySelector("#take-photo");
    this.deleteBtn = document.querySelector("#delete-photo");

    this._setupCamera();
    this._setupMap();
    this._setupForm();
  }

  _setupCamera() {
    this.isCameraOpen = false;

    this.startBtn.addEventListener("click", async () => {
      if (!this.isCameraOpen) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
          this.video.srcObject = this.stream;
          this.video.style.display = "block";
          this.takeBtn.style.display = "inline-block";
          this.startBtn.textContent = "❌ Tutup Kamera";
          this.isCameraOpen = true;
        } catch (err) {
          this.showSnackbar("⚠️ Akses kamera ditolak atau tidak tersedia.", true);
          console.error(err);
        }
      } else {
        this.stopCamera();
        this.takeBtn.style.display = "none";
        this.startBtn.textContent = "📷 Kamera";
        this.showSnackbar("❌ Kamera dihentikan");
      }
    });

    this.takeBtn.addEventListener("click", () => {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this.canvas.getContext("2d").drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

      this.canvas.toBlob(
        (blob) => {
          const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
          this.photoInput.file = file;

          this.previewImg.src = URL.createObjectURL(blob);
          this.previewContainer.style.display = "block";
          this.deleteBtn.style.display = "inline-block";
          this.showSnackbar("✅ Foto berhasil diambil!");
        },
        "image/jpeg",
        0.9
      );

      this.stopCamera();
      this.takeBtn.style.display = "none";
      this.startBtn.textContent = "📷 Kamera";
    });

    this.deleteBtn.addEventListener("click", () => {
      this.photoInput.file = null;
      this.previewImg.src = "";
      this.previewContainer.style.display = "none";
      this.deleteBtn.style.display = "none";
      this.showSnackbar("🗑 Foto dihapus, silakan ambil ulang.");
    });
  }

  _setupMap() {
    const map = L.map("map-add").setView([-2.5489, 118.0149], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    let currentMarker = null;
    map.on("click", (e) => {
      document.querySelector("#lat").value = e.latlng.lat;
      document.querySelector("#lon").value = e.latlng.lng;

      if (currentMarker) map.removeLayer(currentMarker);
      currentMarker = L.marker(e.latlng, { icon: customIcon }).addTo(map);
    });
  }

  _setupForm() {
    const form = document.querySelector("#add-form");
    const submitBtn = form.querySelector("button[type='submit']");

    form.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (submitBtn.disabled) {
          console.warn("Submit button sudah disabled, skip untuk hindari duplikat.");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Menyimpan...";

        const description = document.querySelector("#description").value.trim();
        const photo = this.photoInput.file;
        const lat = document.querySelector("#lat").value;
        const lon = document.querySelector("#lon").value;

        this.presenter
          .submitStory({ description, photo, lat, lon })
          .then(() => {
            const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
            const newNotif = `Story berhasil ditambahkan: "${description || "tanpa deskripsi"}"`;
            notifications.unshift(newNotif);
            localStorage.setItem("notifications", JSON.stringify(notifications));

            this.showSnackbar("✅ Story berhasil ditambahkan!");
          })
          .catch((err) => {
            this.showSnackbar("❌ Gagal menambahkan story", true);
            console.error(err);
          })
          .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Tambah";
          });
      },
      { once: false }
    );
  }
  stopCamera() {
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    if (this.video) this.video.srcObject = null;
    this.video.style.display = "none";
    this.isCameraOpen = false;
  }

  showLoading() {
    this.loader.classList.remove("hidden");
  }

  hideLoading() {
    this.loader.classList.add("hidden");
    this.loader.innerHTML = "";
  }

  showSnackbar(message, isError = false) {
    const toast = document.querySelector("#toast");
    if (!toast) {
      console.warn("Toast element tidak ditemukan!", message);
      return;
    }
    toast.textContent = message;
    toast.style.backgroundColor = isError ? "#dc3545" : "#28a745";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  redirectToLogin() {
    window.location.hash = "#/login";
  }

  redirectToHome() {
    window.location.hash = "#/";
  }

  redirectToLogin() {
    window.location.hash = "#/";
  }
}
