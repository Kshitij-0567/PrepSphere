import React, { useRef, useState } from 'react';
import { useFeedback } from '../../components/ui/feedbackContext';
import { formatDate } from '../../utils/format';

const W = 540, H = 210;
const M = { l: 34, r: 56, t: 14, b: 30 };
const PW = W - M.l - M.r, PH = H - M.t - M.b;

function yDomain(scores) {
    const lo = Math.max(0, Math.min(5, Math.floor(Math.min(...scores)) - 1));
    const hi = Math.min(10, Math.max(lo + 4, Math.ceil(Math.max(...scores)) + 1));
    return [lo, hi];
}

const TrendChart = ({ trend, average }) => {
    const { tipAt, hideTip } = useFeedback();
    const [hot, setHot] = useState(null);
    const dotRefs = useRef([]);

    const scores = trend.map(t => t.score);
    const [lo, hi] = yDomain(scores);
    const times = trend.map(t => new Date(t.date).getTime());
    const span = Math.max(times[times.length - 1] - times[0], 0);
    const x = (i) => (trend.length === 1 || span === 0
        ? M.l + (trend.length === 1 ? PW / 2 : (i / (trend.length - 1)) * PW)
        : M.l + ((times[i] - times[0]) / span) * PW);
    const y = (v) => M.t + ((hi - v) / (hi - lo)) * PH;
    const pts = trend.map((t, i) => ({ ...t, x: x(i), y: y(t.score) }));
    const ticks = [];
    const step = hi - lo > 6 ? 2 : 1;
    for (let v = lo; v <= hi; v += step) ticks.push(v);

    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${y(lo)} L${pts[0].x.toFixed(1)} ${y(lo)} Z`;
    const last = pts[pts.length - 1];

    // Keep x labels from colliding when interviews are close together.
    const labelled = pts.reduce((acc, p) => {
        const show = p.x - acc.lastX > 46 || p === last;
        return { lastX: show ? p.x : acc.lastX, flags: [...acc.flags, show] };
    }, { lastX: -Infinity, flags: [] }).flags;

    const enter = (i) => {
        setHot(i);
        const p = pts[i];
        if (dotRefs.current[i]) {
            tipAt(dotRefs.current[i], (
                <>
                    <strong>{formatDate(p.date)} · {p.score.toFixed(1)} / 10</strong>
                    <span>{p.role}{p.company ? ` · ${p.company}` : ''}</span>
                </>
            ));
        }
    };
    const leave = () => { setHot(null); hideTip(); };

    return (
        <div className="ps-chart-scroll">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Overall score by interview, from ${scores[0].toFixed(1)} to ${last.score.toFixed(1)}`}>
                {ticks.map(v => (
                    <g key={v}>
                        <line className="ps-grid-line" x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
                        <text className="ps-axis-text" x={M.l - 10} y={y(v)} dy="0.35em" textAnchor="end">{v}</text>
                    </g>
                ))}
                {pts.map((p, i) => labelled[i] && (
                    <text key={`d-${p.interview_id}`} className="ps-axis-text" x={p.x.toFixed(1)} y={H - 8} textAnchor="middle">{formatDate(p.date)}</text>
                ))}
                {pts.length > 1 && <path className="ps-trend-area" d={area} />}
                {average != null && pts.length > 1 && (
                    <>
                        <line className="ps-avg-line" x1={M.l} x2={W - M.r} y1={y(average)} y2={y(average)} />
                        <text className="ps-axis-text" x={W - M.r + 8} y={y(average)} dy="0.35em">avg {average.toFixed(1)}</text>
                    </>
                )}
                {pts.length > 1 && <path className="ps-trend-line" d={line} />}
                {hot != null && <line className="ps-crosshair" x1={pts[hot].x} x2={pts[hot].x} y1={M.t} y2={y(lo)} />}
                {pts.map((p, i) => (
                    <circle
                        key={p.interview_id}
                        ref={el => { dotRefs.current[i] = el; }}
                        className={`ps-pt ${hot === i ? 'is-hot' : ''}`}
                        cx={p.x.toFixed(1)}
                        cy={p.y.toFixed(1)}
                        r={i === pts.length - 1 ? 5 : 4}
                    />
                ))}
                <text className="ps-end-label" x={(last.x + 10).toFixed(1)} y={last.y.toFixed(1)} dy="0.35em">{last.score.toFixed(1)}</text>
                {pts.map((p, i) => {
                    const left = i === 0 ? M.l - 10 : (pts[i - 1].x + p.x) / 2;
                    const right = i === pts.length - 1 ? W - M.r + 10 : (p.x + pts[i + 1].x) / 2;
                    return (
                        <rect
                            key={`h-${p.interview_id}`}
                            className="ps-hit"
                            x={left.toFixed(1)}
                            y={M.t}
                            width={Math.max(right - left, 1).toFixed(1)}
                            height={PH}
                            tabIndex={0}
                            role="button"
                            aria-label={`${formatDate(p.date)}: ${p.score.toFixed(1)} out of 10`}
                            onMouseEnter={() => enter(i)}
                            onMouseLeave={leave}
                            onFocus={() => enter(i)}
                            onBlur={leave}
                        />
                    );
                })}
            </svg>
        </div>
    );
};

