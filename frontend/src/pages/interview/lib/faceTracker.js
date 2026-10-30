// On-device face tracking (MediaPipe Face Landmarker) for the "in frame" check and eye-contact
// feedback. The model and its WebAssembly runtime are served from this site; no video leaves the
// browser. Loaded only when eye-contact feedback is on.

const SAMPLE_MS = 200;
let landmarkerPromise = null;

async function createLandmarker() {
    const [{ FaceLandmarker }, loader, binary] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
        import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
    ]);
    const fileset = { wasmLoaderPath: loader.default, wasmBinaryPath: binary.default };
    const options = (delegate) => ({
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
    });
    try {
        return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
    } catch {
        return FaceLandmarker.createFromOptions(fileset, options('CPU'));
    }
}

export function loadLandmarker() {
    if (!landmarkerPromise) {
        landmarkerPromise = createLandmarker().catch((error) => {
            landmarkerPromise = null;
            throw error;
        });
    }
    return landmarkerPromise;
}

function lookingAtScreen(result) {
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    if (matrix) {
        // Third column of the rotation is the face's forward direction.
        const fx = matrix[8], fy = matrix[9], fz = matrix[10];
        const yaw = Math.abs(Math.atan2(fx, fz) * 180 / Math.PI);
        const pitch = Math.abs(Math.atan2(-fy, Math.hypot(fx, fz)) * 180 / Math.PI);
        if (yaw > 22 || pitch > 22) return false;
    }
    const shapes = Object.fromEntries((result.faceBlendshapes?.[0]?.categories || []).map(c => [c.categoryName, c.score]));
    const side = Math.max(shapes.eyeLookOutLeft || 0, shapes.eyeLookOutRight || 0, shapes.eyeLookInLeft || 0, shapes.eyeLookInRight || 0);
    const up = Math.max(shapes.eyeLookUpLeft || 0, shapes.eyeLookUpRight || 0);
    const down = Math.max(shapes.eyeLookDownLeft || 0, shapes.eyeLookDownRight || 0);
    return side < 0.6 && up < 0.6 && down < 0.72;
}

/**
 * Samples `video` five times a second. `state()` is the latest reading (face box in 0–1 video
 * coordinates, whether the face is visible and looking at the screen). begin()/end() measure the
 * share of an answer spent in frame and looking at the screen.
 */
export function createFaceTracker(video, { onReady, onError } = {}) {
    let stopped = false;
    let timer = null;
    let latest = { ready: false, face: false, looking: false, box: null, at: 0 };
    let span = null;

    loadLandmarker().then((landmarker) => {
        if (stopped) return;
        latest = { ...latest, ready: true };
        onReady?.();
        let lastTime = -1;
        timer = setInterval(() => {
            if (!video || video.readyState < 2 || video.paused) return;
            const now = performance.now();
            if (now <= lastTime) return;
            lastTime = now;
            let result;
            try { result = landmarker.detectForVideo(video, now); } catch { return; }
            const points = result.faceLandmarks?.[0];
            const face = Boolean(points?.length);
            let box = null;
            if (face) {
                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                for (const p of points) {
                    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
                }
                box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
            }
            const looking = face && lookingAtScreen(result);
            latest = { ready: true, face, looking, box, at: now };
            if (span) {
                span.samples++;
                if (face) span.faces++;
                if (looking) span.looking++;
            }
        }, SAMPLE_MS);
    }).catch((error) => { if (!stopped) onError?.(error); });

    return {
        state: () => latest,
        begin() { span = { samples: 0, faces: 0, looking: 0 }; },
        end() {
            const w = span;
            span = null;
            if (!w || w.samples < 5) return { eye_contact: null, face_in_frame: null };
            return { eye_contact: Math.round((w.looking / w.samples) * 1000) / 1000, face_in_frame: Math.round((w.faces / w.samples) * 1000) / 1000 };
        },
        stop() { stopped = true; clearInterval(timer); },
    };
}
