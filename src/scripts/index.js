import "../styles/styles.css";
import App from "./pages/app";
import AuthPresenter from "./pages/auth/auth-presenter.js";
import AuthView from "./pages/auth/auth-view.js";
import Models from "./models/models";

document.addEventListener("DOMContentLoaded", async () => {
  const header = document.querySelector("header");
  const logoutLink = document.querySelector("#logout-link");
  const modal = document.querySelector("#logoutModal");
  const okLogout = document.querySelector("#okLogout");
  const cancelLogout = document.querySelector("#cancelLogout");

  const authView = new AuthView();
  const authPresenter = new AuthPresenter(authView);
  authPresenter.init();

  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      authView.showLogoutModal();
    });
  }

  if (okLogout) {
    okLogout.addEventListener("click", () => {
      authPresenter.handleLogout();
    });
  }

  if (cancelLogout) {
    cancelLogout.addEventListener("click", () => {
      authView.hideLogoutModal();
    });
  }

  const app = new App({
    content: document.querySelector("#main-content"),
    drawerButton: document.querySelector("#drawer-button"),
    navigationDrawer: document.querySelector("#navigation-drawer"),
  });

  const toggleHeader = () => {
    const hash = window.location.hash;
    header.style.display = hash.startsWith("#/login") || hash.startsWith("#/register") ? "none" : "block";
  };

  const setActiveNav = () => {
    const hash = window.location.hash || "#/";
    document.querySelectorAll(".nav-list li a").forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === hash);
    });
  };

  toggleHeader();
  setActiveNav();
  await app.renderPage();

  window.addEventListener("hashchange", async () => {
    toggleHeader();
    setActiveNav();
    if (document.startViewTransition) {
      document.startViewTransition(() => app.renderPage());
    } else {
      await app.renderPage();
    }
  });
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const VAPID_PUBLIC_KEY = "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";

let swRegistration = null;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(async (registration) => {
      console.log("Service Worker terdaftar:", registration);

      const readyRegistration = await navigator.serviceWorker.ready;
      swRegistration = readyRegistration;

      handleNotificationBanner();
    })
    .catch((err) => console.error("SW gagal daftar:", err));
}

function handleNotificationBanner() {
  const banner = document.querySelector("#notif-permission-banner");
  const enableBtn = document.querySelector("#enable-notif-btn");
  const dismissBtn = document.querySelector("#dismiss-notif-btn");

  if (!banner || !("Notification" in window)) return;

  const alreadyDismissed = localStorage.getItem("notifBannerDismissed") === "true";

  if (Notification.permission === "default" && !alreadyDismissed) {
    banner.classList.remove("hidden");
  }

  if (enableBtn) {
    enableBtn.addEventListener("click", async () => {
      const permission = await Notification.requestPermission();
      console.log("Permission notifikasi:", permission);

      banner.classList.add("hidden");

      if (permission === "granted" && swRegistration) {
        initPush(swRegistration);
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      banner.classList.add("hidden");
      localStorage.setItem("notifBannerDismissed", "true");
    });
  }
}

async function initPush(registration) {
  try {
    const token = Models.getToken();
    if (!token) {
      console.warn("⚠️ Belum login, skip subscribe push ke server.");
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("Push subscription baru:", JSON.stringify(subscription));
    } else {
      console.log("Sudah ada subscription:", JSON.stringify(subscription));
    }

    const result = await Models.subscribePushNotification(subscription, token);
    console.log("📡 Subscribe ke server Dicoding:", result);
  } catch (err) {
    console.error("Gagal init push:", err);
  }
}
