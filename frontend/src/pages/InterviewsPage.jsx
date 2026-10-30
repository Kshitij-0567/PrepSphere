import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import InterviewRow, { ScoreKey } from '../components/InterviewRow';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'video', label: 'Video' },
];

const matches = (item, key) => key === 'all'
    || (key === 'video' ? item.mode === 'video' : key === 'completed' ? item.status === 'completed' : item.status !== 'completed');

// Adapts a history entry to the shape InterviewRow expects.
function toRow(item) {
    const scores = item.scores || [];
    const questions = Array.from({ length: item.total_questions }, (_, i) => ({
        score: scores[i] ?? null,
        topic: null,
        approx: false,
    }));
    const live = item.status !== 'completed';
    return {
        id: item.id,
        mode: item.mode || 'text',
        role: item.role_name,
        company: item.company_name,
        seniority: item.seniority || 'Mid',
        date: item.started_at ? `${item.started_at}Z`.replace('ZZ', 'Z') : null,
        status: item.status,
        overall: item.overall_score,
        answered: item.questions_answered,
        total: item.total_questions,
        current_index: live ? Math.min(item.questions_answered, item.total_questions - 1) : null,
        questions,
    };
}

const InterviewsPage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        let cancelled = false;
        api.get('/interviews/history')
            .then(res => { if (!cancelled) setItems(res.data.map(toRow)); })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load your interviews.')); });
        return () => { cancelled = true; };
    }, []);

    const shown = (items || []).filter(i => matches(i, filter));
    const count = key => (items || []).filter(i => matches(i, key)).length;

    return (
        <div className="ps-page">
            <article className="ps-card" aria-labelledby="ps-int-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="ps-int-title">Your interviews</h2>
                        <p className="ps-card-sub">Resume an unfinished interview or open the results of a finished one.</p>
                    </div>
                    <ScoreKey />
                </div>
                {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
                {!items && !error && <div className="ps-skeleton" style={{ height: 180 }} />}
                {items && items.length === 0 && (
                    <div className="ps-empty">
                        <strong>No interviews yet</strong>
                        <span>Pick a role in the Workspace to take your first mock interview.</span>
                        <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/dashboard')}>Start mock interview</button>
                    </div>
                )}
                {items && items.length > 0 && (
                    <>
                        <div className="ps-filters" style={{ padding: '0 0 16px', border: 0 }} role="group" aria-label="Filter interviews">
                            {FILTERS.map(f => (
                                <button key={f.key} type="button" className="ps-fchip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                                    {f.label}<span className="n">{count(f.key)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="ps-sessions">
                            {shown.map(item => <InterviewRow key={item.id} interview={item} />)}
                        </div>
                        {shown.length === 0 && <p className="ps-muted">No interviews in this group.</p>}
                    </>
                )}
            </article>
        </div>
    );
};

export default InterviewsPage;
