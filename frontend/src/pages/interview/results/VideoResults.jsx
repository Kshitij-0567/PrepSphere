import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, Check, Lightbulb, RotateCcw, SkipForward, Trash2, VideoOff, X } from 'lucide-react';
import { useFeedback } from '../../../components/ui/feedbackContext';
import { formatDateLong } from '../../../utils/format';
import ClipPlayer from './ClipPlayer';
import { KIND_ICON } from '../lib/icons';
import { KIND_LABEL, LANGUAGE_LABEL, PACE_TARGET, clock, fillerParts, resultBand } from '../lib/delivery';
import { deleteInterviewClips, getClips } from '../lib/recordings';
import '../video-results.css';

const RUBRIC = [['correctness', 'Correctness'], ['relevance', 'Relevance'], ['completeness', 'Completeness']];
const CRITERIA_LABEL = {
    correctness: 'Correctness', edge_cases: 'Edge cases', complexity: 'Complexity', readability: 'Readability',
    components: 'Components', scale: 'Scale', trade_offs: 'Trade-offs', communication: 'Explanation',
};
const STAR_LABEL = { situation: 'Situation', task: 'Task', action: 'Action', result: 'Result' };
const KEYWORDS = new Set('def class return if else elif while for in and or not is None True False self import from const let var function new this public private static void int long bool boolean string package func struct type range map module endmodule always begin end assign reg wire input output select where group by order join'.split(' '));

const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const answered = (step) => step.questions.filter(q => q.answer);

