import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import api, { apiErrorMessage } from '../../api/client';
import { useFeedback } from '../../components/ui/feedbackContext';
import { relativeTime } from '../../utils/format';
import { CountrySelect } from './ShowcaseParts';
import { SENIORITIES, plural, useCountries } from './showcaseData';
import './showcase.css';

const PAGE = 50;

/** The signed-in user's own showcase entry, or how to create one. */
const MyShowcase = ({ mine, onRemoved }) => {
    const navigate = useNavigate();
    const { toast } = useFeedback();
    const [confirming, setConfirming] = useState(false);
    const [removing, setRemoving] = useState(false);

    const remove = async () => {
        setRemoving(true);
        try {
            await api.delete('/showcase');
            toast('Your resume was removed from the showcase.');
            setConfirming(false);
            onRemoved();
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not remove your resume.'), { error: true });
        }
        setRemoving(false);
    };

    if (!mine) return <div className="ps-skeleton" style={{ height: 96 }} />;
    const entry = mine.showcase;

    if (!entry) {
        const blocked = mine.blocked_reason;
        return (
            <article className="ps-card sc-mine" aria-labelledby="sc-mine-title">
                <div>
                    <h2 className="ps-card-title" id="sc-mine-title">Add your resume to the showcase</h2>
                    <p className="ps-card-sub">
                        {blocked === 'demo'
                            ? 'Demo accounts can browse the showcase but cannot publish. Create a free account to add your resume.'
                            : 'Others see a copy without your name, contact details or links, listed under an anonymous name. You choose what else to show, and you can remove it at any time.'}
                    </p>
                </div>
                {blocked === 'no_resume' && <button className="ps-btn" type="button" onClick={() => navigate('/resumes')}>Upload a resume first</button>}
                {!blocked && <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/showcase/publish')}>Publish your resume</button>}
            </article>
        );
    }

    return (
        <article className="ps-card" aria-labelledby="sc-mine-title">
            <div className="sc-mine">
                <div>
                    <h2 className="ps-card-title" id="sc-mine-title">{entry.hidden ? 'Your resume is hidden' : 'Your resume is published'}</h2>
                    <div className="sc-mine-meta">
                        <span>Listed as <b>{entry.name}</b></span>
                        <span>{entry.role.name}</span>
                        {entry.rank && <span>Rank <b>#{entry.rank}</b> of {entry.total}</span>}
                        <span>Score <b>{Math.round(entry.score)}</b></span>
                    </div>
                </div>
                <div className="ps-list-actions">
                    {confirming ? (
                        <>
                            <span className="ps-muted">Remove it for everyone?</span>
                            <button className="ps-btn ps-btn-sm" type="button" onClick={() => setConfirming(false)}>Cancel</button>
                            <button className="ps-btn ps-btn-sm ps-btn-danger" type="button" onClick={remove} disabled={removing}>
                                {removing && <Loader2 size={13} className="ps-spin" aria-hidden="true" />} Remove
                            </button>
                        </>
                    ) : (
                        <>
                            <Link className="ps-btn ps-btn-sm" to={`/showcase/${entry.public_id}`}>View</Link>
                            <Link className="ps-btn ps-btn-sm" to="/showcase/publish">Update</Link>
                            <button className="ps-btn ps-btn-sm ps-btn-danger" type="button" onClick={() => setConfirming(true)}>
                                <Trash2 size={13} aria-hidden="true" /> Remove
                            </button>
                        </>
                    )}
                </div>
            </div>
            {entry.hidden && (
                <div className="ps-banner ps-banner-error" style={{ marginTop: 14 }}>
                    <span>Other users reported this resume, so it is hidden. Check what it shows, change it, and publish again.</span>
                </div>
            )}
            {!entry.hidden && mine.outdated && (
                <div className="ps-banner ps-banner-warn" style={{ marginTop: 14 }}>
                    <span>Your active resume changed after you published. The showcase still shows the older one.</span>
                    <Link className="ps-btn ps-btn-sm" to="/showcase/publish">Update</Link>
                </div>
            )}
        </article>
    );
};

const ShowcasePage = () => {
    const [params, setParams] = useSearchParams();
    const countries = useCountries();
    const [roles, setRoles] = useState([]);
    const [mine, setMine] = useState(null);
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const roleParam = params.get('role');
    const country = params.get('country');
    const level = params.get('level');

    const loadMine = useCallback(() => api.get('/showcase/me').then(res => setMine(res.data)).catch(() => setMine(null)), []);

    useEffect(() => {
        let cancelled = false;
        api.get('/roles').then(res => { if (!cancelled) setRoles(res.data); }).catch(() => { /* shown once it loads */ });
        api.get('/showcase/me').then(res => { if (!cancelled) setMine(res.data); }).catch(() => { /* the card stays a placeholder */ });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const query = { limit: PAGE };
        if (roleParam) query.role_id = roleParam;
        if (country) query.country = country;
        if (level) query.seniority = level;
        api.get('/showcase', { params: query })
            .then(res => { if (!cancelled) { setBoard(res.data); setError(''); setLoading(false); } })
            .catch(err => { if (!cancelled) { setError(apiErrorMessage(err, 'Could not load the showcase.')); setLoading(false); } });
        return () => { cancelled = true; };
    }, [roleParam, country, level, refresh]);

    const setFilter = (key, value) => {
        if ((params.get(key) || null) === (value || null)) return;
        setLoading(true);
        const next = new URLSearchParams(params);
        if (key !== 'role' && !next.get('role') && board) next.set('role', board.role.id);
        if (value) next.set(key, value); else next.delete(key);
        setParams(next, { replace: true });
    };

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const query = { role_id: board.role.id, offset: board.entries.length, limit: PAGE };
            if (country) query.country = country;
            if (level) query.seniority = level;
            const res = await api.get('/showcase', { params: query });
            setBoard(b => ({ ...b, entries: [...b.entries, ...res.data.entries] }));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load more resumes.'));
        }
        setLoadingMore(false);
    };

    const onRemoved = () => {
        loadMine();
        setLoading(true);
        setRefresh(n => n + 1);
    };

    const counts = board?.role_counts || {};
    const otherRoles = roles.filter(r => counts[r.id] && r.id !== board?.role.id);
    const youOffPage = board?.you && !board.entries.some(e => e.is_you);

    return (
        <div className="ps-page">
            <MyShowcase mine={mine} onRemoved={onRemoved} />

            <article className="ps-card" aria-labelledby="sc-board-title">
                <div className="sc-filters" style={{ marginBottom: 20 }}>
                    <div className="ps-field">
                        <label htmlFor="sc-role">Role</label>
                        <select id="sc-role" className="ps-input" value={board?.role.id || ''} onChange={(e) => setFilter('role', e.target.value)}>
                            {!roles.length && board && <option value={board.role.id}>{board.role.name}</option>}
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}{counts[r.id] ? ` (${counts[r.id]})` : ''}</option>)}
                        </select>
                    </div>
                    <div className="ps-field">
                        <label htmlFor="sc-country">Country</label>
                        <CountrySelect id="sc-country" countries={countries} value={country} onChange={code => setFilter('country', code)}
                            emptyLabel="All countries" counts={board?.countries} />
                    </div>
                    <div className="ps-seg" role="group" aria-label="Level">
                        <button type="button" aria-pressed={!level} onClick={() => setFilter('level', null)}>All levels</button>
                        {SENIORITIES.map(s => <button key={s} type="button" aria-pressed={level === s} onClick={() => setFilter('level', s)}>{s}</button>)}
                    </div>
                </div>

                {error && <div className="ps-banner ps-banner-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
                {!board && !error && <div className="ps-skeleton" style={{ height: 260 }} aria-label="Loading the showcase" />}

                {board && (
                    <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
                        <div className="ps-card-head">
                            <div>
                                <h2 className="ps-card-title" id="sc-board-title">
                                    {plural(board.total, 'resume')} for {board.role.name}{board.country ? ` in ${board.country.name}` : ''}{board.seniority ? ` · ${board.seniority}` : ''}
                                </h2>
                                <p className="ps-card-sub">Ranked by candidate score: 60% role readiness and 40% mock interview average for the role. Open a resume to read it or compare it with yours.</p>
                            </div>
                        </div>

                        {youOffPage && (
                            <div className="ps-banner ps-banner-info" style={{ marginBottom: 12 }}>
                                <span>You are <b>#{board.you.rank}</b> of {board.total} with a score of {Math.round(board.you.score)}.</span>
                            </div>
                        )}

                        {board.entries.length === 0 ? (
                            <div className="ps-empty">
                                <strong>No published resumes match yet</strong>
                                <span>Be the first to publish one for {board.role.name}{board.country ? ` in ${board.country.name}` : ''}, or try another filter.</span>
                                {otherRoles.length > 0 && (
                                    <div className="ps-chips" aria-label="Roles with published resumes">
                                        {otherRoles.slice(0, 6).map(r => (
                                            <button key={r.id} type="button" className="ps-fchip" onClick={() => setFilter('role', String(r.id))}>
                                                {r.name} <span className="n">{counts[r.id]}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <ol className="sc-board">
                                {board.entries.map(e => (
                                    <li key={e.public_id}>
                                        <Link className={`sc-row ${e.is_you ? 'is-you' : ''}`} to={`/showcase/${e.public_id}`}>
                                            <span className={`sc-rank ${e.rank <= 3 ? 'is-podium' : ''}`}><span className="ps-sr-only">Rank </span>{e.rank}</span>
                                            <div className="sc-who">
                                                <div className="sc-who-top">
                                                    <strong>{e.name}</strong>
                                                    {e.is_you && <span className="sc-tag sc-tag-you">You</span>}
                                                    {e.anonymous && !e.is_you && <span className="sc-tag">Anonymous</span>}
                                                </div>
                                                <span className="sc-who-meta">{[e.country?.name, e.seniority, e.updated_at && `updated ${relativeTime(e.updated_at)}`].filter(Boolean).join(' · ')}</span>
                                                {e.top_skills.length > 0 && <div className="ps-chips">{e.top_skills.map(s => <span key={s} className="ps-chip">{s}</span>)}</div>}
                                            </div>
                                            <div className="sc-stats">
                                                <span className="sc-stat"><b>{Math.round(e.readiness)}<small>%</small></b>Readiness</span>
                                                <span className="sc-stat"><b>{e.interview != null ? e.interview.toFixed(1) : '–'}{e.interview != null && <small>/10</small>}</b>Interviews</span>
                                                <span className="sc-stat"><b>{e.projects}</b>Projects</span>
                                            </div>
                                            <span className="sc-score"><b>{Math.round(e.score)}</b><span>score</span></span>
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                        )}

                        {board.entries.length < board.total && (
                            <div className="sc-more">
                                <button className="ps-btn" type="button" onClick={loadMore} disabled={loadingMore}>
                                    {loadingMore && <Loader2 size={14} className="ps-spin" aria-hidden="true" />}
                                    Show more ({board.total - board.entries.length} left)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </article>
        </div>
    );
};

export default ShowcasePage;
