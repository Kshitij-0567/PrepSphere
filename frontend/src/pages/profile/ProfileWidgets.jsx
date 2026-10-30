import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Crosshair, Github, Loader2, RefreshCw, Star, TrendingUp, Trophy } from 'lucide-react';
import api, { apiErrorMessage } from '../../api/client';
import InterviewRow, { ScoreKey } from '../../components/InterviewRow';
import { useFeedback } from '../../components/ui/feedbackContext';
import { SKILL_STATUS, formatDate, relativeTime, resumePath } from '../../utils/format';

/* ---------------- Stat tiles ---------------- */
const Sparkline = ({ trend }) => {
    if (trend.length < 2) return null;
    const scores = trend.map(t => t.score);
    const lo = Math.min(...scores) - 0.5, hi = Math.max(...scores) + 0.5;
    const pts = scores.map((s, i) => [3 + (i / (scores.length - 1)) * 80, 4 + ((hi - s) / (hi - lo)) * 22]);
    const [lx, ly] = pts[pts.length - 1];
    return (
        <svg width="80" height="30" viewBox="0 0 88 30" role="img" aria-label={`Scores by interview: ${scores.map(s => s.toFixed(1)).join(', ')}`}>
            <polyline points={pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')} fill="none" stroke="#6f7b98" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="3.2" fill="#818cf8" stroke="#0b1120" strokeWidth="1.5" />
        </svg>
    );
};

export const StatTiles = ({ summary }) => {
    const { readiness, target, stats } = summary;
    return (
        <div className="ps-tiles">
            <div className="ps-tile">
                <span className="ps-tile-label">Role readiness</span>
                <span className="ps-tile-value">{readiness ? <>{readiness.score.toFixed(1)}<small>%</small></> : '–'}</span>
                <div className="ps-meter" role="img" aria-label={readiness ? `Role readiness ${readiness.score} percent` : 'No target role yet'}>
                    <i style={{ width: `${readiness?.score || 0}%` }} />
                </div>
                <span className="ps-tile-foot">
                    {target ? `${readiness.covered} of ${readiness.total} requirement weight · ${target.role_name}` : 'Start an interview to set a target role'}
                </span>
            </div>
            <div className="ps-tile">
                <span className="ps-tile-label">Average interview score</span>
                <div className="ps-tile-row">
                    <span className="ps-tile-value">{stats.average != null ? <>{stats.average.toFixed(1)}<small>/10</small></> : '–'}</span>
                    <Sparkline trend={stats.trend} />
                </div>
                <span className="ps-tile-foot">
                    {stats.delta != null
                        ? <><span className={stats.delta >= 0 ? 'ps-up' : 'ps-down'}>{stats.delta >= 0 ? '+' : ''}{stats.delta.toFixed(1)}</span> since your first interview</>
                        : stats.completed === 1 ? 'From your first completed interview' : 'No completed interviews yet'}
                </span>
            </div>
            <div className="ps-tile">
                <span className="ps-tile-label">Mock interviews</span>
                <span className="ps-tile-value">{stats.completed}<small> done</small></span>
                <span className="ps-tile-foot">{stats.in_progress} in progress · {stats.answers_scored} answers scored</span>
            </div>
        </div>
    );
};

/* ---------------- Insights ---------------- */
const INSIGHT_ICONS = { good: Trophy, warn: AlertTriangle, accent: TrendingUp, crit: Crosshair };

export const Insights = ({ insights }) => (
    <article className="ps-card" aria-labelledby="ps-ins-title">
        <div className="ps-card-head"><h2 className="ps-card-title" id="ps-ins-title">What stands out</h2></div>
        {insights.length === 0 ? (
            <p className="ps-muted">Insights appear after your first interview.</p>
        ) : (
            <ul className="ps-insights">
                {insights.map((item, i) => {
                    const Icon = INSIGHT_ICONS[item.kind] || TrendingUp;
                    return (
                        <li key={i}>
                            <span className={`ps-i-icon ps-i-${item.kind}`}><Icon size={16} aria-hidden="true" /></span>
                            <div><strong>{item.title}</strong><p>{item.text}</p></div>
                        </li>
                    );
                })}
            </ul>
        )}
    </article>
);

/* ---------------- Next step ---------------- */
export const NextStepCard = ({ nextStep, stats }) => {
    const navigate = useNavigate();
    if (nextStep) {
        return (
            <article className="ps-card ps-next-card" aria-labelledby="ps-next-title">
                <p className="ps-label">Pick up where you left off</p>
                <h2 id="ps-next-title">{nextStep.company ? `${nextStep.company} · ` : ''}{nextStep.role}, {nextStep.seniority}</h2>
                <p>{nextStep.mode === 'video' ? 'Step' : 'Question'} {nextStep.answered + 1}: {nextStep.question}</p>
                <div className="ps-next-meta"><span>{nextStep.answered} of {nextStep.total} answered</span><span>Started {formatDate(nextStep.started_at)}</span></div>
                <div className="ps-meter" role="img" aria-label={`${nextStep.answered} of ${nextStep.total} ${nextStep.mode === 'video' ? 'steps' : 'questions'} answered`}>
                    <i style={{ width: `${(nextStep.answered / nextStep.total) * 100}%` }} />
                </div>
                <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate(resumePath({ id: nextStep.interview_id, mode: nextStep.mode }))}>Resume interview</button>
            </article>
        );
    }
    const first = stats.total === 0;
    return (
        <article className="ps-card ps-next-card" aria-labelledby="ps-next-title">
            <p className="ps-label">{first ? 'Get started' : 'Keep the streak going'}</p>
            <h2 id="ps-next-title">{first ? 'Take your first mock interview' : 'Practise another interview'}</h2>
            <p>{first
                ? 'Pick a role and company, add your resume, and answer five tailored questions.'
                : 'Each interview sharpens your weakest skills and updates this profile.'}</p>
            <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/dashboard')} style={{ marginTop: 'auto' }}>
                Start mock interview <ArrowRight size={15} aria-hidden="true" />
            </button>
        </article>
    );
};

