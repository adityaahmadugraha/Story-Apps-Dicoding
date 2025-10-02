import "../../../styles/register.css";
import RegisterPresenter from "./register-presenter";

export default class RegisterPage {
  #presenter;
  #form;
  #progress;
  #snackbar;

  async render() {
    return `
      <section class="register-container">
        <h1>Register</h1>
        <form id="register-form">
          <label>Nama:</label>
          <input type="text" id="name" required />
          
          <label>Email:</label>
          <input type="email" id="email" required />
          
          <label>Password:</label>
          <input type="password" id="password" required minlength="8" />
          
          <button type="submit" id="register-btn">Register</button>
          <div id="progress-bar" class="progress hidden"></div>
        </form>

        <p class="login-text">
          Sudah memiliki akun? <a href="#/login">Login di sini</a>
        </p>

        <div id="snackbar"></div>
      </section>
    `;
  }

  async afterRender() {
    this.#form = document.querySelector("#register-form");
    this.#progress = document.querySelector("#progress-bar");
    this.#snackbar = document.querySelector("#snackbar");

    this.#presenter = new RegisterPresenter({ view: this });

    this.#form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.querySelector("#name").value.trim();
      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value.trim();

      this.#presenter.handleRegister({ name, email, password });
    });
  }

  showLoading() {
    this.#progress.classList.remove("hidden");
  }

  hideLoading() {
    this.#progress.classList.add("hidden");
  }

  showSuccess(message) {
    this._showSnackbar(message, "#4caf50");
  }

  showError(message) {
    this._showSnackbar(message, "#dc3545");
  }

  _showSnackbar(message, bgColor) {
    this.#snackbar.innerText = message;
    this.#snackbar.style.background = bgColor;
    this.#snackbar.style.color = "#fff";
    this.#snackbar.classList.add("show");
    setTimeout(() => this.#snackbar.classList.remove("show"), 2500);
  }

  onRegisterSuccess(message) {
    this.showSuccess(message);
    setTimeout(() => {
      this.redirectToLogin();
    }, 2000);
  }

  redirectToLogin() {
    window.location.hash = "#/login";
  }
}
