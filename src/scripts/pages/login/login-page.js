import "../../../styles/login.css";
import LoginPresenter from "./login-presenter";

export default class LoginPage {
  #presenter;
  #loader;

  async render() {
    return `
      <section class="container login-container" aria-labelledby="login-title">
        <h1 id="login-title">Login</h1>
        <form id="login-form">
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" required autocomplete="username" />
          
          <label for="password">Password:</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" />
          
          <button type="submit" id="login-btn">Login</button>
          <div id="progress-bar" class="progress hidden"></div>
        </form>

        <p class="register-text">Belum punya akun? <a href="#/register">Daftar di sini</a></p>
        <div id="snackbar"></div>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new LoginPresenter({ view: this });
    this.#loader = document.querySelector("#progress-bar");

    const form = document.querySelector("#login-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value.trim();
      this.#presenter.submitLogin({ email, password });
    });
  }

  showLoading() {
    this.#loader.classList.remove("hidden");
  }

  hideLoading() {
    this.#loader.classList.add("hidden");
  }

  showSnackbar(message, isError = false) {
    const snackbar = document.querySelector("#snackbar");
    snackbar.innerText = message;
    snackbar.style.background = isError ? "#dc3545" : "#4caf50";
    snackbar.style.color = "#fff";
    snackbar.classList.add("show");
    setTimeout(() => snackbar.classList.remove("show"), 2500);
  }

  onLoginSuccess(token) {
    this.showSnackbar("✅ Login sukses");
    setTimeout(() => {
      window.location.hash = "/";
    }, 1500);
  }
}
