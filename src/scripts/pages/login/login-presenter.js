import Models from "../../models/models.js";

export default class LoginPresenter {
  #view;
  #models;

  constructor({ view, models = Models }) {
    this.#view = view;
    this.#models = models;
  }

  submitLogin = async ({ email, password }) => {
    if (!email || !password) {
      this.#view.showSnackbar("Email dan password wajib diisi!", true);
      return;
    }

    try {
      this.#view.showLoading();

      const res = await this.#models.login({ email, password });

      if (!res.error && res.loginResult?.token) {
        this.#models.saveToken(res.loginResult.token);
        this.#view.onLoginSuccess(res.loginResult.token);
      } else {
        this.#view.showSnackbar("❌ " + (res.message || "Login gagal"), true);
      }
    } catch (err) {
      this.#view.showSnackbar("⚠️ Error server", true);
      console.error("LoginPresenter error:", err);
    } finally {
      this.#view.hideLoading();
    }
  };
}
