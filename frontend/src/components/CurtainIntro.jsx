import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Sparkles } from 'lucide-react';
import './CurtainIntro.css';

const CurtainIntro = ({ isLifted, onLift, onNavigateSection }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const mousePos = useRef({ x: -1000, y: -1000, active: false });

    // Handle scroll wheel, keydown, and touch gestures to quickly lift the curtain
    useEffect(() => {
        if (isLifted) return;

        const handleWheel = (e) => {
            if (e.deltaY > 5 || Math.abs(e.deltaX) > 15) {
                onLift();
            }
        };

        let startTouchY = 0;
        const handleTouchStart = (e) => {
            if (e.touches.length > 0) {
                startTouchY = e.touches[0].clientY;
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length > 0) {
                const diffY = startTouchY - e.touches[0].clientY;
                if (diffY > 15) {
                    onLift();
                }
            }
        };

        const handleKeyDown = (e) => {
            if (['ArrowDown', 'Space', 'PageDown'].includes(e.code)) {
                onLift();
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: true });
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isLifted, onLift]);

    // Canvas animation: Internet Data Matrix & Resume Signal Lines
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        };

        window.addEventListener('resize', handleResize);

        // Internet packet & resume node simulation
        let particles = [];
        const PARTICLE_COUNT = Math.min(65, Math.floor((width * height) / 22000));

        class PacketParticle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.7;
                this.vy = (Math.random() - 0.5) * 0.7;
                this.size = Math.random() * 2.2 + 1;
                this.baseAlpha = Math.random() * 0.45 + 0.2;
                this.alpha = this.baseAlpha;
                this.hue = Math.random() > 0.6 ? 220 : Math.random() > 0.3 ? 260 : 190; // Cosmic blue, cyan, violet
                this.pulseSpeed = Math.random() * 0.02 + 0.01;
                this.pulseAngle = Math.random() * Math.PI * 2;
                this.isDataPacket = Math.random() > 0.7;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                this.pulseAngle += this.pulseSpeed;
                this.alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.2;

                // Mouse magnetic repulsion / interaction
                if (mousePos.current.active) {
                    const dx = mousePos.current.x - this.x;
                    const dy = mousePos.current.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 160 && dist > 0) {
                        const force = (160 - dist) / 160;
                        this.x -= (dx / dist) * force * 3;
                        this.y -= (dy / dist) * force * 3;
                    }
                }

                // Wrap edges
                if (this.x < -10) this.x = width + 10;
                if (this.x > width + 10) this.x = -10;
                if (this.y < -10) this.y = height + 10;
                if (this.y > height + 10) this.y = -10;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, 90%, 65%, ${Math.max(0.05, this.alpha)})`;
                ctx.shadowBlur = this.isDataPacket ? 12 : 4;
                ctx.shadowColor = `hsla(${this.hue}, 90%, 60%, 0.8)`;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Cyber data wave packets traveling along curved grid streams
        const dataRays = Array.from({ length: 5 }, (_, i) => ({
            yOffset: (height / 6) * (i + 1),
            speed: (i % 2 === 0 ? 1 : -1) * (0.0008 + i * 0.0003),
            progress: Math.random() * Math.PI * 2,
            color: i % 2 === 0 ? 'rgba(56, 189, 248, ' : 'rgba(129, 140, 248, '
        }));

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new PacketParticle());
            }
        };

        initParticles();

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            // 1. Draw glowing data wave streams (representing internet & fiber optic highway)
            dataRays.forEach(ray => {
                ray.progress += ray.speed;
                ctx.beginPath();
                ctx.moveTo(0, ray.yOffset + Math.sin(ray.progress) * 45);

                for (let x = 0; x < width; x += 30) {
                    const waveY = ray.yOffset + 
                                  Math.sin((x * 0.003) + ray.progress) * 40 + 
                                  Math.cos((x * 0.007) - ray.progress * 0.5) * 20;
                    ctx.lineTo(x, waveY);
                }

                ctx.strokeStyle = ray.color + '0.12)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Luminous packet pulse moving along this stream
                const packetX = ((Date.now() * 0.15) % (width + 200)) - 100;
                const packetY = ray.yOffset + 
                                Math.sin((packetX * 0.003) + ray.progress) * 40 + 
                                Math.cos((packetX * 0.007) - ray.progress * 0.5) * 20;
                
                ctx.beginPath();
                ctx.arc(packetX, packetY, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#38bdf8';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#38bdf8';
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            // 2. Draw particle network mesh & connective synaptic links
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 130) {
                        const alpha = (1 - dist / 130) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        const handleMouseMove = (e) => {
            mousePos.current = { x: e.clientX, y: e.clientY, active: true };
        };
        const handleMouseLeave = () => {
            mousePos.current.active = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    const handleNavClick = (sectionId) => {
        onLift();
        if (onNavigateSection) {
            setTimeout(() => onNavigateSection(sectionId), 300);
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`curtain-intro-screen ${isLifted ? 'lifted' : ''}`}
            id="curtain-intro"
        >
            {/* Dynamic Internet / Neural Resume Canvas */}
            <canvas ref={canvasRef} className="curtain-canvas" />

            {/* Ambient Subtle Lighting & Luxury Radial Aura */}
            <div className="curtain-glow-top"></div>
            <div className="curtain-glow-center"></div>
            <div className="curtain-cyber-grid"></div>

            {/* Top Navigation Header */}
            <header className="curtain-nav">
                <div className="curtain-brand" onClick={() => handleNavClick('hero-section')}>
                    <span className="curtain-brand-dot"></span>
                    <span className="curtain-brand-title">PrepSphere</span>
                </div>

                <div className="curtain-nav-links">
                    <button className="curtain-link-btn" onClick={() => handleNavClick('how-it-works')}>
                        How It Works
                    </button>
                    <button className="curtain-link-btn" onClick={() => handleNavClick('features')}>
                        Features
                    </button>
                    <button className="curtain-link-btn" onClick={() => handleNavClick('roles')}>
                        Target Roles
                    </button>
                    <button className="curtain-link-btn" onClick={() => handleNavClick('tech-stack')}>
                        Tech Stack
                    </button>
                </div>

                <div className="curtain-nav-action">
                    <button className="curtain-action-pill" onClick={() => onLift()}>
                        Explore Platform <Sparkles size={13} style={{ marginLeft: 6 }} />
                    </button>
                </div>
            </header>

            {/* Hero Centerpiece */}
            <main className="curtain-hero-center">
                <motion.div 
                    className="curtain-title-wrapper"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="curtain-eyebrow">
                        <Sparkles size={13} className="eyebrow-sparkle" />
                        <span>AI Interview Preparation & Skill Assessment</span>
                    </div>

                    <h1 className="curtain-giant-typography">
                        Prep<span className="curtain-gradient-text">Sphere</span>
                    </h1>

                    <p className="curtain-tagline">
                        Intelligent skill gap diagnostics, canonical competency mapping, and precision rubric-scored mock interviews.
                    </p>
                </motion.div>

                {/* Classic, Highly Attractive Scroll-To-Start Trigger */}
                <motion.div 
                    className="curtain-scroll-trigger"
                    onClick={() => onLift()}
                    role="button"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.7 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                >
                    <div className="mouse-scroll-indicator">
                        <div className="mouse-wheel-dot"></div>
                    </div>
                    <div className="scroll-trigger-text-group">
                        <span className="scroll-main-text">Scroll or click to begin</span>
                        <span className="scroll-sub-hint">Experience PrepSphere</span>
                    </div>
                    <div className="scroll-arrow-circle">
                        <ArrowDown size={14} className="scroll-bounce-arrow" />
                    </div>
                </motion.div>
            </main>

            {/* Footer Minimalist Protocol Bar */}
            <footer className="curtain-footer">
                <div className="footer-protocol">
                    <span className="protocol-badge">AI POWERED</span>
                    <span>STANDARDIZED RUBRIC SCORING & RESUME ATS INTELLIGENCE</span>
                </div>
                <div className="footer-hint" onClick={() => onLift()}>
                    PRESS SPACE OR SCROLL TO ENTER ↓
                </div>
            </footer>
        </div>
    );
};

export default CurtainIntro;
