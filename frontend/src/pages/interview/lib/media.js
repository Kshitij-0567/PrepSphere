// Camera, microphone and recording helpers for the video interview room.

export const mediaSupported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export async function openStream({ camera = true, cameraId, micId } = {}) {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(micId ? { deviceId: { exact: micId } } : {}) };
    const video = camera ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, ...(cameraId ? { deviceId: { exact: cameraId } } : {}) } : false;
    return navigator.mediaDevices.getUserMedia({ audio, video });
}

export function stopStream(stream) {
    stream?.getTracks().forEach(track => track.stop());
}

export async function listDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const pick = (kind, fallback) => devices.filter(d => d.kind === kind).map((d, i) => ({ id: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
        return { cameras: pick('videoinput', 'Camera'), mics: pick('audioinput', 'Microphone') };
    } catch {
        return { cameras: [], mics: [] };
    }
}

export function permissionMessage(error) {
    const name = error?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'Camera and microphone access is blocked. Allow it from the camera icon in your browser\'s address bar, then try again.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera or microphone was found. Connect one and try again.';
    if (name === 'NotReadableError') return 'Your camera or microphone is being used by another app. Close it and try again.';
    return 'Could not start your camera and microphone. Try again, or continue without them.';
}

/** Live input level (0–1) plus voiced time and long silences, measured every 100 ms. */
export function createMeter(stream) {
    const track = stream?.getAudioTracks()[0];
    if (!track) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let level = 0;
    let noise = 0.01;
    let session = null;

    const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        // Track the room's noise floor slowly so "voiced" adapts to quiet and noisy rooms.
        noise = rms < noise * 2 ? noise * 0.95 + rms * 0.05 : noise * 0.999 + rms * 0.001;
        const voiced = track.enabled && rms > Math.max(0.012, noise * 2.6);
        level = Math.min(1, level * 0.6 + Math.min(1, rms * 9) * 0.4);
        if (session && !session.paused) {
            session.elapsed += 0.1;
            if (voiced) {
                if (session.heard && session.silence >= 3) session.pauses.push([round1(session.elapsed - session.silence), round1(session.silence)]);
                session.speaking += 0.1;
                session.heard = true;
                session.silence = 0;
            } else if (session.heard) {
                session.silence += 0.1;
            }
        }
    };
    const timer = setInterval(tick, 100);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    return {
        level: () => (track.enabled ? level : 0),
        begin() { session = { elapsed: 0, speaking: 0, silence: 0, heard: false, pauses: [], paused: false }; },
        pause() { if (session) session.paused = true; },
        resume() { if (session) session.paused = false; },
        heardSpeech: () => Boolean(session?.heard),
        end() {
            const s = session;
            session = null;
            return s ? { duration: round1(s.elapsed), speaking: round1(s.speaking), pauses: s.pauses } : { duration: 0, speaking: 0, pauses: [] };
        },
        close() { clearInterval(timer); source.disconnect(); ctx.close().catch(() => {}); },
    };
}

const round1 = v => Math.round(v * 10) / 10;

function pickType(candidates) {
    return candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

/** Records one track set; stop() resolves with the blob. Supports pause/resume for think-aloud. */
export function createRecorder(stream, { video = false } = {}) {
    const tracks = video ? stream.getTracks() : stream.getAudioTracks();
    if (!tracks.length) return null;
    const mimeType = video
        ? pickType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'])
        : pickType(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']);
    const options = { ...(mimeType ? { mimeType } : {}), ...(video ? { videoBitsPerSecond: 600_000, audioBitsPerSecond: 64_000 } : { audioBitsPerSecond: 64_000 }) };
    let recorder;
    try {
        recorder = new MediaRecorder(new MediaStream(tracks), options);
    } catch {
        return null;
    }
    const chunks = [];
    const started = performance.now();
    let pausedAt = null;
    let pausedTotal = 0;
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    recorder.start(1000);
    return {
        mimeType: recorder.mimeType || mimeType,
        elapsed: () => ((pausedAt ?? performance.now()) - started - pausedTotal) / 1000,
        pause() { if (recorder.state === 'recording') { recorder.pause(); pausedAt = performance.now(); } },
        resume() { if (recorder.state === 'paused') { recorder.resume(); pausedTotal += performance.now() - pausedAt; pausedAt = null; } },
        isPaused: () => recorder.state === 'paused',
        stop() {
            return new Promise((resolve) => {
                const duration = this.elapsed();
                const finish = () => resolve({ blob: new Blob(chunks, { type: recorder.mimeType || mimeType || 'application/octet-stream' }), duration });
                if (recorder.state === 'inactive') { finish(); return; }
                recorder.onstop = finish;
                recorder.stop();
            });
        },
        cancel() { try { recorder.ondataavailable = null; if (recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ } },
    };
}

/**
 * Converts a recording to 16 kHz mono WAV, which the AI reads reliably (8 kHz past five minutes,
 * keeping uploads small). Keeps the last `maxSeconds`. Returns null if the browser cannot decode it.
 */
export async function toWav(blob, maxSeconds = 480) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || !window.OfflineAudioContext || !blob?.size) return null;
    const ctx = new AudioCtx();
    let decoded;
    try {
        decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
        return null;
    } finally {
        ctx.close().catch(() => {});
    }
    const seconds = Math.min(decoded.duration, maxSeconds);
    const rate = decoded.duration > 300 ? 8000 : 16000;
    const length = Math.max(1, Math.ceil(seconds * rate));
    const offline = new OfflineAudioContext(1, length, rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0, Math.max(0, decoded.duration - maxSeconds));
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const text = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

/** Average brightness (0–255) of the camera image, to warn about a dark room. */
export function frameBrightness(video) {
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, 32, 24);
    const { data } = ctx.getImageData(0, 0, 32, 24);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    return sum / (data.length / 4);
}
