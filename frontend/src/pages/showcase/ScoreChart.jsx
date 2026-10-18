import React, { useEffect, useRef, useState } from 'react';
import { useFeedback } from '../../components/ui/feedbackContext';
import { plural } from './showcaseData';

const H = 210;
const PAD = { left: 34, right: 6, top: 28, bottom: 26 };
const GAP = 3;

/** A bar with only its top corners rounded, standing on the baseline. */
function barPath(x, y, w, h, r) {
    const radius = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

/** How candidate scores are spread across ten 10-point ranges, with the viewer's range marked. */
const ScoreChart = ({ buckets, you, roleName }) => {
    const { tipAt, hideTip } = useFeedback();
    const [hot, setHot] = useState(null);
    // Drawn at the container's real width so labels stay 11px on phones and wide screens alike.
    const [W, setW] = useState(560);
    const boxRef = useRef(null);
    useEffect(() => {
        const el = boxRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const max = Math.max(1, ...buckets);
    const top = Math.max(2, Math.ceil(max / 2) * 2);
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const slot = plotW / buckets.length;
    const y = v => PAD.top + plotH - (v / top) * plotH;
    const range = i => `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`;

    const show = (i, target) => {
        setHot(i);
        tipAt(target, (
            <>
                <strong>Score {range(i)}</strong>
                <span>{plural(buckets[i], 'candidate')}</span>
                {i === you && <span>Your score is in this range</span>}
            </>
        ));
    };
    const hide = () => { setHot(null); hideTip(); };

    return (
        <div className="bm-chart" ref={boxRef}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Candidate scores for ${roleName}, in ten ranges${you !== null ? `; your score is in the ${range(you)} range` : ''}.`}>
                {[0, top / 2, top].map(v => (
                    <g key={v}>
                        <line className="ps-grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
                        <text className="ps-axis-text" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">{v}</text>
                    </g>
                ))}
                {buckets.map((count, i) => {
                    const x = PAD.left + i * slot + GAP / 2;
                    const w = slot - GAP;
                    const h = (count / top) * plotH;
                    const classes = `bm-bar ${i === you ? 'is-you' : ''} ${hot === i ? 'is-hot' : ''}`;
                    return (
                        <g key={i}>
                            {count > 0 && <path className={classes} d={barPath(x, y(count), w, h, 4)} />}
                            {i === you && (
                                <>
                                    <line className="bm-you-line" x1={x + w / 2} x2={x + w / 2} y1={y(count) - 14} y2={y(count) - 4} />
                                    <text className="bm-you-tag" x={x + w / 2} y={y(count) - 18} textAnchor="middle">You</text>
                                </>
                            )}
                            <rect
                                className="bm-hit"
                                x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH}
                                tabIndex={0}
                                aria-label={`Score ${range(i)}: ${plural(count, 'candidate')}${i === you ? ', your range' : ''}`}
                                onMouseEnter={(e) => show(i, e.currentTarget)}
                                onMouseLeave={hide}
                                onFocus={(e) => show(i, e.currentTarget)}
                                onBlur={hide}
                            />
                            <rect className="bm-focus" x={PAD.left + i * slot + 1} y={PAD.top} width={slot - 2} height={plotH} rx={6} />
                        </g>
                    );
                })}
                <line className="ps-avg-line" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
                {[0, 20, 40, 60, 80, 100].map(v => (
                    <text key={v} className="ps-axis-text" x={PAD.left + (v / 10) * slot} y={H - 6} textAnchor={v === 0 ? 'start' : v === 100 ? 'end' : 'middle'}>{v}</text>
                ))}
            </svg>
            <table className="ps-sr-only">
                <caption>Candidates per score range</caption>
                <thead><tr><th scope="col">Score</th><th scope="col">Candidates</th></tr></thead>
                <tbody>
                    {buckets.map((count, i) => <tr key={i}><td>{range(i)}{i === you ? ' (you)' : ''}</td><td>{count}</td></tr>)}
                </tbody>
            </table>
        </div>
    );
};

export default ScoreChart;
