import React, { useEffect, useState } from 'react';
import { ArrowRight, Captions, Check, Keyboard, Lock, Mic, ScanFace, Sun, Trash2, Video, Volume2 } from 'lucide-react';
import CameraTile from './CameraTile';
import InterviewerOrb from './InterviewerOrb';
import { frameBrightness } from './lib/media';
import { captionsSupported, speak, voiceLabel, voiceSupported } from './lib/speech';
import { KIND_LABEL } from './lib/delivery';
import { KIND_ICON } from './lib/icons';

const CheckItem = ({ icon, title, sub, tone = 'good', children }) => {
    const Icon = icon;
    return (
        <li className={`vi-check is-${tone}`}>
            <span className="vi-check-ic"><Icon size={15} aria-hidden="true" /></span>
            <div><strong>{title}</strong>{sub && <span className="vi-sub">{sub}</span>}{children}</div>
        </li>
    );
};

const MicMeter = ({ level }) => {
    const [on, setOn] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setOn(Math.round((level?.() || 0) * 14)), 120);
        return () => clearInterval(id);
    }, [level]);
    return <span className="vi-meter" aria-label="Microphone level">{Array.from({ length: 14 }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}</span>;
};

const Switch = ({ id, title, sub, checked, onChange }) => (
    <label className="vi-switch-row" htmlFor={id}>
        <span><strong>{title}</strong><span className="vi-sub">{sub}</span></span>
        <input type="checkbox" className="vi-switch" id={id} role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
);

