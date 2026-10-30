import React, { useEffect, useRef } from 'react';

const POINTS = 620;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPHERE = Array.from({ length: POINTS }, (_, i) => {
    const y = 1 - ((i + 0.5) * 2) / POINTS;
    const r = Math.sqrt(1 - y * y);
    const th = GOLDEN * i;
    return [Math.cos(th) * r, y, Math.sin(th) * r, Math.asin(y), th];
});

/**
 * The interviewer's presence: a point sphere that ripples while it speaks, follows the
 * candidate's voice while it listens, and swirls while it thinks. `level()` returns 0–1.
 */
const InterviewerOrb = ({ state = 'idle', level, className = '' }) => {
    const canvasRef = useRef(null);
    const stateRef = useRef(state);
    const levelRef = useRef(level);

    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { levelRef.current = level; }, [level]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let frame = 0;
        let amp = 0.1;

        const draw = (now) => {
            frame = requestAnimationFrame(draw);
            if (!canvas.offsetParent || document.hidden) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
            if (!w || !h) return;
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            const ctx = canvas.getContext('2d');
            const t = reduce ? 1.2 : now / 1000;
            const st = stateRef.current;
            const mic = levelRef.current ? levelRef.current() : 0;
            const target = st === 'speaking' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 6.1) * Math.sin(t * 2.3 + 1))
                : st === 'listening' ? 0.15 + mic * 0.85
                : st === 'thinking' ? 0.35 : 0.12;
            amp += (target - amp) * 0.12;

            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2 - h * 0.04, R = Math.min(w, h) * 0.3;
            const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.9);
            glow.addColorStop(0, `rgba(99,102,241,${(0.2 + 0.3 * amp).toFixed(3)})`);
            glow.addColorStop(0.55, `rgba(99,102,241,${(0.06 + 0.08 * amp).toFixed(3)})`);
            glow.addColorStop(1, 'rgba(99,102,241,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);

            ctx.globalCompositeOperation = 'lighter';
            const rot = t * (st === 'thinking' ? 0.9 : 0.28), cr = Math.cos(rot), sr = Math.sin(rot);
            const ct = Math.cos(0.42), stl = Math.sin(0.42);
            for (const [x, y, z, lat, lon] of SPHERE) {
                let d;
                if (st === 'speaking') d = amp * 0.13 * Math.sin(lat * 6 - t * 7) * Math.cos(lon * 2 + t * 1.7);
                else if (st === 'listening') d = amp * 0.09 * Math.sin(lat * 5 + t * 5);
                else if (st === 'thinking') d = 0.04 * Math.sin(lat * 11 - t * 8);
                else d = 0.02 * Math.sin(lat * 3 + t * 1.3);
                const s = 1 + d;
                const X = (x * cr - z * sr) * s, Z0 = x * sr + z * cr;
                const Y = (y * ct - Z0 * stl) * s, Z = (y * stl + Z0 * ct) * s;
                const p = 3 / (3 - Z);
                const depth = (Z + 1) / 2;
                const r = st === 'thinking' ? 96 + depth * 70 : 129 + depth * 70;
                const g = st === 'thinking' ? 165 + depth * 45 : 140 + depth * 70;
                ctx.fillStyle = `rgba(${r | 0},${g | 0},252,${(0.1 + depth * 0.72).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(cx + X * R * p, cy - Y * R * p, (0.7 + depth * 1.6) * dpr, 0, 6.2832);
                ctx.fill();
            }
            if (st === 'speaking' || st === 'listening') {
                for (let k = 0; k < 2; k++) {
                    const ph = (t * 0.7 + k * 0.5) % 1;
                    ctx.strokeStyle = `rgba(165,180,252,${((1 - ph) * 0.24 * amp).toFixed(3)})`;
                    ctx.lineWidth = 1.2 * dpr;
                    ctx.beginPath();
                    ctx.arc(cx, cy, R * (1.18 + ph * 0.55), 0, 6.2832);
                    ctx.stroke();
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, []);

    return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default InterviewerOrb;
