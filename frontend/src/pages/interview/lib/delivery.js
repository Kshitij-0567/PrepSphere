// Shared helpers for the interview room and the video results page.

// Keep in sync with FILLER_PATTERNS in backend/services/delivery.py, which counts them.
export const FILLER_RE = /\bu+m+\b|\b(?:u+h+|e+r+m*)\b|\bbasically\b|\bliterally\b|\byou know\b|\bi mean\b|(?<=,\s*)like\b|\blike(?=\s*,)/gi;

/** Splits text into [{text, filler}] parts so filler words can be highlighted. */
export function fillerParts(text) {
    const parts = [];
    let last = 0;
    for (const match of (text || '').matchAll(FILLER_RE)) {
        if (match.index > last) parts.push({ text: text.slice(last, match.index), filler: false });
        parts.push({ text: match[0], filler: true });
        last = match.index + match[0].length;
    }
    if (last < (text || '').length) parts.push({ text: text.slice(last), filler: false });
    return parts;
}

export const PACE_TARGET = [120, 160];

export function clock(seconds, pad = false) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    return `${pad ? String(m).padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`;
}

export const KIND_LABEL = { spoken: 'Spoken', code: 'Coding', design: 'Whiteboard' };

export const LANGUAGE_LABEL = {
    python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++', c: 'C', go: 'Go', sql: 'SQL', verilog: 'Verilog',
};

export function resultBand(score) {
    if (score == null) return '';
    if (score >= 8.5) return 'Excellent';
    if (score >= 7) return 'Good';
    if (score >= 5) return 'Satisfactory';
    if (score >= 3) return 'Incomplete';
    return 'Needs work';
}

// Room preferences are remembered on this device.
const SETTINGS_KEY = 'prepsphere-interview-room';
export const DEFAULT_SETTINGS = { mode: 'real', thinking: true, eye: true, keep: true, voice: true, captions: true, lang: 'en-IN', voiceURI: null, cameraId: null, micId: null };

export function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}

export function readDraft(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

export function writeDraft(key, value) {
    try {
        if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage full or unavailable */ }
}

// Unsent work on the coding and design steps survives a refresh.
export const codeDraftKey = (questionId) => `prepsphere-code-${questionId}`;
export const boardDraftKey = (questionId) => `prepsphere-board-${questionId}`;
export const notesDraftKey = (questionId) => `prepsphere-notes-${questionId}`;
