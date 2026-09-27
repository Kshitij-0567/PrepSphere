import React, { useEffect, useRef } from 'react';

const TRAIL_MS = 420;     // how long a point stays in the cursor trail
const MAX_POINTS = 48;

/**
 * Workspace background effect: a single soft line that follows the cursor and fades from its
 * tail, plus a small burst of dots on click. Off when the user prefers reduced motion.
 */
const ParticleCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let dpr = Math.min(2, window.devicePixelRatio || 1);

        const handleResize = () => {
            dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        handleResize();
        window.addEventListener('resize', handleResize);

        const trail = [];
        const sparks = [];

        const handleMouseMove = (e) => {
            trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
            if (trail.length > MAX_POINTS) trail.shift();
        };
        const handleMouseLeave = () => { trail.length = 0; };
        const handleClick = (e) => {
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
                const speed = 1.2 + Math.random() * 1.4;
                sparks.push({ x: e.clientX, y: e.clientY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, maxLife: 34 + Math.random() * 16 });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('click', handleClick);

        const animate = () => {
            const now = performance.now();
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();

            // One continuous line: smoothed through the midpoints, thicker and brighter at the cursor.
            if (trail.length > 2) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 2; i < trail.length; i++) {
                    const a = trail[i - 2], b = trail[i - 1], c = trail[i];
                    const fresh = 1 - Math.min(1, (now - b.t) / TRAIL_MS);
                    ctx.beginPath();
                    ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
                    ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
                    ctx.strokeStyle = `rgba(165, 180, 252, ${(fresh * 0.55).toFixed(3)})`;
                    ctx.lineWidth = 0.6 + fresh * 1.8;
                    ctx.shadowBlur = 6 * fresh;
                    ctx.shadowColor = '#818cf8';
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.x += s.vx;
                s.y += s.vy;
                s.vx *= 0.92;
                s.vy *= 0.92;
                s.life++;
                const alpha = 1 - s.life / s.maxLife;
                if (alpha <= 0) { sparks.splice(i, 1); continue; }
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.8).toFixed(3)})`;
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('click', handleClick);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 1
            }}
        />
    );
};

export default ParticleCanvas;
