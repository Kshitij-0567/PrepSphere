import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '../../api/client';
import { useApp } from '../../components/layout/appContext';
import { useFeedback } from '../../components/ui/feedbackContext';
import ScoreChart from './ScoreChart';
import { CountrySelect, Delta, MetricValue } from './ShowcaseParts';
import { METRICS, ordinal, plural, useCountries } from './showcaseData';
import './showcase.css';

const byKey = Object.fromEntries(METRICS.map(m => [m.key, m]));

const Tile = ({ label, metric, value, children }) => (
    <div className="ps-tile">
        <span className="ps-tile-label">{label}</span>
        <span className="ps-tile-value bm-tile-value"><MetricValue metric={metric} value={value} /></span>
        <span className="bm-tile-sub">{children}</span>
    </div>
);

/** Prompts for the user's country, preselecting the one their resume suggests. */
const CountryPrompt = ({ countries, suggested, onSave }) => {
    const [code, setCode] = useState(suggested?.code || '');
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        await onSave(code);
        setSaving(false);
    };
    return (
        <div className="ps-banner ps-banner-info" style={{ marginTop: 16 }}>
            <div className="bm-country-prompt">
                <span>{suggested ? `Your resume suggests ${suggested.name}. Confirm your country` : 'Add your country'} to see how you rank near you.</span>
                <label htmlFor="bm-my-country" className="ps-sr-only">Your country</label>
                <CountrySelect id="bm-my-country" countries={countries} value={code} onChange={c => setCode(c || '')} emptyLabel="Choose a country" />
                <button className="ps-btn ps-btn-sm ps-btn-primary" type="button" onClick={save} disabled={!code || saving}>
                    {saving && <Loader2 size={13} className="ps-spin" aria-hidden="true" />} Save
                </button>
            </div>
        </div>
    );
};

