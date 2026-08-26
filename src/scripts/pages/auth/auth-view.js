export default class AuthView {
  showLogoutModal() {
    const modal = document.querySelector("#logoutModal");
    modal.classList.remove("hidden");
  }

  hideLogoutModal() {
    const modal = document.querySelector("#logoutModal");
    modal.classList.add("hidden");
  }

  redirectToLogin() {
    window.location.hash = "#/login";
  }

  redirectToHome() {
    window.location.hash = "#/";
  }
}
