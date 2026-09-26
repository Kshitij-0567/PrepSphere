import React, { useEffect, useRef, useState } from 'react';
import { SKILL_STATUS } from '../../utils/format';

function webglSupported() {
    try {
        return Boolean(window.WebGLRenderingContext && document.createElement('canvas').getContext('webgl'));
    } catch {
        return false;
    }
}

function spriteTexture(THREE, kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (kind === 'glow') {
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.3, 'rgba(255,255,255,0.28)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    } else if (kind === 'disc') {
        grad.addColorStop(0, 'rgba(255,255,255,0.55)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.16)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
        g.beginPath(); g.arc(64, 64, 20, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
    } else {
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.22, 'rgba(255,255,255,0.04)');
        grad.addColorStop(0.32, 'rgba(255,255,255,0.26)');
        grad.addColorStop(0.46, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
        g.beginPath(); g.arc(64, 64, 19, 0, Math.PI * 2); g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke();
    }
    return new THREE.CanvasTexture(c);
}

// Builds the scene and returns a cleanup function that releases every GPU resource.
function buildScene(THREE, { stage, canvas, labelLayer, nodes, refs }) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const R = 1.3;
    const globe = new THREE.Group();
    globe.rotation.x = 0.32;
    scene.add(globe);
    const disposables = [];
    const track = (obj) => { disposables.push(obj); return obj; };

    const discTex = track(spriteTexture(THREE, 'disc'));
    const ringTex = track(spriteTexture(THREE, 'ring'));
    const glowTex = track(spriteTexture(THREE, 'glow'));

    globe.add(new THREE.LineSegments(
        track(new THREE.EdgesGeometry(track(new THREE.IcosahedronGeometry(R, 2)))),
        track(new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.08 })),
    ));
    const eq = new THREE.EllipseCurve(0, 0, R, R, 0, Math.PI * 2).getPoints(128).map(p => new THREE.Vector3(p.x, 0, p.y));
    globe.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(eq)), track(new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.2 }))));

    const core = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color: 0x6366f1, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })));
    core.scale.set(3.6, 3.6, 1);
    scene.add(core);

    const golden = Math.PI * (3 - Math.sqrt(5));
    const count = Math.max(nodes.length, 1);
    const objects = nodes.map((n, i) => {
        const t = (i + 0.5) / count;
        const yy = 1 - 2 * t, rr = Math.sqrt(1 - yy * yy), th = golden * i;
        const pos = new THREE.Vector3(Math.cos(th) * rr, yy, Math.sin(th) * rr).multiplyScalar(R);
        const st = SKILL_STATUS[n.status] || SKILL_STATUS.extra;
        const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({
            map: st.hollow ? ringTex : discTex,
            color: new THREE.Color(st.hex),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        })));
        const size = n.weight ? 0.26 + n.weight * 0.07 : 0.24;
        sp.scale.set(size, size, 1);
        sp.position.copy(pos);
        globe.add(sp);
        const label = document.createElement('span');
        label.className = 'ps-node-label';
        label.textContent = n.name;
        labelLayer.appendChild(label);
        return { n, sp, pos, size, label, labelWidth: 0 };
    });
    const sprites = objects.map(o => o.sp);

    const arcMat = track(new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.18 }));
    const seen = new Set();
    objects.forEach((a, i) => {
        objects.map((b, j) => ({ j, d: a.pos.distanceTo(b.pos) })).filter(o => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2)
            .forEach(({ j }) => {
                const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (seen.has(key)) return;
                seen.add(key);
                const b = objects[j];
                const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.13);
                const geo = track(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a.pos, mid, b.pos).getPoints(24)));
                globe.add(new THREE.Line(geo, arcMat));
            });
    });

    const DUST = reduceMotion ? 300 : 650;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
        const r = 1.9 + Math.random() * 1.2, u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        dustPos[i * 3] = r * s * Math.cos(phi); dustPos[i * 3 + 1] = r * u; dustPos[i * 3 + 2] = r * s * Math.sin(phi);
    }
    const dustGeo = track(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, track(new THREE.PointsMaterial({ color: 0xa5b4fc, size: 0.016, transparent: true, opacity: 0.45, depthWrite: false })));
    scene.add(dust);

    const orbit = new THREE.Group();
    orbit.rotation.set(1.22, 0.1, 0.38);
    scene.add(orbit);
    const orbitPts = new THREE.EllipseCurve(0, 0, 1.78, 1.78, 0, Math.PI * 2).getPoints(180).map(p => new THREE.Vector3(p.x, p.y, 0));
    orbit.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(orbitPts)), track(new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.26 }))));
    const sat = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: discTex, color: 0xc7d2fe, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    sat.scale.set(0.2, 0.2, 1);
    orbit.add(sat);
    let satAngle = 0.8;

    const size = { w: 1, h: 1 };
    const resize = () => {
        size.w = Math.max(1, stage.clientWidth);
        size.h = Math.max(1, stage.clientHeight);
        renderer.setSize(size.w, size.h, false);
        camera.aspect = size.w / size.h;
        camera.position.z = Math.max(4.6, 1.95 / (Math.tan(THREE.MathUtils.degToRad(19)) * camera.aspect));
        camera.updateProjectionMatrix();
        objects.forEach(o => { o.labelWidth = 0; });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let dragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0, hovered = null;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const matches = (n) => refs.filter.current === 'all' || n.status === refs.filter.current;

    const onDown = (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        stage.classList.add('dragging');
        refs.onHover.current(null);
    };
    const onUp = () => { dragging = false; stage.classList.remove('dragging'); };
    const onLeave = () => { hovered = null; refs.onHover.current(null); };
    const onMove = (e) => {
        if (dragging) {
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            velY = dx * 0.006; velX = dy * 0.006;
            globe.rotation.y += velY;
            globe.rotation.x = clamp(globe.rotation.x + velX, -1.1, 1.1);
            return;
        }
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hit = raycaster.intersectObjects(sprites).map(h => objects[sprites.indexOf(h.object)]).find(o => matches(o.n));
        hovered = hit || null;
        refs.onHover.current(hovered ? hovered.n : null, e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointermove', onMove);

    let visible = true;
    const io = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    io.observe(stage);

    const v3 = new THREE.Vector3();
    let last = performance.now();
    let frameId = 0;
    const frame = (now) => {
        frameId = requestAnimationFrame(frame);
        const dt = Math.min(50, now - last);
        last = now;
        if (!visible || document.hidden) return;
        if (!dragging) {
            if (!refs.paused.current && !reduceMotion && !hovered) globe.rotation.y += 0.00022 * dt;
            velX *= 0.92; velY *= 0.92;
            globe.rotation.y += velY;
            globe.rotation.x = clamp(globe.rotation.x + velX, -1.1, 1.1);
        }
        if (!reduceMotion) { dust.rotation.y += 0.00003 * dt; satAngle += 0.00045 * dt; }
        sat.position.set(1.78 * Math.cos(satAngle), 1.78 * Math.sin(satAngle), 0);
        globe.updateMatrixWorld();
        const filtering = refs.filter.current !== 'all';
        for (const o of objects) {
            v3.copy(o.pos).applyMatrix4(globe.matrixWorld);
            const depth = clamp((v3.z + R) / (2 * R), 0, 1);
            const active = matches(o.n);
            o.sp.material.opacity = (active ? 1 : 0.14) * (0.32 + 0.68 * depth);
            const k = o === hovered ? 1.4 : active && filtering ? 1.18 : 1;
            o.sp.scale.set(o.size * k, o.size * k, 1);
            v3.project(camera);
            const x = (v3.x * 0.5 + 0.5) * size.w;
            const y = (-v3.y * 0.5 + 0.5) * size.h;
            const show = active && (depth > (size.w < 520 ? 0.62 : 0.4) || o === hovered);
            o.label.style.opacity = show ? (o === hovered ? 1 : 0.3 + 0.7 * depth).toFixed(2) : '0';
            if (!o.labelWidth) o.labelWidth = o.label.offsetWidth;
            const lx = x + 11 + o.labelWidth > size.w - 6 ? x - 11 - o.labelWidth : x + 11;
            o.label.style.transform = `translate(${lx.toFixed(1)}px, ${(y - 7).toFixed(1)}px)`;
            o.label.classList.toggle('is-front', depth > 0.72 || o === hovered);
        }
        renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(frame);

    return () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        io.disconnect();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointermove', onMove);
        objects.forEach(o => o.label.remove());
        disposables.forEach(d => d.dispose && d.dispose());
        renderer.dispose();
    };
}

/**
 * Interactive 3D globe of skills. Colour = status, size = importance, hollow ring = not on
 * the resume. Drag to rotate; `onHover(node, x, y)` reports the node under the pointer.
 */
const SkillSphere = ({ nodes, filter, paused, onHover }) => {
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const labelsRef = useRef(null);
    const filterRef = useRef(filter);
    const pausedRef = useRef(paused);
    const hoverRef = useRef(onHover);
    const [failed, setFailed] = useState(false);

    useEffect(() => { filterRef.current = filter; }, [filter]);
    useEffect(() => { pausedRef.current = paused; }, [paused]);
    useEffect(() => { hoverRef.current = onHover; }, [onHover]);

    const nodesKey = nodes.map(n => `${n.name}:${n.status}:${n.weight || 0}`).join('|');

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};
        import('three')
            .then((THREE) => {
                if (disposed) return;
                if (!webglSupported()) { setFailed(true); return; }
                cleanup = buildScene(THREE, {
                    stage: stageRef.current,
                    canvas: canvasRef.current,
                    labelLayer: labelsRef.current,
                    nodes,
                    refs: { filter: filterRef, paused: pausedRef, onHover: hoverRef },
                });
            })
            .catch(() => { if (!disposed) setFailed(true); });
        return () => { disposed = true; cleanup(); };
        // The scene is rebuilt only when the set of nodes or their statuses change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodesKey]);

    return (
        <div className="ps-stage" ref={stageRef}>
            {!failed && <canvas ref={canvasRef} role="img" aria-label="Interactive 3D sphere of your skills. Use the List button for the same information as text." />}
            <div className="ps-node-labels" ref={labelsRef} aria-hidden="true" />
            {failed
                ? <div className="ps-stage-note">The 3D view needs WebGL. Use the List button to see every skill.</div>
                : <div className="ps-stage-hint">Drag to rotate</div>}
        </div>
    );
};

export default SkillSphere;
