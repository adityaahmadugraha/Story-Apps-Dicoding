import AuthModel from "../../models/models.js";

export default class AuthPresenter {
  constructor(view) {
    this.view = view;
  }

  init() {
    const token = AuthModel.getToken();
    const currentHash = window.location.hash;

    if (!token && !(currentHash.startsWith("#/login") || currentHash.startsWith("#/register"))) {
      this.view.redirectToLogin();
    } else if (token && (currentHash.startsWith("#/login") || currentHash.startsWith("#/register"))) {
      this.view.redirectToHome();
    }
  }

  async handleLogout() {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const token = AuthModel.getToken();
          await AuthModel.unsubscribePushNotification(subscription.endpoint, token);
          await subscription.unsubscribe();
        }
      }
    } catch (err) {
      console.warn("Gagal unsubscribe push:", err);
    }

    AuthModel.removeToken();
    this.view.hideLogoutModal();
    this.view.redirectToLogin();
  }
}
