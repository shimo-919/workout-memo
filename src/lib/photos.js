const DB_NAME = "training-memo-photos-v1";
const STORE = "photos";

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "dateKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("写真の保存先を開けなかったよ"));
    };
  });

  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listPhotoMeta() {
  const db = await openDb();
  const records = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  return (records || [])
    .map((record) => ({
      dateKey: record.dateKey,
      byteSize: record.byteSize || record.blob?.size || 0,
      width: record.width || 0,
      height: record.height || 0,
      createdAt: record.createdAt || "",
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export async function getPhotosByDates(dateKeys) {
  if (dateKeys.length === 0) return [];
  const db = await openDb();
  const store = db.transaction(STORE, "readonly").objectStore(STORE);
  const records = await Promise.all(dateKeys.map((key) => requestToPromise(store.get(key))));
  return records.filter(Boolean);
}

export async function getAllPhotoRecords() {
  const db = await openDb();
  const records = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  return records || [];
}

export async function savePhotoRecord(record) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(record);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("写真を保存できなかったよ"));
  });
}

export async function deletePhotoRecord(dateKey) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(dateKey);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
