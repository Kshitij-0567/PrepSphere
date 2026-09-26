import React, { useEffect, useRef } from 'react';

const ParticleCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const mouse = {
            x: null,
            y: null,
            lastX: null,
            lastY: null
        };

        const particles = [];
        const connectionRadius = 140;

        // Spawn a subtle particle at the cursor position
        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;

            // Only spawn if mouse moved a bit
            const dist = mouse.lastX !== null ? Math.hypot(e.clientX - mouse.lastX, e.clientY - mouse.lastY) : 10;
            if (dist > 8) {
                particles.push({
                    x: e.clientX,
                    y: e.clientY,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: (Math.random() - 0.5) * 0.8,
                    radius: Math.random() * 1.5 + 1.2,
                    alpha: 0.7, // Start light
                    maxLife: 160 + Math.random() * 60, // Lifespan frames
                    life: 0,
                    isBurst: false
                });
                mouse.lastX = e.clientX;
                mouse.lastY = e.clientY;
            }

            // Keep max active particles modest for smoothness & subtlety
            if (particles.length > 45) {
                particles.shift();
            }
        };

        const handleMouseLeave = () => {
            mouse.x = null;
            mouse.y = null;
        };

        const handleClick = (e) => {
            // Disperse nearby particles into soft white dots
            particles.forEach(p => {
                const dx = p.x - e.clientX;
                const dy = p.y - e.clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 180) {
                    const angle = Math.atan2(dy, dx);
                    const force = (180 - dist) * 0.12;
                    p.vx += Math.cos(angle) * force;
                    p.vy += Math.sin(angle) * force;
                    p.isBurst = true;
                    p.alpha = 0.9;
                }
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('click', handleClick);

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            // Process particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];

                p.x += p.vx;
                p.y += p.vy;

                // Friction
                p.vx *= 0.96;
                p.vy *= 0.96;

                p.life++;

                // Smooth fade out as particle ages
                const fadeFactor = 1 - (p.life / p.maxLife);
                const currentAlpha = Math.max(0, p.alpha * fadeFactor);

                if (p.life >= p.maxLife || currentAlpha <= 0.01) {
                    particles.splice(i, 1);
                    continue;
                }

                // Draw Light White / Indigo Dot
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.isBurst 
                    ? `rgba(255, 255, 255, ${currentAlpha})` 
                    : `rgba(165, 180, 252, ${currentAlpha * 0.85})`;
                ctx.shadowBlur = p.isBurst ? 8 : 4;
                ctx.shadowColor = p.isBurst ? '#ffffff' : '#818cf8';
                ctx.fill();
                ctx.shadowBlur = 0;

                // Draw Smooth Lines between nearby trail particles
                for (let j = i - 1; j >= 0; j--) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionRadius) {
                        const lineAlpha = (1 - dist / connectionRadius) * currentAlpha * 0.4;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(129, 140, 248, ${lineAlpha})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }

                // Draw line to current cursor position if close
                if (mouse.x !== null && mouse.y !== null) {
                    const mdx = mouse.x - p.x;
                    const mdy = mouse.y - p.y;
                    const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

                    if (mdist < 160) {
                        const cursorLineAlpha = (1 - mdist / 160) * currentAlpha * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.strokeStyle = `rgba(168, 85, 247, ${cursorLineAlpha})`;
                        ctx.lineWidth = 0.9;
                        ctx.stroke();
                    }
                }
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