/* ---------------- Recent interviews ---------------- */
export const RecentInterviews = ({ interviews, total }) => {
    const navigate = useNavigate();
    return (
        <article className="ps-card" aria-labelledby="ps-recent-title">
            <div className="ps-card-head">
                <div>
                    <h2 className="ps-card-title" id="ps-recent-title">Recent interviews</h2>
                    <p className="ps-card-sub">Five questions each. Hover a score for the question.</p>
                </div>
                {interviews.length > 0 && <ScoreKey />}
            </div>
            {interviews.length === 0 ? (
                <div className="ps-empty">
                    <span>You have not taken a mock interview yet.</span>
                    <button className="ps-btn ps-btn-sm" type="button" onClick={() => navigate('/dashboard')}>Start one now</button>
                </div>
            ) : (
                <>
                    <div className="ps-sessions">
                        {interviews.map(interview => <InterviewRow key={interview.id} interview={interview} />)}
                    </div>
                    {total > interviews.length && (
                        <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" style={{ marginTop: 6 }} onClick={() => navigate('/interviews')}>
                            View all {total} interviews
                        </button>
                    )}
                </>
            )}
        </article>
    );
};

/* ---------------- Study plan ---------------- */
const PRIORITY_CLASS = { High: 'ps-p-high', Medium: 'ps-p-medium', Low: 'ps-p-low' };

