export interface OfflineVideoItem {
  id: string;
  title: string;
  fileName: string;
  size: number;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
  source: 'local_file' | 'direct_url';
  sourceUrl?: string;
}

export interface OfflineVideoRecord extends OfflineVideoItem {
  blob: Blob;
}

const DB_NAME = 'moviweb_offline_library';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

const videoExt = /\.(mp4|webm|m4v|mov|mkv)$/i;

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('Offline storage is not available on this device.'));
    return;
  }

  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt');
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error('Could not open offline storage.'));
});

const requestToPromise = <T,>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error('Offline storage request failed.'));
});

const transactionDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error ?? new Error('Offline storage transaction failed.'));
  tx.onabort = () => reject(tx.error ?? new Error('Offline storage transaction was cancelled.'));
});

const withoutBlob = ({ blob: _blob, ...item }: OfflineVideoRecord): OfflineVideoItem => item;

const cleanTitleFromName = (name: string) =>
  name.replace(videoExt, '').replace(/[._-]+/g, ' ').trim() || name;

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const putRecord = async (record: OfflineVideoRecord) => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    await transactionDone(tx);
  } finally {
    db.close();
  }
};

export const listOfflineVideos = async (): Promise<OfflineVideoItem[]> => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const records = await requestToPromise<OfflineVideoRecord[]>(tx.objectStore(STORE_NAME).getAll());
    return records
      .map(withoutBlob)
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
};

export const getOfflineVideo = async (id: string): Promise<OfflineVideoRecord> => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const record = await requestToPromise<OfflineVideoRecord | undefined>(tx.objectStore(STORE_NAME).get(id));
    if (!record) throw new Error('Offline video was not found.');
    return record;
  } finally {
    db.close();
  }
};

export const saveOfflineVideoFromFile = async (file: File, title?: string): Promise<OfflineVideoItem> => {
  if (!file.type.startsWith('video/') && !videoExt.test(file.name)) {
    throw new Error('Choose a video file.');
  }

  const now = Date.now();
  const record: OfflineVideoRecord = {
    id: makeId(),
    title: title?.trim() || cleanTitleFromName(file.name),
    fileName: file.name,
    size: file.size,
    mimeType: file.type || 'video/mp4',
    createdAt: now,
    updatedAt: now,
    source: 'local_file',
    blob: file,
  };

  await putRecord(record);
  return withoutBlob(record);
};

export const saveOfflineVideoFromUrl = async (url: string, title?: string): Promise<OfflineVideoItem> => {
  const cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) throw new Error('Enter a valid video URL.');

  const res = await fetch(cleanUrl, { mode: 'cors' });
  if (!res.ok) throw new Error('Could not download that video file.');

  const contentType = res.headers.get('content-type') || 'video/mp4';
  if (!contentType.startsWith('video/')) throw new Error('That URL did not return a video file.');

  const blob = await res.blob();
  const urlName = decodeURIComponent(cleanUrl.split('/').pop()?.split('?')[0] || 'video.mp4');
  const now = Date.now();
  const record: OfflineVideoRecord = {
    id: makeId(),
    title: title?.trim() || cleanTitleFromName(urlName),
    fileName: urlName,
    size: blob.size,
    mimeType: blob.type || contentType,
    createdAt: now,
    updatedAt: now,
    source: 'direct_url',
    sourceUrl: cleanUrl,
    blob,
  };

  await putRecord(record);
  return withoutBlob(record);
};

export const deleteOfflineVideo = async (id: string): Promise<void> => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await transactionDone(tx);
  } finally {
    db.close();
  }
};
