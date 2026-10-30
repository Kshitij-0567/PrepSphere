import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Lock, Pause, Play } from 'lucide-react';
import { clock } from '../lib/delivery';

const SPEEDS = [1, 1.5, 2];

/**
 * Plays a recorded answer from this device. The seek bar uses the stored duration because
 * MediaRecorder files don't carry one. `markers` are [{t, kind}] in seconds.
 */
const ClipPlayer = forwardRef(({ clip, markers = [], subtitleAt, onTime, audioOnly }, ref) => {
    const videoRef = useRef(null);
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const url = useMemo(() => URL.createObjectURL(clip.blob), [clip.blob]);
    const duration = Math.max(clip.duration || 0, 1);

    useEffect(() => () => URL.revokeObjectURL(url), [url]);

    useImperativeHandle(ref, () => ({
        seek(t) {
            const v = videoRef.current;
            if (!v) return;
            v.currentTime = Math.max(0, Math.min(duration - 0.1, t));
            setTime(v.currentTime);
            onTime?.(v.currentTime);
        },
    }), [duration, onTime]);

    const toggle = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { if (v.currentTime >= duration - 0.2) v.currentTime = 0; v.play().catch(() => {}); } else v.pause();
    };
    const seekTo = (clientX, rect) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
        setTime(v.currentTime);
        onTime?.(v.currentTime);
    };
    const drag = useRef(false);
    const pct = `${Math.min(100, (time / duration) * 100).toFixed(2)}%`;
    const subtitle = subtitleAt?.(time);

    return (
        <div className="vr-player">
            <div className="vr-screen">
                <video
                    ref={videoRef} src={url} playsInline preload="metadata" className={audioOnly ? 'is-audio' : ''}
                    onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); onTime?.(e.currentTarget.currentTime); }}
                    onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                    onLoadedMetadata={(e) => { e.currentTarget.playbackRate = speed; }}
                />
                {audioOnly && <div className="vr-audio-only">Audio recording</div>}
                <span className="vr-saved"><Lock size={12} aria-hidden="true" />Saved on this device</span>
                {subtitle && playing && <p className="vr-subtitle">{subtitle}</p>}
                {!playing && (
                    <button type="button" className="vr-play-big" onClick={toggle} aria-label="Play recording"><Play size={24} fill="currentColor" aria-hidden="true" /></button>
                )}
            </div>
            <div className="vr-controls">
                <button type="button" className="ps-btn ps-btn-sm ps-btn-ghost vr-icon" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                    {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                </button>
                <span className="vr-time ps-mono">{clock(time)} / {clock(duration)}</span>
                <div
                    className="vr-scrub" role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)}
                    onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekTo(e.clientX, e.currentTarget.getBoundingClientRect()); }}
                    onPointerMove={(e) => { if (drag.current) seekTo(e.clientX, e.currentTarget.getBoundingClientRect()); }}
                    onPointerUp={() => { drag.current = false; }}
                    onKeyDown={(e) => {
                        const v = videoRef.current;
                        if (!v) return;
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                            e.preventDefault();
                            v.currentTime = Math.max(0, Math.min(duration, v.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
                        }
                    }}
                >
                    <span className="vr-track" />
                    <span className="vr-fill" style={{ width: pct }} />
                    {markers.filter(m => m.t >= 0 && m.t <= duration).map((m, i) => <span key={i} className={`vr-mk ${m.kind}`} style={{ left: `${(m.t / duration) * 100}%` }} />)}
                    <span className="vr-knob" style={{ left: pct }} />
                </div>
                <button type="button" className="ps-btn ps-btn-sm ps-btn-ghost" aria-label="Playback speed"
                    onClick={() => { const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(next); if (videoRef.current) videoRef.current.playbackRate = next; }}>
                    {speed}×
                </button>
            </div>
        </div>
    );
});

ClipPlayer.displayName = 'ClipPlayer';

export default ClipPlayer;
