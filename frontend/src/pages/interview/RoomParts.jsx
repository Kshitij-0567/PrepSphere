import React, { useEffect, useRef } from 'react';
import { ArrowRight, Captions, Check, Clock, CornerDownRight, Volume2, VolumeX } from 'lucide-react';
import { KIND_ICON } from './lib/icons';
import { KIND_LABEL, clock } from './lib/delivery';

export const LogoMark = () => (
    <span className="vi-logo" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
            <circle cx="12" cy="12" r="6.5" />
            <ellipse cx="12" cy="12" rx="10.5" ry="3.6" transform="rotate(-24 12 12)" />
        </svg>
    </span>
);

export const RoomTopBar = ({ meta, step, stepNumber, total, seconds, voiceOn, captionsOn, onToggleVoice, onToggleCaptions, onEnd, ending }) => (
    <header className="vi-panel vi-top">
        <div className="vi-top-left">
            <LogoMark />
            <span className="vi-brand">PrepSphere</span>
            <span className="vi-sep" aria-hidden="true" />
            <span className="vi-role">{meta.roleName}{meta.companyName ? ` · ${meta.companyName}` : ''}</span>
        </div>
        <p className="vi-step-pill">Step {stepNumber} of {total} · {step.title}</p>
        <div className="vi-top-right">
            <span className="vi-clock vi-mono" title="Time in this interview"><Clock size={15} aria-hidden="true" />{clock(seconds, true)}</span>
            <button type="button" className="vi-btn vi-icon" aria-pressed={voiceOn} onClick={onToggleVoice} aria-label="Interviewer voice" title={voiceOn ? 'Interviewer voice on' : 'Interviewer voice off'}>
                {voiceOn ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
            </button>
            <button type="button" className="vi-btn vi-icon" aria-pressed={captionsOn} onClick={onToggleCaptions} aria-label="Live captions" title={captionsOn ? 'Captions on (C)' : 'Captions off (C)'}>
                <Captions size={17} aria-hidden="true" />
            </button>
            <button type="button" className="vi-btn vi-end" onClick={onEnd} disabled={ending}>{ending ? 'Ending…' : 'End interview'}</button>
        </div>
    </header>
);

export const StepHead = ({ step, stepNumber, total, plan, currentIndex }) => {
    const Icon = KIND_ICON[step.kind];
    return (
        <section className="vi-panel vi-step-head" aria-live="polite">
            <div><p className="vi-eyebrow">Step {stepNumber} of {total}</p><h2>{step.title}</h2></div>
            <span className="vi-type-chip"><Icon size={14} aria-hidden="true" />{KIND_LABEL[step.kind]} · ~{step.minutes} min</span>
            <div className="vi-segs" aria-hidden="true">
                {plan.map((s, i) => <i key={s.index} className={i < currentIndex ? 'done' : i === currentIndex ? 'current' : ''} />)}
            </div>
        </section>
    );
};

export const Roadmap = ({ plan, currentIndex, followUp }) => (
    <nav className="vi-roadmap" aria-label="Interview plan">
        <div className="vi-rm-head"><span className="vi-h-sm">Interview plan</span><span className="vi-h-sm vi-mono">{plan.length} steps</span></div>
        <ol>
            {plan.map((step, i) => {
                const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'next';
                const Icon = KIND_ICON[step.kind];
                return (
                    <React.Fragment key={step.index}>
                        <li className={`vi-rm-item is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                            <span className="vi-rm-ic">{state === 'done' ? <Check size={14} aria-label="Done" /> : <Icon size={14} aria-hidden="true" />}</span>
                            <div className="vi-rm-text"><strong>{step.title}</strong><span>{KIND_LABEL[step.kind]} · ~{step.minutes} min</span></div>
                        </li>
                        {state === 'current' && followUp && (
                            <li className="vi-rm-item vi-rm-sub is-current">
                                <span className="vi-rm-ic"><CornerDownRight size={12} aria-hidden="true" /></span>
                                <div className="vi-rm-text"><strong>Follow-up</strong><span>Spoken</span></div>
                            </li>
                        )}
                    </React.Fragment>
                );
            })}
        </ol>
    </nav>
);

/** Microphone level as moving bars. */
export const Waveform = ({ level }) => {
    const ref = useRef(null);
    useEffect(() => {
        const canvas = ref.current;
        const history = new Array(44).fill(0);
        let frame = 0, n = 0;
        const draw = () => {
            frame = requestAnimationFrame(draw);
            if (!canvas?.offsetParent) return;
            if (n++ % 2 === 0) { history.push(level ? level() : 0); history.shift(); }
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            const gap = 3 * dpr, bw = Math.max(2 * dpr, (w - gap * (history.length - 1)) / history.length);
            history.forEach((v, i) => {
                const bh = Math.max(3 * dpr, Math.max(0.06, v) * h);
                ctx.fillStyle = i > history.length - 6 ? '#a5b4fc' : `rgba(129,140,248,${(0.35 + 0.5 * i / history.length).toFixed(2)})`;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2); else ctx.rect(i * (bw + gap), (h - bh) / 2, bw, bh);
                ctx.fill();
            });
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [level]);
    return <canvas ref={ref} className="vi-wave" aria-hidden="true" />;
};

export const TimeRing = ({ seconds, guide, size = 44 }) => {
    const r = size / 2 - 4, c = 2 * Math.PI * r;
    const late = seconds > guide * 0.85;
    return (
        <div className="vi-time-guide">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle className="vi-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" />
                <circle className={`vi-ring-arc ${late ? 'is-late' : ''}`} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - Math.min(1, seconds / guide))).toFixed(1)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </svg>
            <div><span className="vi-mono">{clock(seconds)}</span><span className="vi-fine">of ~{clock(guide)} suggested</span></div>
        </div>
    );
};

export const EndDialog = ({ open, finished, total, onKeep, onEnd, ending }) => {
    const keepRef = useRef(null);
    useEffect(() => { if (open) keepRef.current?.focus(); }, [open]);
    if (!open) return null;
    const trap = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); onKeep(); }
        if (e.key === 'Tab') {
            const buttons = [...e.currentTarget.querySelectorAll('button:not(:disabled)')];
            const i = buttons.indexOf(document.activeElement);
            e.preventDefault();
            buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
    };
    return (
        <div className="vi-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onKeep(); }}>
            <div className="vi-dialog" role="dialog" aria-modal="true" aria-labelledby="vi-end-title" onKeyDown={trap}>
                <h2 id="vi-end-title">End the interview now?</h2>
                <p className="vi-muted">
                    {finished > 0
                        ? `You've finished ${finished} of ${total} steps. They will be scored, and the other ${total - finished} will be marked skipped.`
                        : "You haven't finished a step yet, so there will be nothing to score."}
                    {' '}You can't resume an interview after ending it.
                </p>
                <div className="vi-dialog-btns">
                    <button type="button" className="vi-btn" ref={keepRef} onClick={onKeep}>Keep going</button>
                    <button type="button" className="vi-btn vi-end" onClick={onEnd} disabled={ending}>{ending ? 'Ending…' : 'End and see results'}</button>
                </div>
            </div>
        </div>
    );
};

export const CoachCard = ({ coach, onContinue }) => (
    <div className="vi-coach" role="status">
        <div className="vi-coach-score"><span className="vi-mono">{coach.score.toFixed(1)}</span><small>out of 10</small></div>
        <div className="vi-coach-copy">
            <p className="vi-eyebrow">Coach mode · quick feedback{coach.approx ? ' · approximate' : ''}</p>
            <p>{coach.tip}</p>
        </div>
        <button type="button" className="vi-btn vi-primary" onClick={onContinue} autoFocus>
            {coach.last ? 'See results' : 'Continue'}<ArrowRight size={15} aria-hidden="true" />
        </button>
    </div>
);
