import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { useFeedback } from './ui/feedbackContext';
import { BAND, formatDate, scoreBand } from '../utils/format';

/**
 * One interview: who/when, five question scores, and the next action
 * (resume an unfinished interview or open the results of a finished one).
 */
const InterviewRow = ({ interview }) => {
    const navigate = useNavigate();
    const { tipAt, hideTip } = useFeedback();
    const live = interview.status !== 'completed';
    const questions = interview.questions;

    const cellTip = (el, q, i) => {
        if (q.score == null) {
            tipAt(el, i === interview.current_index && q.topic
                ? <><strong>Q{i + 1} · waiting for your answer</strong><span>{q.topic}</span></>
                : <><strong>Q{i + 1}</strong><span>Not asked yet. Questions adapt to your earlier answers.</span></>);
            return;
        }
        const band = BAND[scoreBand(q.score)];
        tipAt(el, (
            <>
                <strong>Q{i + 1} · {q.score.toFixed(1)} / 10</strong>
                {q.topic && <span>{q.topic}</span>}
                <span className="ps-tip-row"><i className="ps-sw" style={{ '--c': band.hex }} />{band.label}</span>
                {q.approx && <span>Approximate score: the AI evaluator was unavailable.</span>}
            </>
        ));
    };

    return (
        <div className="ps-srow">
            <div className="ps-s-who">
                <span className="ps-mono-tile" title={interview.company || 'General standard'}>
                    {interview.company ? interview.company.slice(0, 2) : <Globe size={16} aria-hidden="true" />}
                </span>
                <div>
                    <strong>{interview.role}</strong>
                    <span>
                        {interview.company || 'General standard'} · {interview.seniority} · {formatDate(interview.date)}
                        {live && <> · <span className="ps-live" style={{ display: 'inline' }}>in progress</span></>}
                    </span>
                </div>
            </div>
            <div className="ps-scores">
                {questions.map((q, i) => {
                    const current = live && i === interview.current_index;
                    const label = q.score != null ? `Question ${i + 1}: ${q.score.toFixed(1)}` : `Question ${i + 1}: ${current ? 'waiting for your answer' : 'not asked yet'}`;
                    return (
                        <span
                            key={i}
                            className={`ps-score ${q.score == null ? (current ? 'current' : 'pending') : ''}`}
                            tabIndex={0}
                            aria-label={label}
                            onMouseEnter={(e) => cellTip(e.currentTarget, q, i)}
                            onMouseLeave={hideTip}
                            onFocus={(e) => cellTip(e.currentTarget, q, i)}
                            onBlur={hideTip}
                        >
                            {q.score != null ? q.score.toFixed(1) : current ? '···' : '–'}
                            {q.approx && <sup>≈</sup>}
                            {q.score != null && <i className={`ps-b-${scoreBand(q.score)}`} />}
                        </span>
                    );
                })}
            </div>
            <div className="ps-s-end">
                {live ? (
                    <>
                        <div className="ps-s-stat"><b>{interview.answered} of {interview.total}</b>answered</div>
                        <button className="ps-btn ps-btn-sm ps-btn-primary" type="button" onClick={() => navigate(`/dashboard?resume=${interview.id}`)}>Resume</button>
                    </>
                ) : (
                    <>
                        <div className="ps-s-stat"><b>{interview.overall != null ? interview.overall.toFixed(1) : '–'}</b>overall</div>
                        <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => navigate(`/interviews/${interview.id}`)}>Results</button>
                    </>
                )}
            </div>
        </div>
    );
};

export const ScoreKey = () => (
    <div className="ps-key" aria-label="Score colours">
        <span><i className="ps-b-strong" />8+</span>
        <span><i className="ps-b-track" />6–7.9</span>
        <span><i className="ps-b-work" />under 6</span>
    </div>
);

export default InterviewRow;