const BenchmarksPage = () => {
    const navigate = useNavigate();
    const { setUser } = useApp();
    const { toast } = useFeedback();
    const countries = useCountries();
    const [roles, setRoles] = useState([]);
    const [query, setQuery] = useState({ roleId: null, country: null });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.get('/roles').then(res => { if (!cancelled) setRoles(res.data); }).catch(() => { /* the role list is shown once it loads */ });
        return () => { cancelled = true; };
    }, []);

    // With no role chosen yet, the server picks the role of the latest interview.
    useEffect(() => {
        let cancelled = false;
        const params = {};
        if (query.roleId) params.role_id = query.roleId;
        if (query.country) params.country = query.country;
        api.get('/benchmarks', { params })
            .then(res => { if (!cancelled) { setData(res.data); setError(''); setLoading(false); } })
            .catch(err => { if (!cancelled) { setError(apiErrorMessage(err, 'Could not load benchmarks.')); setLoading(false); } });
        return () => { cancelled = true; };
    }, [query]);

    const change = (patch) => {
        setLoading(true);
        setQuery(q => ({ ...q, ...patch }));
    };

    const saveCountry = async (code) => {
        try {
            const res = await api.patch('/users/me', { country: code });
            setUser(res.data);
            toast('Country saved. It is also used for the resume showcase.');
            change({});
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not save your country.'), { error: true });
        }
    };

    const you = data?.you;
    const pct = data?.percentiles;
    const where = data?.scope ? `in ${data.scope.name}` : 'worldwide';
    const roleName = data?.role.name;
    // "top 10% (12 candidates)", or "top 3 candidates" when the group is the minimum size.
    const topGroup = data?.top && (data.top.label === 'Top 10%'
        ? `top 10% (${plural(data.top.size, 'candidate')})`
        : `top ${plural(data.top.size, 'candidate')}`);

    return (
        <div className="ps-page">
            <article className="ps-card" aria-labelledby="bm-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="bm-title">See where you stand</h2>
                        <p className="ps-card-sub">Compared with everyone on PrepSphere preparing for the same role. Only totals and averages are shown here, never anyone's resume.</p>
                    </div>
                </div>
                <div className="bm-controls">
                    <div className="ps-field">
                        <label htmlFor="bm-role">Role</label>
                        <select id="bm-role" className="ps-input" value={data?.role.id || ''} onChange={(e) => change({ roleId: Number(e.target.value) })}>
                            {!roles.length && data && <option value={data.role.id}>{data.role.name}</option>}
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="ps-field">
                        <label htmlFor="bm-scope">Compare with</label>
                        <CountrySelect id="bm-scope" countries={countries} value={query.country} onChange={code => change({ country: code })}
                            emptyLabel="Candidates worldwide" counts={data?.countries} />
                    </div>
                </div>
                {data && !data.your_country && (
                    <CountryPrompt key={data.suggested_country?.code || 'none'} countries={countries} suggested={data.suggested_country} onSave={saveCountry} />
                )}
            </article>

            {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
            {data && !data.has_resume && (
                <div className="ps-banner ps-banner-warn">
                    <span>Upload a resume to see your own numbers next to everyone else's.</span>
                    <button className="ps-btn ps-btn-sm" type="button" onClick={() => navigate('/resumes')}>Upload resume</button>
                </div>
            )}

            {!data && !error && <div className="ps-skeleton" style={{ height: 320 }} aria-label="Loading benchmarks" />}

            {data && (
                <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="ps-tiles">
                        <Tile label="Candidate score" metric={byKey.score} value={you?.score}>
                            {pct?.score != null ? <><b>{ordinal(pct.score)}</b> percentile among {plural(data.cohort_size, 'candidate')} {where}</> : '60% readiness + 40% mock interviews'}
                        </Tile>
                        <Tile label="Role readiness" metric={byKey.readiness} value={you?.readiness}>
                            {pct?.readiness != null ? <><b>{ordinal(pct.readiness)}</b> percentile {where}</> : 'Required skills your profile covers, by weight'}
                        </Tile>
                        <Tile label="Mock interview average" metric={byKey.interview} value={you?.interview}>
                            {you && you.interview == null
                                ? <>No completed interview for this role yet. <Link to="/dashboard" state={{ roleId: data.role.id }}>Practice now</Link></>
                                : pct?.interview != null
                                    ? <><b>{ordinal(pct.interview)}</b> percentile among {plural(pct.interview_candidates, 'candidate')} with one</>
                                    : 'Your latest 3 completed interviews for this role'}
                        </Tile>
                    </div>

                    {!data.enough ? (
                        <article className="ps-card" aria-labelledby="bm-wait">
                            <div className="ps-empty">
                                <strong id="bm-wait">Not enough candidates {where} yet</strong>
                                <span>
                                    Comparisons for {roleName} appear once {data.min_cohort} other candidates {where} are preparing for it, so no figure can point to one person.
                                    {' '}{data.cohort_size === 0 ? 'Nobody else is yet.' : `${plural(data.cohort_size, 'candidate is', 'candidates are')} so far.`}
                                </span>
                                <div className="ps-link-actions">
                                    {data.scope && <button className="ps-btn ps-btn-sm" type="button" onClick={() => change({ country: null })}>Compare worldwide</button>}
                                    <Link className="ps-btn ps-btn-sm" to={`/showcase?role=${data.role.id}`}>See published resumes</Link>
                                </div>
                            </div>
                        </article>
                    ) : (
                        <>
                            <div className="ps-split">
                                <article className="ps-card" aria-labelledby="bm-dist">
                                    <div className="ps-card-head">
                                        <div>
                                            <h2 className="ps-card-title" id="bm-dist">Where your score falls</h2>
                                            <p className="ps-card-sub">Candidate scores of {plural(data.cohort_size, 'candidate')} preparing for {roleName} {where}.</p>
                                        </div>
                                    </div>
                                    <ScoreChart buckets={data.distribution.buckets} you={data.distribution.you} roleName={roleName} />
                                </article>
                                <article className="ps-card" aria-labelledby="bm-skills">
                                    <div className="ps-card-head">
                                        <div>
                                            <h2 className="ps-card-title" id="bm-skills">Skills top candidates have</h2>
                                            <p className="ps-card-sub">Share of the {topGroup} by score who list each skill. Skills already on your profile are left out.</p>
                                        </div>
                                    </div>
                                    {data.skills_to_add.length === 0 ? (
                                        <p className="ps-muted">You already list every skill that most top candidates have.</p>
                                    ) : (
                                        <ul className="bm-skills">
                                            {data.skills_to_add.map(s => (
                                                <li key={s.name}>
                                                    <span className="bm-skill-name">{s.name}{s.required && <span className="ps-pill ps-pill-accent">Required</span>}</span>
                                                    <span className="bm-skill-pct">{s.share}%</span>
                                                    <div className="ps-meter" role="img" aria-label={`${s.share} percent of top candidates`}><i style={{ width: `${s.share}%` }} /></div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </article>
                            </div>

                            <article className="ps-card" aria-labelledby="bm-sections">
                                <div className="ps-card-head bm-head-wrap">
                                    <div>
                                        <h2 className="ps-card-title" id="bm-sections">Section by section</h2>
                                        <p className="ps-card-sub">Your resume next to the averages {where}. The badge shows the gap to the {topGroup}.</p>
                                    </div>
                                    <Link className="ps-btn ps-btn-sm" to={`/showcase?role=${data.role.id}`}>See published resumes</Link>
                                </div>
                                <div className="bm-table-wrap">
                                    <table className="bm-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Section</th>
                                                <th scope="col" className="num">You</th>
                                                <th scope="col" className="num">{data.top.label}</th>
                                                <th scope="col" className="num">Everyone</th>
                                                <th scope="col"><span className="ps-sr-only">Gap</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {METRICS.map(m => (
                                                <tr key={m.key}>
                                                    <td className="bm-metric"><strong>{m.label}</strong>{m.hint && <span>{m.hint}</span>}</td>
                                                    <td className="num is-you"><MetricValue metric={m} value={you?.[m.key]} /></td>
                                                    <td className="num"><MetricValue metric={m} value={data.top.averages[m.key]} /></td>
                                                    <td className="num"><MetricValue metric={m} value={data.everyone.averages[m.key]} /></td>
                                                    <td><Delta metric={m} value={you?.[m.key]} against={data.top.averages[m.key]} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        </>
                    )}

                    <p className="bm-note">
                        <strong>How this works.</strong> Candidates are people with an active resume who have started at least one mock interview for the role; demo accounts are left out.
                        The candidate score is 60% role readiness and 40% the average of the latest 3 completed mock interviews for the role, so a resume full of keywords cannot top it on its own.
                        Figures appear only when at least {data.min_cohort} candidates are in the group, and an average needs at least 3 people.
                    </p>
                </div>
            )}
        </div>
    );
};

export default BenchmarksPage;
