import React, { useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { clock } from './lib/delivery';

/**
 * The candidate's own camera, mirrored like a selfie view, with the face-tracking frame,
 * a recording timer and mic / camera toggles. `videoRef` is shared with the face tracker.
 */
const CameraTile = ({
    stream, videoRef, cameraOn, micOn, onToggleCamera, onToggleMic, tracker, showFrame,
    recordingSince, label = 'You', initials = '', wide = false, children,
}) => {
    const overlayRef = useRef(null);
    const [inFrame, setInFrame] = useState(false);
    const [recSeconds, setRecSeconds] = useState(0);

    useEffect(() => {
        const video = videoRef.current;
        if (video && video.srcObject !== stream) video.srcObject = stream || null;
        if (video && stream) video.play().catch(() => {});
    }, [stream, videoRef]);

    useEffect(() => {
        if (!recordingSince) return undefined;
        const tick = () => setRecSeconds((performance.now() - recordingSince) / 1000);
        const id = setInterval(tick, 500);
        return () => { clearInterval(id); setRecSeconds(0); };
    }, [recordingSince]);

    // Face frame corners, drawn where the tracker last saw the face.
    useEffect(() => {
        const canvas = overlayRef.current;
        let frame = 0;
        const draw = () => {
            frame = requestAnimationFrame(draw);
            if (!canvas?.offsetParent) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            const s = tracker?.state();
            const visible = Boolean(showFrame && cameraOn && s?.face && performance.now() - s.at < 1200);
            setInFrame(prev => (prev === visible ? prev : visible));
            if (!visible || !s.box) return;
            // The video is object-fit: cover and mirrored; map the box the same way.
            const video = videoRef.current;
            const vw = video?.videoWidth || 640, vh = video?.videoHeight || 480;
            const scale = Math.max(w / vw, h / vh), ox = (w - vw * scale) / 2, oy = (h - vh * scale) / 2;
            const pad = 0.12;
            const bx = ox + (1 - s.box.x - s.box.w * (1 + pad)) * vw * scale;
            const by = oy + (s.box.y - s.box.h * pad) * vh * scale;
            const bw = s.box.w * (1 + pad * 2) * vw * scale, bh = s.box.h * (1 + pad * 2) * vh * scale;
            const k = Math.min(bw, bh) * 0.18;
            ctx.strokeStyle = 'rgba(52,211,153,0.9)';
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            ctx.moveTo(bx, by + k); ctx.lineTo(bx, by); ctx.lineTo(bx + k, by);
            ctx.moveTo(bx + bw - k, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + k);
            ctx.moveTo(bx + bw, by + bh - k); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw - k, by + bh);
            ctx.moveTo(bx + k, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx, by + bh - k);
            ctx.stroke();
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [tracker, showFrame, cameraOn, videoRef]);

    return (
        <div className={`vi-cam ${wide ? 'is-wide' : ''}`}>
            <video ref={videoRef} className="vi-cam-video" muted playsInline autoPlay aria-label="Your camera" hidden={!cameraOn || !stream} />
            {(!cameraOn || !stream) && (
                <div className="vi-cam-off"><span>{initials}</span><p>{stream ? 'Camera off' : 'No camera'}</p></div>
            )}
            <canvas ref={overlayRef} className="vi-cam-overlay" aria-hidden="true" />
            <span className="vi-pill tl">{label}</span>
            {recordingSince ? <span className="vi-pill tr rec">REC {clock(recSeconds)}</span> : null}
            {inFrame && <span className="vi-pill bl good"><Check size={12} aria-hidden="true" />In frame</span>}
            {children}
            <div className="vi-cam-ctrls">
                {onToggleMic && (
                    <button type="button" className="vi-btn vi-icon" aria-pressed={micOn} onClick={onToggleMic} title={micOn ? 'Mute microphone' : 'Unmute microphone'} aria-label="Microphone">
                        {micOn ? <Mic size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />}
                    </button>
                )}
                {onToggleCamera && (
                    <button type="button" className="vi-btn vi-icon" aria-pressed={cameraOn} onClick={onToggleCamera} title={cameraOn ? 'Turn camera off' : 'Turn camera on'} aria-label="Camera">
                        {cameraOn ? <Video size={16} aria-hidden="true" /> : <VideoOff size={16} aria-hidden="true" />}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CameraTile;
