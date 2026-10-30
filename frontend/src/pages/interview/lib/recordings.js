// Answer recordings live only in this browser (IndexedDB). They are never uploaded.
// Every call resolves (with null or [] on failure) so private windows and blocked storage just
// mean "no replay", never an error.

const DB_NAME = 'prepsphere-recordings';
const STORE = 'clips';
export const KEEP_INTERVIEWS = 5;

let dbPromise = null;

function openDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!dbPromise) {
        dbPromise = new Promise((resolve) => {
            let request;
            try {
                request = indexedDB.open(DB_NAME, 1);
            } catch {
                resolve(null);
                return;
            }
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
                store.createIndex('interviewId', 'interviewId');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });
    }
    return dbPromise;
}

function run(mode, work) {
    return openDb().then(db => {
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE, mode);
                const result = work(tx.objectStore(STORE));
                tx.oncomplete = () => resolve(result?.result ?? result ?? true);
                tx.onerror = () => resolve(null);
                tx.onabort = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    });
}

async function allClips() {
    return (await run('readonly', store => store.getAll())) || [];
}

/** Saves one question's clip, then keeps only the most recent interviews on this device. */
export async function saveClip({ interviewId, questionId, stepIndex, blob, duration, answerOffset }) {
    if (!blob?.size) return false;
    const saved = await run('readwrite', store => store.put({
        key: `${interviewId}:${questionId}`, interviewId: Number(interviewId), questionId, stepIndex,
        blob, mime: blob.type, duration, answerOffset, savedAt: Date.now(),
    }));
    await prune();
    return Boolean(saved);
}

export async function getClips(interviewId) {
    const clips = (await run('readonly', store => store.index('interviewId').getAll(Number(interviewId)))) || [];
    return Array.isArray(clips) ? clips : [];
}

export async function deleteInterviewClips(interviewId) {
    const clips = await getClips(interviewId);
    if (!clips.length) return true;
    return Boolean(await run('readwrite', store => clips.forEach(c => store.delete(c.key))));
}

export async function deleteAllClips() {
    return Boolean(await run('readwrite', store => store.clear()));
}

export async function usage() {
    const clips = await allClips();
    return {
        interviews: new Set(clips.map(c => c.interviewId)).size,
        bytes: clips.reduce((sum, c) => sum + (c.blob?.size || 0), 0),
    };
}

async function prune() {
    const clips = await allClips();
    const latest = new Map();
    clips.forEach(c => latest.set(c.interviewId, Math.max(latest.get(c.interviewId) || 0, c.savedAt)));
    const keep = new Set([...latest.entries()].sort((a, b) => b[1] - a[1]).slice(0, KEEP_INTERVIEWS).map(([id]) => id));
    const stale = clips.filter(c => !keep.has(c.interviewId));
    if (stale.length) await run('readwrite', store => stale.forEach(c => store.delete(c.key)));
}

export function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
