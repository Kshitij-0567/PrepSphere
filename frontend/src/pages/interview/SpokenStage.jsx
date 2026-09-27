import React from 'react';
import { CornerDownRight, Keyboard, Mic, MicOff, RotateCcw, SkipForward } from 'lucide-react';
import { TimeRing, Waveform } from './RoomParts';
import { languageName } from './lib/speech';

const THINK_SECONDS = 15;

/** The question as the interviewer says it: words light up as they are spoken. */
export const SpokenQuestion = ({ question, reveal, isFollowUp, onReplay, canReplay }) => {
    const words = question.question_text.split(/\s+/);
    return (
        <>
            <div className="vi-q-row">
                <span className="vi-who"><span className="vi-who-dot" />Interviewer</span>
                {isFollowUp && <span className="vi-fu-chip"><CornerDownRight size={13} aria-hidden="true" />Follow-up</span>}
                {onReplay && (
                    <button type="button" className="vi-btn vi-ghost vi-sm vi-replay" onClick={onReplay} disabled={!canReplay} title="Replay question (R)">
                        <RotateCcw size={14} aria-hidden="true" />Replay
                    </button>
                )}
            </div>
            <p className="vi-q-text" aria-label={question.question_text}>
                {words.map((w, i) => <span key={i} className={i < reveal ? 'on' : ''} aria-hidden="true">{w} </span>)}
            </p>
        </>
    );
};

const SpokenStage = ({
    question, reveal, phase, isFollowUp, captionView, captionsOn, micOn, lang, answerSeconds, guideSeconds, thinkLeft,
    typed, onTyped, notice, level, thinkingEnabled, hasMic, actions,
}) => {
    let body = null;
    if (phase === 'asking') {
        body = (
            <div className="vi-ans-state vi-asking">
                <p className="vi-muted">
                    Listen to the question.{' '}
                    {thinkingEnabled && !isFollowUp ? 'You get 15 seconds to think before recording starts.' : 'Recording starts when the interviewer finishes.'}
                </p>
                <button type="button" className="vi-btn vi-ghost" onClick={actions.skip}><SkipForward size={15} aria-hidden="true" />Skip ahead</button>
            </div>
        );
    } else if (phase === 'thinking') {
        const c = 163.4;
        body = (
            <div className="vi-ans-state vi-thinking">
                <div className="vi-think-ring">
                    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
                        <circle className="vi-ring-track" cx="38" cy="38" r="26" fill="none" strokeWidth="5" />
                        <circle className="vi-ring-arc" cx="38" cy="38" r="26" fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={(c * (1 - thinkLeft / THINK_SECONDS)).toFixed(1)} />
                    </svg>
                    <span className="vi-mono" aria-label={`${thinkLeft} seconds to think`}>{thinkLeft}</span>
                </div>
                <div className="vi-think-copy">
                    <strong>Thinking time</strong>
                    <p className="vi-muted">Plan your answer. Recording starts by itself when the timer ends.</p>
                    <button type="button" className="vi-btn vi-primary" onClick={actions.start}><Mic size={15} aria-hidden="true" />Start answering now</button>
                </div>
            </div>
        );
    } else if (phase === 'answering') {
        const heard = captionView.text || captionView.interim;
        body = (
            <div className="vi-ans-state vi-answering">
                <div className="vi-cap-head">
                    <span className="vi-rec-dot" />
                    <span>Recording{isFollowUp ? ' your follow-up answer' : ''}</span>
                    <span className="vi-cap-lang">{captionsOn ? `Live captions · ${languageName(lang)}` : 'Captions off'}</span>
                </div>
                {!micOn && <p className="vi-mute-banner"><MicOff size={15} aria-hidden="true" />Your microphone is muted. Unmute it under your camera to keep answering.</p>}
                <div className="vi-captions" aria-live="polite">
                    {!captionsOn ? <span className="vi-placeholder">Captions are off. Your answer is still being recorded.</span>
                        : heard ? <>{captionView.text} {captionView.interim && <span className="vi-interim">{captionView.interim}</span>}</>
                            : <span className="vi-placeholder">{captionView.unsupported ? "Live captions aren't available in this browser. Keep talking; you'll get a full transcript after you finish." : 'Start speaking. Your words appear here as you talk.'}</span>}
                </div>
                <div className="vi-ans-controls">
                    <TimeRing seconds={answerSeconds} guide={guideSeconds} />
                    <Waveform level={level} />
                    <div className="vi-ans-btns">
                        <button type="button" className="vi-btn vi-ghost" onClick={actions.restart}><RotateCcw size={15} aria-hidden="true" />Restart</button>
                        <button type="button" className="vi-btn vi-ghost" onClick={actions.typeInstead}><Keyboard size={15} aria-hidden="true" />Type instead</button>
                        <button type="button" className="vi-btn vi-primary" onClick={actions.done}>Done answering <kbd>Space</kbd></button>
                    </div>
                </div>
            </div>
        );
    } else if (phase === 'typing') {
        body = (
            <div className="vi-ans-state vi-typing">
                <label className="vi-fine" htmlFor="vi-type-box">{hasMic ? "Type your answer. What you've said so far is already here." : 'Type your answer.'}</label>
                <textarea id="vi-type-box" className="vi-textarea" rows={6} maxLength={8000} value={typed} onChange={(e) => onTyped(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) actions.submitTyped(); }} />
                <div className="vi-ans-btns">
                    {hasMic && <button type="button" className="vi-btn vi-ghost" onClick={actions.backToVoice}><Mic size={15} aria-hidden="true" />Back to speaking</button>}
                    <button type="button" className="vi-btn vi-primary" onClick={actions.submitTyped} disabled={typed.trim().split(/\s+/).filter(Boolean).length < 4}>
                        Submit answer <kbd>Ctrl+Enter</kbd>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <section className="vi-panel vi-qa" aria-label="Spoken question">
            <SpokenQuestion question={question} reveal={reveal} isFollowUp={isFollowUp} onReplay={actions.replay} canReplay={phase === 'asking' || phase === 'thinking'} />
            {notice && (
                <div className="vi-notice" role="alert">
                    <p>{notice.message}</p>
                    <div className="vi-row">
                        {notice.retry && <button type="button" className="vi-btn vi-primary vi-sm" onClick={actions.retry}>Try sending again</button>}
                        {notice.answerAgain && hasMic && <button type="button" className="vi-btn vi-primary vi-sm" onClick={actions.restart}>Answer again</button>}
                        <button type="button" className="vi-btn vi-sm" onClick={actions.typeInstead}>Type instead</button>
                    </div>
                </div>
            )}
            {body && <div className="vi-answer">{body}</div>}
        </section>
    );
};

export default SpokenStage;
