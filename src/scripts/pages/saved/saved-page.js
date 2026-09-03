import { getSavedStories, deleteSavedStory } from "../../utils/db.js";

export default class SavedPage {
  async render() {
    return `
      <section class="container">
        <div id="saved-list" class="story-list" tabindex="-1"></div>
      </section>
    `;
  }

  async afterRender() {
    this.savedList = document.querySelector("#saved-list");
    await this._loadSaved();
  }

  async _loadSaved() {
    const stories = await getSavedStories();

    if (!stories || stories.length === 0) {
      this.savedList.innerHTML = `<p class="empty-message">Belum ada cerita yang disimpan.</p>`;
      return;
    }

    this.savedList.innerHTML = stories
      .map((story) => {
        let photoSrc = story.photoUrl || story.photoBase64;
        return `
          <article class="story-item" data-id="${story.id}">
            ${photoSrc ? `<img src="${photoSrc}" alt="Foto dari ${story.name || "Offline User"}" />` : ""}
            <div class="story-content">
              <div class="story-header">
                <h2>${story.name || "Offline User"}</h2>
                <button class="delete-saved-btn" data-id="${story.id}" aria-label="Hapus dari tersimpan" title="Hapus">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              <p>${story.description}</p>
            </div>
          </article>
        `;
      })
      .join("");

    this._wireDeleteButtons();
  }

  _wireDeleteButtons() {
    const buttons = this.savedList.querySelectorAll(".delete-saved-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await deleteSavedStory(id);
        await this._loadSaved();
      });
    });
  }
}
