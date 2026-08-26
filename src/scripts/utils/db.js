import { openDB } from "idb";

const DB_NAME = "story-app-db";
const DB_VERSION = 2;
const OBJECT_STORE_NAME = "stories";

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(database) {
    if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
      const store = database.createObjectStore(OBJECT_STORE_NAME, {
        keyPath: "id",
        autoIncrement: false,
      });
      store.createIndex("status", "status", { unique: false });
      store.createIndex("timestamp", "timestamp", { unique: false });
    }
  },
});

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getAllStories() {
  return (await dbPromise).getAll(OBJECT_STORE_NAME);
}

export async function getStory(id) {
  return (await dbPromise).get(OBJECT_STORE_NAME, id);
}

export async function putStory(story) {
  if (!story.timestamp) story.timestamp = new Date().toISOString();
  if (!story.status) story.status = "synced";
  if (!story.id) story.id = generateUUID();
  return (await dbPromise).put(OBJECT_STORE_NAME, story);
}

export async function deleteStory(id) {
  return (await dbPromise).delete(OBJECT_STORE_NAME, id);
}

export async function getPendingStories() {
  const db = await dbPromise;
  const tx = db.transaction(OBJECT_STORE_NAME, "readonly");
  const store = tx.objectStore(OBJECT_STORE_NAME);
  const index = store.index("status");
  return await index.getAll("pending_sync");
}

export async function getSyncedStories() {
  const db = await dbPromise;
  const tx = db.transaction(OBJECT_STORE_NAME, "readonly");
  const store = tx.objectStore(OBJECT_STORE_NAME);
  const index = store.index("status");
  return await index.getAll("synced");
}

export async function updateStoryStatus(id, status) {
  const db = await dbPromise;
  const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
  const store = tx.objectStore(OBJECT_STORE_NAME);
  const story = await store.get(id);
  if (story) {
    story.status = status;
    story.syncedAt = new Date().toISOString();
    await store.put(story);
  }
  return tx.done;
}

export async function bulkPutStories(stories, status = "synced") {
  if (!stories || stories.length === 0) return;

  const db = await dbPromise;
  const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
  const store = tx.objectStore(OBJECT_STORE_NAME);

  for (const story of stories) {
    const storyToSave = {
      ...story,
      id: story.id || generateUUID(),
      status: status,
      timestamp: story.timestamp || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };
    await store.put(storyToSave);
  }

  await tx.done;
}

export async function clearSyncedStories() {
  const db = await dbPromise;
  const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
  const store = tx.objectStore(OBJECT_STORE_NAME);
  const index = store.index("status");
  const syncedStories = await index.getAll("synced");
  for (const story of syncedStories) {
    await store.delete(story.id);
  }
  await tx.done;
}

export function isSyncInProgress() {
  return localStorage.getItem("syncInProgress") === "true";
}

export function setSyncInProgress(inProgress) {
  localStorage.setItem("syncInProgress", inProgress.toString());
}

export async function addOfflineStory(story) {
  if (!story.id) story.id = generateUUID();

  const pendingStories = await getPendingStories();
  const storyHash = `${story.description?.trim() || ""}-${story.lat?.toFixed(6) || ""}-${story.lon?.toFixed(6) || ""}`;
  const duplicate = pendingStories.find((s) => `${s.description?.trim() || ""}-${s.lat?.toFixed(6)}-${s.lon?.toFixed(6)}` === storyHash);
  if (duplicate) {
    return duplicate;
  }

  if (story.photo instanceof File || story.photo instanceof Blob) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(story.photo);
      await new Promise((resolve) => {
        reader.onload = resolve;
      });
      story.photoBase64 = reader.result;
      delete story.photo;
    } catch (err) {
      console.warn("Gagal konversi File/Blob photo ke base64:", err);
    }
  }

  return putStory({ ...story, status: "pending_sync", timestamp: new Date().toISOString() });
}

export async function cleanDuplicatePendingStories() {
  const pendingStories = await getPendingStories();
  if (pendingStories.length === 0) return;

  const uniqueStories = [];
  const seenHashes = new Set();

  for (const story of pendingStories) {
    const hash = `${story.description?.trim() || ""}-${story.lat?.toFixed(6)}-${story.lon?.toFixed(6)}`;
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      uniqueStories.push(story);
    } else {
      await deleteStory(story.id);
      console.log("Duplikat pending dihapus:", story.id);
    }
  }

  await clearPendingStories();
  for (const story of uniqueStories) {
    await putStory(story);
  }
}

async function clearPendingStories() {
  const db = await dbPromise;
  const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
  const store = tx.objectStore(OBJECT_STORE_NAME);
  const index = store.index("status");
  const pendingStories = await index.getAll("pending_sync");
  for (const story of pendingStories) {
    await store.delete(story.id);
  }
  await tx.done;
}

export async function getOfflineStories() {
  return getPendingStories();
}

export async function deleteOfflineStory(id) {
  return deleteStory(id);
}

export default {
  getAllStories,
  getStory,
  putStory,
  deleteStory,
  getPendingStories,
  getSyncedStories,
  updateStoryStatus,
  bulkPutStories,
  clearSyncedStories,
  addOfflineStory,
  getOfflineStories,
  deleteOfflineStory,
  cleanDuplicatePendingStories,
  isSyncInProgress,
  setSyncInProgress,
};