const SetupScreen = ({
    meta, plan, completedSteps, settings, onSettings, media, devices, onDevice, onRequestMedia, onVoiceOnly,
    videoRef, tracker, meter, voices, onStart, starting, onToggleCamera, onToggleMic,
}) => {
    const [orbState, setOrbState] = useState('idle');
    const [brightness, setBrightness] = useState(null);
    const [trackerState, setTrackerState] = useState(null);
    const resumed = completedSteps > 0;
    const minutes = plan.reduce((sum, s) => sum + (s.minutes || 0), 0);
    const firstName = (meta.userName || '').split(' ')[0];

    useEffect(() => {
        if (!media.stream || !media.cameraOn) return undefined;
        const id = setInterval(() => {
            setBrightness(frameBrightness(videoRef.current));
            setTrackerState(tracker ? { ...tracker.state() } : null);
        }, 1000);
        return () => clearInterval(id);
    }, [media.stream, media.cameraOn, tracker, videoRef]);

    const testVoice = () => {
        setOrbState('speaking');
        speak(`Hi${firstName ? ` ${firstName}` : ''}. I'll be your interviewer for the ${meta.roleName} role${meta.companyName ? ` at ${meta.companyName}` : ''} today.`, {
            voiceURI: settings.voiceURI,
            onEnd: () => setOrbState('idle'),
        });
    };

    const faceCheck = () => {
        if (!media.stream || !media.cameraOn) return { tone: 'off', title: 'Camera is off', sub: "You'll do a voice-only interview" };
        if (!settings.eye) return { tone: 'off', title: 'Framing check is off', sub: 'Turn on eye-contact feedback to check it' };
        if (!trackerState?.ready) return { tone: 'off', title: 'Checking your framing…', sub: 'Loading face tracking on this device' };
        return trackerState.face
            ? { tone: 'good', title: 'Face in frame', sub: "Centred, about an arm's length away" }
            : { tone: 'warn', title: "Can't see your face", sub: 'Move into the middle of the picture' };
    };
    const lightCheck = () => {
        if (!media.stream || !media.cameraOn || brightness == null) return { tone: 'off', title: 'Lighting', sub: 'Needs the camera' };
        if (brightness < 55) return { tone: 'warn', title: 'Your picture is dark', sub: 'Face a window or turn on a light' };
        return { tone: 'good', title: 'Lighting is good', sub: 'Your face is clearly lit' };
    };
    const face = faceCheck();
    const light = lightCheck();

    return (
        <main className="vi-screen" aria-labelledby="vi-setup-title">
            <div className="vi-setup-head">
                <p className="vi-eyebrow">Video interview · {meta.roleName}{meta.companyName ? ` · ${meta.companyName}` : ''} · {meta.seniority} level</p>
                <h1 id="vi-setup-title">{resumed ? `Welcome back${firstName ? `, ${firstName}` : ''}` : `Check your setup${firstName ? `, ${firstName}` : ''}`}</h1>
                <p className="vi-lede">
                    {resumed
                        ? `You've finished ${completedSteps} of ${plan.length} steps. Check your camera and microphone, then carry on where you stopped.`
                        : `About ${minutes} minutes across ${plan.length} steps. The interviewer speaks each question, listens to your answer and may ask a follow-up, the way a real interviewer would.`}
                </p>
            </div>

            <div className="vi-setup-grid">
                <div className="vi-setup-main">
                    <section className="vi-panel vi-preview" aria-label="Camera and microphone">
                        {media.stream || media.voiceOnly ? (
                            <CameraTile
                                wide stream={media.stream} videoRef={videoRef} cameraOn={media.cameraOn} micOn={media.micOn}
                                onToggleCamera={media.hasCamera ? onToggleCamera : null} onToggleMic={media.hasMic ? onToggleMic : null}
                                tracker={tracker} showFrame={settings.eye} label="Preview" initials={meta.initials}
                            />
                        ) : (
                            <div className="vi-permission">
                                <Video size={28} aria-hidden="true" />
                                <h2>Allow your camera and microphone</h2>
                                <p>The interviewer listens to your spoken answers, and the camera lets you replay yourself afterwards. Your browser will ask for permission.</p>
                                {media.error && <p className="vi-error" role="alert">{media.error}</p>}
                                <div className="vi-row">
                                    <button type="button" className="vi-btn vi-primary" onClick={onRequestMedia} disabled={media.requesting}>
                                        {media.requesting ? 'Waiting for permission…' : 'Allow camera and microphone'}
                                    </button>
                                    <button type="button" className="vi-btn vi-ghost" onClick={() => onVoiceOnly('audio')} disabled={media.requesting}>Use microphone only</button>
                                </div>
                            </div>
                        )}
                        <ul className="vi-checks">
                            <CheckItem icon={ScanFace} tone={face.tone} title={face.title} sub={face.sub} />
                            <CheckItem icon={Sun} tone={light.tone} title={light.title} sub={light.sub} />
                            <CheckItem icon={Mic} tone={media.hasMic ? (media.micOn ? 'good' : 'warn') : 'off'} title={media.hasMic ? (media.micOn ? 'Microphone' : 'Microphone muted') : 'No microphone'}
                                sub={media.hasMic ? null : "You'll type your answers"}>
                                {media.hasMic && <MicMeter level={meter?.level} />}
                            </CheckItem>
                            <CheckItem icon={Captions} tone={captionsSupported ? 'good' : 'warn'} title="Live captions"
                                sub={captionsSupported ? 'Work in this browser' : "Not in this browser. You'll still get a full transcript."} />
                        </ul>
                        {(media.stream || media.voiceOnly) && (
                            <div className="vi-devices">
                                <label className="vi-field" htmlFor="vi-cam-select">Camera
                                    <select id="vi-cam-select" value={settings.cameraId || devices.cameras[0]?.id || ''} onChange={(e) => onDevice('cameraId', e.target.value)} disabled={!devices.cameras.length}>
                                        {devices.cameras.length ? devices.cameras.map(d => <option key={d.id} value={d.id}>{d.label}</option>) : <option value="">No camera found</option>}
                                    </select>
                                </label>
                                <label className="vi-field" htmlFor="vi-mic-select">Microphone
                                    <select id="vi-mic-select" value={settings.micId || devices.mics[0]?.id || ''} onChange={(e) => onDevice('micId', e.target.value)} disabled={!devices.mics.length}>
                                        {devices.mics.length ? devices.mics.map(d => <option key={d.id} value={d.id}>{d.label}</option>) : <option value="">No microphone found</option>}
                                    </select>
                                </label>
                                <label className="vi-field" htmlFor="vi-lang-select">Caption language
                                    <select id="vi-lang-select" value={settings.lang} onChange={(e) => onSettings({ lang: e.target.value })}>
                                        <option value="en-IN">English (India)</option>
                                        <option value="en-US">English (US)</option>
                                        <option value="en-GB">English (UK)</option>
                                    </select>
                                </label>
                            </div>
                        )}
                    </section>
                    <section className="vi-panel vi-privacy">
                        <h2>What happens to your recording</h2>
                        <ul>
                            <li><Video size={16} aria-hidden="true" /><span>Video stays in this browser so you can replay it. It is never uploaded.</span></li>
                            <li><Mic size={16} aria-hidden="true" /><span>Each answer's audio goes to PrepSphere only to write the transcript, then it is deleted. Only the text is kept.</span></li>
                            <li><Trash2 size={16} aria-hidden="true" /><span>Delete recordings at any time from the results page or Settings.</span></li>
                            {captionsSupported && <li><Captions size={16} aria-hidden="true" /><span>Live captions use your browser's speech service while you answer.</span></li>}
                        </ul>
                    </section>
                </div>

                <aside className="vi-setup-side">
                    <section className="vi-panel vi-interviewer">
                        <InterviewerOrb state={orbState} className="vi-orb-small" />
                        <div className="vi-stack">
                            <h2>Your interviewer</h2>
                            <p className="vi-fine">Speaks every question aloud and shows it as text.</p>
                            <label className="vi-field" htmlFor="vi-voice-select">Voice
                                <select id="vi-voice-select" value={settings.voiceURI || ''} onChange={(e) => onSettings({ voiceURI: e.target.value })} disabled={!voices.length}>
                                    {voices.length ? voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{voiceLabel(v)}</option>) : <option value="">No voices in this browser</option>}
                                </select>
                            </label>
                            <button type="button" className="vi-btn vi-sm" onClick={testVoice} disabled={!voiceSupported || !voices.length}>
                                <Volume2 size={15} aria-hidden="true" />Play test voice
                            </button>
                            <p className="vi-fine">{voices.length ? `${voices.length} English voice${voices.length === 1 ? '' : 's'} in this browser. Edge has the most natural ones.` : 'Questions will appear as text only.'}</p>
                        </div>
                    </section>
                    <section className="vi-panel vi-side">
                        <h2>How it runs</h2>
                        <div className="vi-seg" role="radiogroup" aria-label="When you see feedback">
                            {[['real', 'Real interview'], ['coach', 'Coach mode']].map(([key, label]) => (
                                <button key={key} type="button" role="radio" aria-checked={settings.mode === key} onClick={() => onSettings({ mode: key })}>{label}</button>
                            ))}
                        </div>
                        <p className="vi-fine">{settings.mode === 'real' ? 'Scores stay hidden until the end, like a real interview.' : 'After each answer you see a quick score and one tip.'}</p>
                        <Switch id="vi-opt-think" title="Thinking time" sub="15 seconds before each answer" checked={settings.thinking} onChange={(v) => onSettings({ thinking: v })} />
                        <Switch id="vi-opt-eye" title="Eye-contact feedback" sub="Worked out on this device" checked={settings.eye} onChange={(v) => onSettings({ eye: v })} />
                        <Switch id="vi-opt-keep" title="Keep recordings" sub="On this device, for replay" checked={settings.keep} onChange={(v) => onSettings({ keep: v })} />
                    </section>
                    <section className="vi-panel vi-side">
                        <div className="vi-plan-head"><h2>Your interview</h2><span className="vi-mono vi-fine">about {minutes} min</span></div>
                        <ol className="vi-plan">
                            {plan.map((step, i) => {
                                const Icon = KIND_ICON[step.kind];
                                const done = i < completedSteps;
                                return (
                                    <li key={step.index} className={done ? 'is-done' : ''}>
                                        <span className="n">{done ? <Check size={13} aria-label="Done" /> : i + 1}</span>
                                        <div><strong>{step.title}</strong><span className="vi-kind"><Icon size={12} aria-hidden="true" />{KIND_LABEL[step.kind]}</span></div>
                                        <span className="vi-mono vi-fine">{step.minutes} min</span>
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="vi-fine">Plus up to 2 follow-up questions, based on your answers.</p>
                    </section>
                    <button type="button" className="vi-btn vi-primary vi-lg" onClick={onStart} disabled={starting || (!media.stream && !media.voiceOnly && !media.typeOnly)}>
                        {resumed ? 'Continue interview' : 'Start interview'}<ArrowRight size={17} aria-hidden="true" />
                    </button>
                    {!media.stream && !media.voiceOnly && !media.typeOnly && (
                        <button type="button" className="vi-btn vi-ghost vi-sm vi-center" onClick={() => onVoiceOnly('type')}>
                            <Keyboard size={14} aria-hidden="true" />Continue without camera or microphone
                        </button>
                    )}
                    <p className="vi-fine vi-center"><Keyboard size={14} aria-hidden="true" />Space starts and stops your answers.</p>
                    <p className="vi-fine vi-center"><Lock size={13} aria-hidden="true" />Nothing is recorded until you start.</p>
                </aside>
            </div>
        </main>
    );
};

export default SetupScreen;