function highlight(line) {
    const parts = [];
    const re = /(#.*|\/\/.*|--.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line))) {
        if (m.index > last) parts.push(line.slice(last, m.index));
        const tok = m[0];
        const cls = m[1] ? 't-com' : m[2] ? 't-str' : m[3] ? 't-num' : KEYWORDS.has(tok) ? 't-kw' : line[re.lastIndex] === '(' ? 't-fn' : '';
        parts.push(cls ? <span key={m.index} className={cls}>{tok}</span> : tok);
        last = re.lastIndex;
        if (m[1]) break;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
}

const Filler = ({ text }) => fillerParts(text).map((p, i) => (p.filler ? <mark key={i} className="vr-filler" title="Filler word">{p.text}</mark> : <React.Fragment key={i}>{p.text}</React.Fragment>));

const Bars = ({ rows }) => (
    <div className="vr-bars">
        {rows.map(([label, value, max, suffix]) => (
            <div className="vr-bar-row" key={label}>
                <span>{label}</span>
                <span className="vr-bar"><i style={{ width: `${Math.round((value / max) * 100)}%` }} /></span>
                <span className="ps-mono">{suffix === '%' ? `${Math.round(value * 100)}%` : value.toFixed(1)}</span>
            </div>
        ))}
    </div>
);

const Concepts = ({ items }) => {
    const detected = [...new Set(items.flatMap(q => q.answer.rubric.detected_concepts || []))];
    const missing = [...new Set(items.flatMap(q => q.answer.rubric.missing_concepts || []))].filter(c => !detected.includes(c));
    if (!detected.length && !missing.length) return null;
    return (
        <>
            {detected.length > 0 && <div className="vr-col"><h3 className="ps-label">Covered</h3><div className="vr-chips">{detected.map(c => <span key={c} className="vr-chip good"><Check size={12} aria-hidden="true" />{c}</span>)}</div></div>}
            {missing.length > 0 && <div className="vr-col"><h3 className="ps-label">Missed</h3><div className="vr-chips">{missing.map(c => <span key={c} className="vr-chip miss"><X size={12} aria-hidden="true" />{c}</span>)}</div></div>}
        </>
    );
};

const Feedback = ({ items }) => (
    <div className="vr-feedback">
        {items.map(q => (
            <div key={q.id} className="vr-feedback-item">
                <Lightbulb size={18} aria-hidden="true" />
                <p>
                    {items.length > 1 && <strong>{q.is_follow_up ? 'Follow-up: ' : 'Main answer: '}</strong>}
                    {q.answer.feedback}
                    {q.answer.evaluator === 'fallback' && <span className="vr-approx"> Approximate: the AI evaluator was unavailable, so this was checked automatically.</span>}
                </p>
            </div>
        ))}
    </div>
);

function transcriptLines(item, clip) {
    const offset = clip ? clip.answerOffset || 0 : 0;
    const lines = [{ t: 0, who: item.is_follow_up ? 'Follow-up' : 'Interviewer', text: item.question, ai: true }];
    const segments = item.answer?.segments?.length ? item.answer.segments : (item.answer?.text ? [{ start: 0, text: item.answer.text }] : []);
    segments.forEach(s => lines.push({ t: offset + (s.start || 0), who: 'You', text: s.text }));
    return lines;
}

function clipMarkers(item, clip) {
    const offset = clip.answerOffset || 0;
    const markers = [];
    (item.answer?.segments || []).forEach(s => { if (fillerParts(s.text).some(p => p.filler)) markers.push({ t: offset + s.start + 1, kind: 'filler' }); });
    (item.answer?.delivery?.pauses || []).forEach(([start]) => markers.push({ t: offset + start, kind: 'pause' }));
    return markers;
}

const SOURCE_NOTE = {
    captions: 'Transcript from live captions, because the AI could not transcribe the audio.',
    typed: 'Typed answer.',
};

const SpokenDetail = ({ step, clips, recordingsNote }) => {
    const items = answered(step);
    const withClips = items.filter(q => clips?.[q.id]);
    // Recordings load from this device after the page renders, so fall back to the first one found.
    const [chosenId, setActiveId] = useState(null);
    const activeId = withClips.some(q => q.id === chosenId) ? chosenId : withClips[0]?.id ?? null;
    const [time, setTime] = useState(0);
    const playerRef = useRef(null);
    const pendingSeek = useRef(null);
    const active = items.find(q => q.id === activeId);
    const activeClip = active ? clips?.[active.id] : null;
    const activeLines = active ? transcriptLines(active, activeClip) : [];
    const activeIndex = activeLines.reduce((idx, line, i) => (line.t <= time + 0.2 ? i : idx), -1);
    const rubric = RUBRIC.map(([key, label]) => [label, average(items.map(q => q.answer.rubric[key]).filter(v => v != null)) ?? 0, 1, '%']);
    const star = items.find(q => q.answer.rubric.star)?.answer.rubric.star;

    useEffect(() => {
        if (pendingSeek.current != null && playerRef.current) {
            playerRef.current.seek(pendingSeek.current);
            pendingSeek.current = null;
        }
    }, [activeId]);

    const jump = (item, t) => {
        if (!clips?.[item.id]) return;
        if (item.id !== activeId) { pendingSeek.current = t; setActiveId(item.id); setTime(0); } else playerRef.current?.seek(t);
    };
    const subtitleAt = (t) => {
        const line = [...activeLines].reverse().find(l => l.t <= t + 0.2);
        return line ? `${line.ai ? 'Interviewer: ' : ''}${line.text}` : '';
    };

    return (
        <>
            {withClips.length > 0 ? (
                <div className="vr-col">
                    {withClips.length > 1 && (
                        <div className="vr-tabs" role="tablist" aria-label="Recordings">
                            {withClips.map(q => (
                                <button key={q.id} type="button" role="tab" aria-selected={q.id === activeId} onClick={() => { setActiveId(q.id); setTime(0); }}>
                                    {q.is_follow_up ? 'Follow-up' : 'Main answer'}
                                </button>
                            ))}
                        </div>
                    )}
                    {activeClip && (
                        <ClipPlayer key={active.id} ref={playerRef} clip={activeClip} markers={clipMarkers(active, activeClip)} subtitleAt={subtitleAt} onTime={setTime} audioOnly={!activeClip.mime?.startsWith('video')} />
                    )}
                    <div className="vr-legend"><span><i className="vr-mk filler" />Filler word</span><span><i className="vr-mk pause" />Long pause</span><span>Click a line of the transcript to jump there.</span></div>
                </div>
            ) : recordingsNote}
            <div className="vr-grid">
                <div className="vr-col">
                    <h3 className="ps-label">Transcript</h3>
                    <div className="vr-transcript">
                        {items.map(item => transcriptLines(item, clips?.[item.id]).map((line, i) => {
                            const isActive = item.id === activeId && i === activeIndex;
                            const Tag = clips?.[item.id] ? 'button' : 'div';
                            return (
                                <Tag key={`${item.id}-${i}`} {...(Tag === 'button' ? { type: 'button', onClick: () => jump(item, line.t) } : {})}
                                    className={`vr-line ${line.ai ? 'ai' : ''} ${isActive ? 'active' : ''}`}>
                                    <span className="vr-line-time ps-mono">{clock(line.t)}</span>
                                    <span className="vr-line-who">{line.who}</span>
                                    <span className="vr-line-text">{line.ai ? line.text : <Filler text={line.text} />}</span>
                                </Tag>
                            );
                        }))}
                    </div>
                    {items.map(q => SOURCE_NOTE[q.answer.transcript_source] && <p key={q.id} className="ps-muted vr-source">{items.length > 1 ? `${q.is_follow_up ? 'Follow-up' : 'Main answer'}: ` : ''}{SOURCE_NOTE[q.answer.transcript_source]}</p>)}
                </div>
                <div className="vr-col">
                    <h3 className="ps-label">Rubric</h3>
                    <Bars rows={rubric} />
                    {star && (
                        <>
                            <h3 className="ps-label">STAR structure</h3>
                            <div className="vr-star">{Object.entries(STAR_LABEL).map(([k, label]) => <span key={k}>{label}<b className={star[k] === 'yes' ? '' : 'part'}>{star[k] === 'yes' ? 'Yes' : star[k] === 'partly' ? 'Partly' : star[k] === 'no' ? 'No' : '–'}</b></span>)}</div>
                        </>
                    )}
                    <Concepts items={items} />
                </div>
            </div>
            <Feedback items={items} />
        </>
    );
};

const CodeDetail = ({ step }) => {
    const item = answered(step)[0];
    const a = item.answer;
    const comments = Object.fromEntries((a.rubric.line_comments || []).map(c => [c.line, c]));
    const lines = (a.code || '').replace(/\n$/, '').split('\n');
    const criteria = Object.entries(a.rubric.criteria || {}).map(([k, v]) => [CRITERIA_LABEL[k] || k, v, 10]);
    return (
        <>
            <div className="vr-grid">
                <div className="vr-col">
                    <h3 className="ps-label">Your code · {LANGUAGE_LABEL[a.language] || a.language}{Object.keys(comments).length ? ' · reviewed line by line' : ''}</h3>
                    <div className="vr-review">
                        {lines.map((line, i) => {
                            const note = comments[i + 1];
                            return (
                                <React.Fragment key={i}>
                                    <div className={`vr-rv-line ${note ? `flag ${note.kind}` : ''}`}><span className="ln">{i + 1}</span><code>{highlight(line)}{line ? '' : ' '}</code></div>
                                    {note && <div className={`vr-rv-note ${note.kind}`}>{note.kind === 'good' ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}<span><strong>Line {note.line}.</strong> {note.text}</span></div>}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
                <div className="vr-col">
                    {criteria.length > 0 && <><h3 className="ps-label">Scores</h3><Bars rows={criteria} /></>}
                    <h3 className="ps-label">What you said while coding</h3>
                    {a.text ? <div className="vr-transcript">{(a.segments?.length ? a.segments : [{ start: 0, text: a.text }]).map((s, i) => (
                        <div key={i} className="vr-line"><span className="vr-line-time ps-mono">{clock(s.start)}</span><span className="vr-line-who">You</span><span className="vr-line-text"><Filler text={s.text} /></span></div>
                    ))}</div> : <p className="ps-muted">No think-aloud was recorded for this step.</p>}
                    <Concepts items={[item]} />
                </div>
            </div>
            <Feedback items={[item]} />
        </>
    );
};

const DesignDetail = ({ step }) => {
    const item = answered(step)[0];
    const a = item.answer;
    const criteria = Object.entries(a.rubric.criteria || {}).map(([k, v]) => [CRITERIA_LABEL[k] || k, v, 10]);
    return (
        <>
            {a.diagram_image ? (
                <div className="vr-col"><h3 className="ps-label">Your diagram</h3><div className="vr-diagram"><img src={a.diagram_image} alt={`Your whiteboard diagram for ${item.details?.title || step.title}`} /></div></div>
            ) : <p className="ps-muted">You didn't draw a diagram for this step.</p>}
            <div className="vr-grid">
                <div className="vr-col">
                    <h3 className="ps-label">Your explanation</h3>
                    {a.text ? <div className="vr-transcript">{(a.segments?.length ? a.segments : [{ start: 0, text: a.text }]).map((s, i) => (
                        <div key={i} className="vr-line"><span className="vr-line-time ps-mono">{clock(s.start)}</span><span className="vr-line-who">You</span><span className="vr-line-text"><Filler text={s.text} /></span></div>
                    ))}</div> : <p className="ps-muted">No explanation was recorded.</p>}
                </div>
                <div className="vr-col">{criteria.length > 0 && <><h3 className="ps-label">Scores</h3><Bars rows={criteria} /></>}<Concepts items={[item]} /></div>
            </div>
            <Feedback items={[item]} />
        </>
    );
};

const DeliveryPanel = ({ delivery, eyeTracked }) => {
    if (!delivery) {
        return <article className="ps-card vr-delivery"><p className="ps-label">Delivery</p><p className="ps-muted">No spoken answers were recorded, so there is no delivery feedback for this interview.</p></article>;
    }
    const lo = 80, hi = 200, pos = v => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
    const fillers = Object.entries(delivery.fillers || {});
    return (
        <article className="ps-card vr-delivery" aria-label="Delivery">
            <div className="vr-dl-head"><p className="ps-label">Delivery</p><span className="ps-muted">Scored separately. It never changes your content score.</span></div>
            <div className="vr-metrics">
                <div className="vr-metric">
                    <span className="vr-m-label">Speaking pace</span>
                    <span className="vr-m-val ps-mono">{delivery.pace ?? '–'}<small>words / min</small></span>
                    <div className="vr-range" aria-label={`Target ${PACE_TARGET[0]} to ${PACE_TARGET[1]} words a minute`}>
                        <span className="zone" style={{ left: pos(PACE_TARGET[0]), width: `calc(${pos(PACE_TARGET[1])} - ${pos(PACE_TARGET[0])})` }} />
                        {delivery.pace && <span className="mark" style={{ left: pos(delivery.pace) }} />}
                    </div>
                    <div className="vr-range-scale ps-mono"><span>{lo}</span><span>{PACE_TARGET[0]}–{PACE_TARGET[1]} target</span><span>{hi}</span></div>
                    {delivery.pace == null && <span className="ps-muted">Not enough recorded speech to measure.</span>}
                </div>
                <div className="vr-metric">
                    <span className="vr-m-label">Filler words</span>
                    <span className="vr-m-val ps-mono">{delivery.filler_total}<small>{delivery.fillers_per_minute != null ? `${delivery.fillers_per_minute} per min` : 'in total'}</small></span>
                    {fillers.length ? <div className="vr-fill-chips">{fillers.map(([w, n]) => <span key={w}>{w} ×{n}</span>)}</div> : <span className="ps-muted">None heard. Nice and clean.</span>}
                </div>
                <div className="vr-metric">
                    <span className="vr-m-label">Eye contact</span>
                    {delivery.eye_contact != null ? (
                        <>
                            <span className="vr-m-val ps-mono">{Math.round(delivery.eye_contact * 100)}%<small>approximate</small></span>
                            <span className="vr-bar"><i style={{ width: `${Math.round(delivery.eye_contact * 100)}%` }} /></span>
                            <span className="ps-muted">Share of answer time spent facing the screen</span>
                        </>
                    ) : <span className="ps-muted">{eyeTracked ? 'Not enough camera time to measure.' : 'Turned off, or no camera was used.'}</span>}
                </div>
                <div className="vr-metric">
                    <span className="vr-m-label">Long pauses</span>
                    <span className="vr-m-val ps-mono">{delivery.long_pauses}<small>over 3 seconds</small></span>
                    <span className="ps-muted">{delivery.longest_pause ? `Longest was ${Math.round(delivery.longest_pause)} s.` : 'No long silences.'}</span>
                </div>
            </div>
        </article>
    );
};

const VideoResults = ({ results }) => {
    const navigate = useNavigate();
    const { toast } = useFeedback();
    const steps = results.steps || [];
    const [clips, setClips] = useState(null);
    const [selected, setSelected] = useState(() => Math.max(0, steps.findIndex(s => s.status === 'answered')));
    const [confirmDelete, setConfirmDelete] = useState(false);
    const detailRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        getClips(results.interview_id).then(list => { if (!cancelled) setClips(Object.fromEntries(list.map(c => [c.questionId, c]))); });
        return () => { cancelled = true; };
    }, [results.interview_id]);

    const answeredSteps = steps.filter(s => s.status === 'answered');
    const spokenItems = answeredSteps.filter(s => s.kind === 'spoken').flatMap(answered);
    const rubric = RUBRIC.map(([key, label]) => [label, average(spokenItems.map(q => q.answer.rubric[key]).filter(v => v != null)) ?? 0, 1, '%']);
    const minutes = Math.round(steps.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
    const clipCount = clips ? Object.keys(clips).length : 0;
    const eyeTracked = spokenItems.some(q => q.answer.delivery?.face_in_frame != null);
    const step = steps[selected];
    const endedEarly = answeredSteps.length < steps.length;

    const deleteRecordings = async () => {
        await deleteInterviewClips(results.interview_id);
        setClips({});
        setConfirmDelete(false);
        toast('Recordings deleted from this device. Transcripts and scores are kept.');
    };

    const recordingsNote = (
        <div className="vr-no-rec">
            <VideoOff size={20} aria-hidden="true" />
            <span>{clips === null ? 'Looking for recordings on this device…' : 'No recording of this step on this device. Recordings stay in the browser they were made in, for your last 5 interviews, unless you turned them off or deleted them.'}</span>
        </div>
    );

    let detail;
    if (!step) detail = null;
    else if (step.status !== 'answered') {
        const q = step.questions[0];
        detail = (
            <div className="vr-skipped">
                <SkipForward size={26} aria-hidden="true" />
                <h2>{step.title}</h2>
                <p className="ps-muted">You ended the interview before this step, so it isn't scored.</p>
                {q && <p className="vr-q-small">It would have asked: {q.question}</p>}
            </div>
        );
    } else {
        const items = answered(step);
        const split = items.length > 1 ? items.map(q => `${q.is_follow_up ? 'Follow-up' : 'Main answer'} ${q.answer.score.toFixed(1)}`).join(' · ') : null;
        const Icon = KIND_ICON[step.kind];
        detail = (
            <>
                <header className="vr-d-head">
                    <div>
                        <p className="ps-label"><Icon size={13} aria-hidden="true" /> Step {step.index + 1} · {KIND_LABEL[step.kind]} · {clock(step.duration)} of ~{step.minutes} min</p>
                        <h2>{step.title}</h2>
                        {split && <p className="ps-muted">{split}</p>}
                    </div>
                    <div className="vr-d-score ps-mono">{step.score?.toFixed(1) ?? '–'}<small>/10</small></div>
                </header>
                {step.kind !== 'spoken' && items[0]?.details && (
                    <div className="vr-q"><p className="ps-label">{step.kind === 'code' ? 'Problem' : 'Brief'}</p><p><strong>{items[0].details.title}.</strong> {items[0].details.prompt || items[0].details.brief}</p></div>
                )}
                {step.kind === 'spoken' && <SpokenDetail key={step.index} step={step} clips={clips} recordingsNote={recordingsNote} />}
                {step.kind === 'code' && <CodeDetail step={step} />}
                {step.kind === 'design' && <DesignDetail step={step} />}
            </>
        );
    }

    const choose = (i) => {
        setSelected(i);
        if (window.matchMedia('(max-width: 1000px)').matches) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="vr">
            <div className="vr-top">
                <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => navigate('/interviews')}><ArrowLeft size={14} aria-hidden="true" /> All interviews</button>
                <div className="vr-actions">
                    <button className="ps-btn ps-btn-sm" type="button" onClick={() => setConfirmDelete(true)} disabled={!clipCount}>
                        <Trash2 size={14} aria-hidden="true" />{clipCount ? 'Delete recordings' : 'No recordings on this device'}
                    </button>
                    <button className="ps-btn ps-btn-sm" type="button" onClick={() => navigate('/dashboard')}><RotateCcw size={14} aria-hidden="true" />Practise again</button>
                    <button className="ps-btn ps-btn-sm ps-btn-primary" type="button" onClick={() => navigate('/study-plan')}><BookOpen size={14} aria-hidden="true" />Open study plan</button>
                </div>
            </div>
            {confirmDelete && (
                <div className="ps-banner ps-banner-error" role="alert">
                    <span>Delete all recordings of this interview from this device? Transcripts and scores stay.</span>
                    <button className="ps-btn ps-btn-sm" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                    <button className="ps-btn ps-btn-sm ps-btn-danger" type="button" onClick={deleteRecordings} style={{ marginLeft: 0 }}>Delete recordings</button>
                </div>
            )}
            <header className="vr-head">
                <p className="ps-label">Video interview · {formatDateLong(results.completed_at ? `${results.completed_at}Z`.replace("ZZ", "Z") : null)}{minutes ? ` · ${minutes} min` : ''}</p>
                <h1>{results.role_name}{results.company_name ? ` · ${results.company_name}` : ''}</h1>
                <p className="ps-muted">
                    {results.seniority || 'Mid'} level · {answeredSteps.length} of {steps.length} steps{results.follow_ups ? ` · ${results.follow_ups} follow-up${results.follow_ups === 1 ? '' : 's'}` : ''}{endedEarly ? ' · ended early' : ''}
                </p>
            </header>
            {results.used_fallback_evaluator && (
                <div className="ps-banner ps-banner-warn"><AlertTriangle size={16} aria-hidden="true" /><span>The AI evaluator was unavailable for some answers, so those scores come from an automatic check and are approximate.</span></div>
            )}
            <div className="vr-score-row">
                <article className="ps-card vr-score" aria-label="Content score">
                    <p className="ps-label">Content score</p>
                    <div className="vr-big-line">
                        <div className="vr-big">{results.overall_score != null ? results.overall_score.toFixed(1) : '–'}<small>/10</small></div>
                        {results.overall_score != null && <span className={`vr-band ${results.overall_score >= 7 ? 'good' : results.overall_score >= 5 ? 'mid' : 'low'}`}>{resultBand(results.overall_score)}</span>}
                    </div>
                    <p className="ps-muted">{answeredSteps.length ? (endedEarly ? `Average of the ${answeredSteps.length} steps you finished.` : `Average of all ${steps.length} steps.`) : 'You ended before finishing a step.'}</p>
                    {spokenItems.length > 0 && <><p className="ps-label">Spoken answers</p><Bars rows={rubric} /></>}
                </article>
                <DeliveryPanel delivery={results.delivery} eyeTracked={eyeTracked} />
            </div>
            <div className="vr-body">
                <nav className="ps-card vr-steps" aria-label="Steps">
                    <ol>
                        {steps.map((s, i) => {
                            const Icon = KIND_ICON[s.kind];
                            const skipped = s.status !== 'answered';
                            const fu = s.questions.some(q => q.is_follow_up);
                            return (
                                <li key={s.index}>
                                    <button type="button" className={`vr-step ${skipped ? 'is-skipped' : ''}`} aria-current={i === selected} onClick={() => choose(i)}>
                                        <span className="vr-step-ic"><Icon size={15} aria-hidden="true" /></span>
                                        <span>
                                            <span className="vr-step-name">{s.title}{fu && <span className="vr-fu"> + follow-up</span>}</span>
                                            <span className="vr-step-sub">{KIND_LABEL[s.kind]} · {skipped ? 'not reached' : `${clock(s.duration)} of ~${s.minutes} min`}</span>
                                        </span>
                                        <span className="vr-step-score ps-mono">{skipped ? <span className="vr-skip-chip">Skipped</span> : s.score?.toFixed(1)}</span>
                                        {!skipped && s.score != null && <span className="vr-step-bar"><i style={{ width: `${s.score * 10}%` }} /></span>}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>
                <article className="ps-card vr-detail" ref={detailRef} aria-live="polite">{detail}</article>
            </div>
            {results.recommendations?.length > 0 && (
                <article className="ps-card vr-next">
                    <h2 className="ps-card-title">Practise next</h2>
                    <ul>
                        {results.recommendations.map(r => (
                            <li key={r.id ?? r.topic}><span className={`vr-prio ${String(r.priority).toLowerCase()}`}>{r.priority}</span><strong>{r.topic}</strong><p>{r.reason}</p></li>
                        ))}
                    </ul>
                </article>
            )}
        </div>
    );
};

export default VideoResults;
