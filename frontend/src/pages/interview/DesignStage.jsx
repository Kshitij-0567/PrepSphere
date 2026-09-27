import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ArrowRight, Maximize2, Mic, Minimize2 } from 'lucide-react';
import LoadBoundary from './LoadBoundary';
import RichText from './RichText';
import { SpokenQuestion } from './SpokenStage';
import { boardDraftKey, notesDraftKey, readDraft, writeDraft } from './lib/delivery';

const Whiteboard = lazy(() => import('./Whiteboard'));

/** The design step: brief and explanation on the left, the whiteboard on the right. */
const DesignStage = ({ question, reveal, talking, canTalk, onToggleTalk, captionText, busy, onSubmit, onError }) => {
    const details = question.details || {};
    const boardRef = useRef(null);
    const [notes, setNotes] = useState(() => readDraft(notesDraftKey(question.id)) || '');
    const [count, setCount] = useState(0);
    const [full, setFull] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => writeDraft(notesDraftKey(question.id), notes || null), 600);
        return () => clearTimeout(id);
    }, [notes, question.id]);

    useEffect(() => {
        if (!full) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) setFull(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [full]);

    const submit = async () => {
        let image = null;
        try {
            image = await boardRef.current?.exportPng();
        } catch {
            onError('Could not export the whiteboard. Try again.');
            return;
        }
        if (!image && !notes.trim() && !captionText.trim()) {
            onError('Draw your design or explain it before submitting.');
            return;
        }
        setFull(false);
        onSubmit({ image, notes: notes.trim() });
    };

    return (
        <div className="vi-split vi-design-split">
            <section className="vi-panel vi-brief" aria-label="Design brief">
                <SpokenQuestion question={question} reveal={reveal} />
                <p className="vi-eyebrow">Design brief</p>
                <h3>{details.title || 'Design exercise'}</h3>
                <p className="vi-pre-line"><RichText text={details.brief} /></p>
                {details.requirements?.length > 0 && (
                    <>
                        <h4>Requirements</h4>
                        <ul>{details.requirements.map(r => <li key={r}><RichText text={r} /></li>)}</ul>
                    </>
                )}
                <div className="vi-explain">
                    <div className="vi-explain-head">
                        <strong>Your explanation</strong>
                        <button type="button" className="vi-btn vi-sm" aria-pressed={talking} onClick={onToggleTalk} disabled={!canTalk}>
                            {talking ? <><span className="vi-rec-dot" />Pause recording</> : <><Mic size={14} aria-hidden="true" />Record explanation</>}
                        </button>
                    </div>
                    <div className="vi-captions vi-sm-caps" aria-live="polite">
                        {captionText || <span className="vi-placeholder">{canTalk ? 'Talk through your design while you draw. Your words appear here.' : 'No microphone: type your explanation below.'}</span>}
                    </div>
                    <label className="vi-fine" htmlFor={`vi-notes-${question.id}`}>Or type notes</label>
                    <textarea id={`vi-notes-${question.id}`} className="vi-textarea" rows={3} maxLength={6000} value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Data flow, trade-offs, what happens when things fail…" />
                </div>
                <button type="button" className="vi-btn vi-primary" onClick={submit} disabled={busy}>Submit design<ArrowRight size={15} aria-hidden="true" /></button>
            </section>
            <section className={`vi-panel vi-board-panel ${full ? 'is-full' : ''}`} aria-label="Whiteboard">
                <div className="vi-board-top">
                    <span className="vi-eyebrow">Whiteboard</span>
                    <span className="vi-fine">{count ? `${count} shape${count === 1 ? '' : 's'}` : 'Use the toolbar to draw boxes, arrows and labels'}</span>
                    <button type="button" className="vi-btn vi-icon" onClick={() => setFull(f => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>
                        {full ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
                    </button>
                </div>
                <div className="vi-board">
                    <LoadBoundary what="whiteboard">
                        <Suspense fallback={<div className="vi-editor-loading">Loading the whiteboard…</div>}>
                        <Whiteboard ref={boardRef} draftKey={boardDraftKey(question.id)} onCountChange={setCount} />
                    </Suspense>
                    </LoadBoundary>
                </div>
                <p className="vi-board-foot vi-fine">Your drawing is sent as an image with your explanation, so the AI reviews the diagram itself.</p>
            </section>
        </div>
    );
};

export default DesignStage;
