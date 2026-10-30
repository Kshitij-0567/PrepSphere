// Browser speech: live captions (speech recognition) and the interviewer's voice (speech synthesis).

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const captionsSupported = Boolean(Recognition);
export const voiceSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/**
 * Live captions for one answer. Chrome ends recognition after a pause, so it restarts itself until
 * stopped. Segment times are seconds of recorded time (pauses from pause() are left out).
 */
export function createCaptions({ lang = 'en-IN', onChange, onError } = {}) {
    if (!Recognition) return null;
    let rec = null;
    let active = false;
    let finals = [];
    let interim = '';
    let pendingStart = null;
    let started = 0;
    let pausedAt = null;
    let pausedTotal = 0;
    const now = () => ((pausedAt ?? performance.now()) - started - pausedTotal) / 1000;
    const emit = () => onChange?.({ text: finals.map(f => f.text).join(' '), interim });

    const run = () => {
        try {
            rec = new Recognition();
            rec.lang = lang;
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = (event) => {
                interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const text = result[0].transcript.trim();
                    if (!text) continue;
                    if (pendingStart === null) pendingStart = Math.max(0, now() - 1);
                    if (result.isFinal) {
                        finals.push({ start: Math.round(pendingStart * 10) / 10, text });
                        pendingStart = null;
                    } else {
                        interim += `${text} `;
                    }
                }
                interim = interim.trim();
                emit();
            };
            rec.onerror = (event) => {
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
                    active = false;
                    onError?.(event.error);
                }
            };
            rec.onend = () => { if (active && pausedAt === null) setTimeout(() => { if (active && pausedAt === null) run(); }, 120); };
            rec.start();
        } catch {
            onError?.('unavailable');
        }
    };

    return {
        start() {
            finals = []; interim = ''; pendingStart = null; pausedTotal = 0; pausedAt = null;
            started = performance.now();
            active = true;
            emit();
            run();
        },
        pause() {
            if (!active || pausedAt !== null) return;
            pausedAt = performance.now();
            try { rec?.stop(); } catch { /* ignore */ }
        },
        resume() {
            if (!active || pausedAt === null) return;
            pausedTotal += performance.now() - pausedAt;
            pausedAt = null;
            run();
        },
        stop() {
            active = false;
            // Anything still interim when the candidate stops counts as said.
            if (interim) { finals.push({ start: Math.round((pendingStart ?? now()) * 10) / 10, text: interim }); interim = ''; }
            try { rec?.stop(); } catch { /* ignore */ }
            rec = null;
            return { text: finals.map(f => f.text).join(' ').trim(), segments: finals.slice() };
        },
        snapshot: () => ({ text: [...finals.map(f => f.text), interim].join(' ').trim(), segments: finals.slice() }),
    };
}

export function englishVoices() {
    if (!voiceSupported) return [];
    let list = [];
    try { list = speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)); } catch { return []; }
    const rank = v => (/en[-_]IN/i.test(v.lang) ? 0 : 2) + (/natural|online|neural/i.test(v.name) ? 0 : 1);
    return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

const LANG_NAMES = { 'en-IN': 'English (India)', 'en-US': 'English (US)', 'en-GB': 'English (UK)', 'en-AU': 'English (Australia)' };
export const languageName = code => LANG_NAMES[code?.replace('_', '-')] || code;
export const voiceLabel = v => `${v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*Online \(Natural\)/, '').replace(/\s+-\s+.*$/, '')} · ${languageName(v.lang)}`;

/**
 * Speaks `text`. onWord(charIndex) fires as words are spoken when the voice reports word boundaries;
 * onEnd fires once, when speech finishes or fails. Returns a cancel function.
 */
export function speak(text, { voiceURI, onStart, onWord, onEnd } = {}) {
    let done = false;
    const finish = () => { if (!done) { done = true; onEnd?.(); } };
    if (!voiceSupported) { finish(); return () => {}; }
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voice = speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-IN'; }
        u.rate = 1;
        u.onstart = () => onStart?.();
        u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) onWord?.(e.charIndex); };
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
        // Some voices never fire onend (a long-standing Chrome bug); stop waiting after a generous limit.
        const limit = setTimeout(finish, 4000 + text.split(/\s+/).length * 700);
        return () => { clearTimeout(limit); done = true; try { speechSynthesis.cancel(); } catch { /* ignore */ } };
    } catch {
        finish();
        return () => {};
    }
}

export function stopSpeaking() {
    if (voiceSupported) { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
}
