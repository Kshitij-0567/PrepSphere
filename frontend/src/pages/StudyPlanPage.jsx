import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { formatDateLong } from '../utils/format';

const PRIORITY_CLASS = { High: 'ps-p-high', Medium: 'ps-p-medium', Low: 'ps-p-low' };
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const asUtc = (value) => (value ? `${value}Z`.replace('ZZ', 'Z') : null);

const StudyPlanPage = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([api.get('/recommendations'), api.get('/interviews/history')])
            .then(([recsRes, historyRes]) => {
                if (cancelled) return;
                const interviews = Object.fromEntries(historyRes.data.map(i => [i.id, i]));
                const byInterview = new Map();
                recsRes.data.forEach(rec => {
                    const key = rec.interview_id && interviews[rec.interview_id] ? rec.interview_id : 'earlier';
                    if (!byInterview.has(key)) byInterview.set(key, []);
                    byInterview.get(key).push(rec);
                });
                const list = [...byInterview.entries()].map(([key, recs]) => {
                    const interview = interviews[key];
                    return {
                        key: String(key),
                        interview,
                        title: interview ? `${interview.role_name}${interview.company_name ? ` · ${interview.company_name}` : ''}` : 'Earlier recommendations',
                        date: interview ? asUtc(interview.completed_at || interview.started_at) : null,
                        recs: recs.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)),
                    };
                });
                list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                setGroups(list);
            })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load your study plan.')); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="ps-page">
            {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
            {!groups && !error && <div className="ps-skeleton" style={{ height: 220 }} />}
            {groups && groups.length === 0 && (
                <article className="ps-card">
                    <div className="ps-empty">
                        <strong>No study plan yet</strong>
                        <span>Finish a mock interview and PrepSphere will recommend what to study next.</span>
                        <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/dashboard')}>Start mock interview</button>
                    </div>
                </article>
            )}
            {groups && groups.map(group => (
                <article className="ps-card" key={group.key} aria-label={group.title}>
                    <div className="ps-card-head">
                        <div>
                            <h2 className="ps-card-title">{group.title}</h2>
                            <p className="ps-card-sub">
                                {group.date ? `Interview on ${formatDateLong(group.date)}` : 'From interviews before recommendations were linked to them'}
                                {group.interview?.overall_score != null && ` · scored ${group.interview.overall_score.toFixed(1)}`}
                            </p>
                        </div>
                        {group.interview && (
                            <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => navigate(`/interviews/${group.interview.id}`)}>Results</button>
                        )}
                    </div>
                    <ul className="ps-plan">
                        {group.recs.map(rec => (
                            <li key={rec.id} style={{ gridTemplateColumns: '70px minmax(0, 1fr)' }}>
                                <span className={`ps-prio ${PRIORITY_CLASS[rec.priority] || 'ps-p-medium'}`}><i />{rec.priority || 'Medium'}</span>
                                <div><strong>{rec.topic}</strong>{rec.reason && <p>{rec.reason}</p>}</div>
                            </li>
                        ))}
                    </ul>
                </article>
            ))}
        </div>
    );
};

export default StudyPlanPage;