export const StudyPlanCard = ({ plan }) => {
    const navigate = useNavigate();
    return (
        <article className="ps-card" aria-labelledby="ps-plan-title">
            <div className="ps-card-head">
                <div>
                    <h2 className="ps-card-title" id="ps-plan-title">Study plan</h2>
                    <p className="ps-card-sub">From your latest interview and your skill gaps</p>
                </div>
                <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => navigate('/study-plan')}>View all</button>
            </div>
            {plan.length === 0 ? (
                <p className="ps-muted">Finish an interview to get a personalised study plan.</p>
            ) : (
                <ul className="ps-plan">
                    {plan.map((item, i) => (
                        <li key={i}>
                            <span className={`ps-prio ${PRIORITY_CLASS[item.priority] || 'ps-p-medium'}`}><i />{item.priority}</span>
                            <div><strong>{item.topic}</strong>{item.reason && <p>{item.reason}</p>}</div>
                            <span className="ps-src">{item.source === 'skill_gap' ? 'Skill gap' : `Interview${item.date ? ` · ${formatDate(item.date)}` : ''}`}</span>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
};

/* ---------------- GitHub ---------------- */
const LANG_COLORS = ['var(--lang-1)', 'var(--lang-2)', 'var(--lang-3)', 'var(--lang-4)'];

export const GitHubCard = ({ github, username, url, nodes, onSynced }) => {
    const { toast, tipAt, hideTip } = useFeedback();
    const [syncing, setSyncing] = useState(false);

    const sync = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/profile/github/sync');
            toast(`GitHub synced: ${res.data.github?.skills?.length || 0} skills found.`);
            onSynced();
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not sync GitHub.'), { error: true });
        }
        setSyncing(false);
    };

    const evidence = nodes.filter(n => n.github && n.required);
    const colorFor = (name, i) => (name === 'Other' ? 'var(--lang-other)' : LANG_COLORS[i] || 'var(--lang-other)');

    return (
        <article className="ps-card" aria-labelledby="ps-gh-title">
            <div className="ps-gh-head">
                <span className="ps-brand-ico"><Github size={19} aria-hidden="true" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <strong id="ps-gh-title">@{github?.username || username}</strong>
                    <span>{github ? `Synced ${relativeTime(github.synced_at)}` : 'Import not finished'}</span>
                </div>
                <button className="ps-btn ps-btn-sm" type="button" onClick={sync} disabled={syncing} aria-label="Sync GitHub">
                    {syncing ? <Loader2 size={13} className="ps-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
                    {syncing ? 'Syncing…' : 'Sync'}
                </button>
                <a className="ps-btn ps-btn-sm ps-btn-ghost" href={github?.profile_url || url} target="_blank" rel="noopener noreferrer">Open</a>
            </div>

            {!github ? (
                <p className="ps-muted" style={{ marginTop: 16 }}>GitHub could not be reached when you saved this link. Use Sync to import your repositories.</p>
            ) : (
                <>
                    <div className="ps-gh-stats">
                        <div><b>{github.public_repos}</b>repositories</div>
                        <div><b>{github.stars}</b>stars</div>
                        <div><b>{github.followers}</b>followers</div>
                    </div>

                    {github.languages.length > 0 && (
                        <>
                            <p className="ps-label" style={{ marginBottom: 8 }}>Languages across repositories</p>
                            <div className="ps-langbar" role="img" aria-label={github.languages.map(l => `${l.name} ${l.pct}%`).join(', ')}>
                                {github.languages.map((l, i) => (
                                    <span
                                        key={l.name}
                                        style={{ width: `${l.pct}%`, background: colorFor(l.name, i) }}
                                        onMouseEnter={(e) => tipAt(e.currentTarget, <><strong>{l.name}</strong><span>{l.pct}% of code in your public repositories</span></>)}
                                        onMouseLeave={hideTip}
                                    />
                                ))}
                            </div>
                            <ul className="ps-lang-key">
                                {github.languages.map((l, i) => (
                                    <li key={l.name}><i className="ps-sw" style={{ '--c': colorFor(l.name, i) }} />{l.name} <b>{l.pct}%</b></li>
                                ))}
                            </ul>
                        </>
                    )}

                    <div className="ps-gh-block">
                        <p className="ps-label">Counted as skill evidence</p>
                        {evidence.length > 0 ? (
                            <ul className="ps-evidence">
                                {evidence.map(n => {
                                    const before = n.weight >= 1.5 ? 'missing' : 'weak';
                                    const found = github.skills.find(s => n.via.some(v => v.toLowerCase() === s.name.toLowerCase()));
                                    return (
                                        <li key={n.name}>
                                            <div><strong style={{ fontWeight: 600 }}>{n.name}</strong><br /><span className="ps-muted" style={{ fontSize: 12.5 }}>{found ? found.evidence : 'Found in your repositories'}</span></div>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                                                <i className="ps-sw ring" style={{ '--c': SKILL_STATUS[before].hex }} />{SKILL_STATUS[before].label}
                                                <ArrowRight size={12} aria-hidden="true" />
                                                <i className="ps-sw" style={{ '--c': SKILL_STATUS[n.status].hex }} />{SKILL_STATUS[n.status].label}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : github.skills.length > 0 ? (
                            <>
                                <p className="ps-muted" style={{ marginBottom: 8 }}>None of your target role's gaps appear in your repositories yet. Skills found:</p>
                                <div className="ps-chips">{github.skills.slice(0, 10).map(s => <span key={s.name} className="ps-chip" title={s.evidence}>{s.name}</span>)}</div>
                            </>
                        ) : (
                            <p className="ps-muted">No recognisable skills found in your public repositories.</p>
                        )}
                    </div>

                    {github.top_repos.length > 0 && (
                        <div className="ps-gh-block">
                            <p className="ps-label">Top repositories</p>
                            {github.top_repos.map(r => (
                                <div className="ps-repo" key={r.name}>
                                    <a href={r.url} target="_blank" rel="noopener noreferrer">{r.name}</a>
                                    {r.description && <p>{r.description}</p>}
                                    <span>{r.language || 'No language'} · <Star size={12} fill="currentColor" aria-hidden="true" /> {r.stars}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </article>
    );
};