const TrendTable = ({ trend }) => (
    <div className="ps-chart-scroll">
        <table className="ps-table">
            <thead><tr><th>Date</th><th>Role</th><th>Company</th><th className="num">Score</th></tr></thead>
            <tbody>
                {trend.slice().reverse().map(t => (
                    <tr key={t.interview_id}>
                        <td>{formatDate(t.date)}</td>
                        <td>{t.role}</td>
                        <td>{t.company || 'General'}</td>
                        <td className="num">{t.score.toFixed(1)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const DIMENSIONS = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'correctness', label: 'Correctness' },
    { key: 'completeness', label: 'Completeness' },
];
const ADVICE = {
    completeness: 'End each design answer with what fails first and how you would notice.',
    correctness: 'Check definitions and trade-offs before committing to an answer.',
    relevance: 'Answer the exact question first, then add context.',
};

const ProgressCard = ({ stats, quality }) => {
    const [view, setView] = useState('chart');
    const trend = stats.trend || [];

    return (
        <article className="ps-card" aria-labelledby="ps-progress-title">
            <div className="ps-card-head">
                <div>
                    <h2 className="ps-card-title" id="ps-progress-title">Progress</h2>
                    <p className="ps-card-sub">How your scores and answers have changed across completed interviews</p>
                </div>
            </div>
            <div className="ps-progress-grid">
                <div>
                    <div className="ps-sub-head">
                        <h3 className="ps-sub-title">Score by interview</h3>
                        {trend.length > 0 && (
                            <div className="ps-seg" role="group" aria-label="View">
                                <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button>
                                <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
                            </div>
                        )}
                    </div>
                    {trend.length === 0
                        ? <p className="ps-muted">Complete a mock interview to see your score trend.</p>
                        : view === 'chart' ? <TrendChart trend={trend} average={stats.average} /> : <TrendTable trend={trend} />}
                </div>
                <div>
                    <div className="ps-sub-head">
                        <h3 className="ps-sub-title">Answer quality</h3>
                        {quality && <span className="ps-muted" style={{ fontSize: 12 }}>avg of {quality.answers} answers</span>}
                    </div>
                    {quality ? (
                        <div className="ps-quality">
                            {DIMENSIONS.map(d => {
                                const value = quality[d.key];
                                const lowest = quality.lowest === d.key;
                                return (
                                    <div className="ps-q-row" key={d.key}>
                                        <span className="ps-q-name">{d.label} {lowest && <span className="ps-pill ps-pill-warn">Lowest</span>}</span>
                                        <span className="ps-q-val">{value.toFixed(2)}</span>
                                        <div className={`ps-meter ${lowest ? 'warn' : ''}`} role="img" aria-label={`${d.label} ${value.toFixed(2)}`}>
                                            <i style={{ width: `${Math.round(value * 100)}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <p className="ps-q-note">{ADVICE[quality.lowest]}</p>
                        </div>
                    ) : (
                        <p className="ps-muted">Rubric scores appear after your first answered question.</p>
                    )}
                </div>
            </div>
        </article>
    );
};

export default ProgressCard;
