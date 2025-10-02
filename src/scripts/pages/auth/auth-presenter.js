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

  handleLogout() {
    AuthModel.removeToken();
    this.view.hideLogoutModal();
    this.view.redirectToLogin();
  }
}
