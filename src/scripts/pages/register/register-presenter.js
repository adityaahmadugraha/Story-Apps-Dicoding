import Models from "../../models/models.js";

export default class RegisterPresenter {
  #view;
  #models;

  constructor({ view, models = Models }) {
    this.#view = view;
    this.#models = models;
  }

  handleRegister = async ({ name, email, password }) => {
    if (!name || !email || !password) {
      this.#view.showError("Semua field wajib diisi!");
      return;
    }

    if (password.length < 8) {
      this.#view.showError("Password minimal 8 karakter");
      return;
    }

    this.#view.showLoading();

    try {
      const result = await this.#models.register({ name, email, password });

      if (!result.error) {
        this.#view.onRegisterSuccess("✅ Registrasi berhasil, silakan login!");
      } else {
        this.#view.showError("❌ " + (result.message || "Registrasi gagal"));
      }
    } catch (err) {
      this.#view.showError("⚠️ Error server");
      console.error("RegisterPresenter error:", err);
    } finally {
      this.#view.hideLoading();
    }
  };
}
