import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowRight, Clock, Info, Mic, MicOff } from 'lucide-react';
import LoadBoundary from './LoadBoundary';
import RichText from './RichText';
import { SpokenQuestion } from './SpokenStage';
import { LANGUAGE_LABEL, clock, codeDraftKey, readDraft, writeDraft } from './lib/delivery';

const CodeEditor = lazy(() => import('./CodeEditor'));

const COMMENT = { python: '#', sql: '--' };

function starterCode(details, language) {
    const given = details?.starter_code?.[language];
    if (given) return given.endsWith('\n') ? given : `${given}\n`;
    return `${COMMENT[language] || '//'} Write your solution in ${LANGUAGE_LABEL[language] || language} here\n`;
}

/** The coding step: problem on the left, editor on the right, think-aloud captions underneath. */
const CodingStage = ({ question, reveal, guideSeconds, stepSeconds, talking, canTalk, micOn, onToggleTalk, captionText, busy, onSubmit }) => {
    const details = question.details || {};
    const languages = details.languages?.length ? details.languages : ['python'];
    const [state, setState] = useState(() => {
        const draft = readDraft(codeDraftKey(question.id));
        const language = draft?.language && languages.includes(draft.language) ? draft.language : (details.default_language || languages[0]);
        return { language, buffers: draft?.buffers || {} };
    });
    const code = state.buffers[state.language] ?? starterCode(details, state.language);
    const changed = code.trim() && code !== starterCode(details, state.language);

    useEffect(() => {
        const id = setTimeout(() => writeDraft(codeDraftKey(question.id), state), 600);
        return () => clearTimeout(id);
    }, [state, question.id]);

    const setCode = (value) => setState(s => ({ ...s, buffers: { ...s.buffers, [s.language]: value } }));
    const tail = captionText.length > 140 ? `…${captionText.slice(-138)}` : captionText;

    return (
        <div className="vi-split vi-code-split">
            <section className="vi-panel vi-brief" aria-label="Problem">
                <SpokenQuestion question={question} reveal={reveal} />
                <p className="vi-eyebrow">Problem</p>
                <h3>{details.title || 'Coding problem'}</h3>
                <p className="vi-pre-line"><RichText text={details.prompt} /></p>
                {details.examples?.length > 0 && <pre className="vi-example">{details.examples.join('\n')}</pre>}
                {details.constraints?.length > 0 && (
                    <>
                        <h4>Constraints</h4>
                        <ul>{details.constraints.map(c => <li key={c}><RichText text={c} /></li>)}</ul>
                    </>
                )}
                <span className="vi-diff">{question.difficulty || 'Medium'}</span>
                <p className="vi-note"><Info size={15} aria-hidden="true" /><span>Your code isn't run. The interviewer reviews your logic, edge cases and complexity, plus what you say while you code.</span></p>
            </section>
            <section className="vi-panel vi-editor-panel" aria-label="Code editor">
                <div className="vi-ed-head">
                    <div className="vi-lang-tabs" role="tablist" aria-label="Language">
                        {languages.map(lang => (
                            <button key={lang} type="button" role="tab" aria-selected={lang === state.language} onClick={() => setState(s => ({ ...s, language: lang }))}>
                                {LANGUAGE_LABEL[lang] || lang}
                            </button>
                        ))}
                    </div>
                    <span className="vi-time-pill vi-mono"><Clock size={13} aria-hidden="true" />{clock(stepSeconds, true)} · {Math.round(guideSeconds / 60)} min suggested</span>
                </div>
                <div className="vi-editor">
                    <LoadBoundary what="editor">
                        <Suspense fallback={<div className="vi-editor-loading">Loading the editor…</div>}>
                        <CodeEditor value={code} language={state.language} onChange={setCode} label={`Code editor, ${LANGUAGE_LABEL[state.language] || state.language}. Press Escape then Tab to leave.`} />
                    </Suspense>
                    </LoadBoundary>
                </div>
                <div className="vi-think-strip">
                    <button type="button" className="vi-btn vi-icon" aria-pressed={talking} onClick={onToggleTalk} disabled={!canTalk}
                        aria-label={talking ? 'Pause think-aloud recording' : 'Record think-aloud'} title={talking ? 'Pause think-aloud recording' : 'Record think-aloud'}>
                        {talking && micOn ? <Mic size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />}
                    </button>
                    <div className="vi-think-cap">
                        <span className="vi-fine">{!canTalk ? 'No microphone: type your reasoning as comments' : talking ? 'Think aloud · recording' : 'Think-aloud paused'}</span>
                        <p>{tail || 'Talk through your approach as you type.'}</p>
                    </div>
                    <button type="button" className="vi-btn vi-primary" onClick={() => onSubmit(code, state.language)} disabled={busy || !changed}>
                        Submit code<ArrowRight size={15} aria-hidden="true" />
                    </button>
                </div>
            </section>
        </div>
    );
};

export default CodingStage;
