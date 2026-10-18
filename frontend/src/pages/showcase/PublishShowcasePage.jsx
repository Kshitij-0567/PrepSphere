import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '../../api/client';
import { useApp } from '../../components/layout/appContext';
import { useFeedback } from '../../components/ui/feedbackContext';
import ResumeView from './ResumeView';
import { CountrySelect, ShowcaseHeadline } from './ShowcaseParts';
import { SENIORITIES, useCountries } from './showcaseData';
import './showcase.css';

const SWITCHES = [
    { key: 'show_name', title: 'Show my name', text: 'Otherwise you are listed under your anonymous name.' },
    { key: 'show_country', title: 'Show my country', text: 'Lets people find you in country rankings.' },
    { key: 'show_institutions', title: 'Show college names', text: 'Degrees, years and grades are always shown.' },
    { key: 'show_companies', title: 'Show company names', text: 'Job titles, dates and work details are always shown.' },
];

const ALWAYS_HIDDEN = ['Email address and phone number', 'LinkedIn, GitHub, portfolio and other links', 'Street address and city', 'Your original resume file'];

const PublishShowcasePage = () => {
    const navigate = useNavigate();
    const { setUser } = useApp();
    const { toast } = useFeedback();
    const countries = useCountries();
    const [roles, setRoles] = useState([]);
    const [mine, setMine] = useState(null);
    const [options, setOptions] = useState(null);
    const [country, setCountry] = useState('');
    const [preview, setPreview] = useState(null);
    const [stale, setStale] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([api.get('/roles'), api.get('/showcase/me')])
            .then(([rolesRes, mineRes]) => {
                if (cancelled) return;
                setRoles(rolesRes.data);
                setMine(mineRes.data);
                setOptions(mineRes.data.options);
                setCountry(mineRes.data.country?.code || '');
            })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load your showcase settings.')); });
        return () => { cancelled = true; };
    }, []);

    // Rebuild the preview shortly after the options settle.
    const canPublish = Boolean(mine && !mine.blocked_reason);
    useEffect(() => {
        if (!options || !canPublish) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            api.post('/showcase/preview', options)
                .then(res => { if (!cancelled) { setPreview(res.data); setStale(false); setPreviewError(''); } })
                .catch(err => { if (!cancelled) setPreviewError(apiErrorMessage(err, 'Could not build the preview.')); });
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [options, country, canPublish]);

    const update = (patch) => {
        setOptions(o => ({ ...o, ...patch }));
        setStale(true);
        setConfirmed(false);
    };

    const saveCountry = async (code) => {
        const previous = country;
        setCountry(code || '');
        setStale(true);
        setConfirmed(false);
        try {
            const res = await api.patch('/users/me', { country: code || '' });
            setUser(res.data);
        } catch (err) {
            setCountry(previous);
            toast(apiErrorMessage(err, 'Could not save your country.'), { error: true });
        }
    };

    const publish = async () => {
        setPublishing(true);
        setError('');
        try {
            const res = await api.put('/showcase', { ...options, confirm: true });
            toast(mine.showcase ? 'Your showcase resume was updated.' : 'Your resume is now in the showcase.');
            navigate(`/showcase/${res.data.public_id}`);
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not publish your resume.'));
            setPublishing(false);
        }
    };

    if (error && !mine) return <div className="ps-page"><div className="ps-banner ps-banner-error" role="alert">{error}</div></div>;
    if (!mine || !options) return <div className="ps-page"><div className="ps-skeleton" style={{ height: 420 }} aria-label="Loading" /></div>;

    if (mine.blocked_reason) {
        return (
            <div className="ps-page">
                <Link className="sc-back" to="/showcase"><ArrowLeft size={15} aria-hidden="true" /> Resume showcase</Link>
                <article className="ps-card">
                    <div className="ps-empty">
                        <strong>{mine.blocked_reason === 'demo' ? 'Demo accounts cannot publish' : 'Upload a resume first'}</strong>
                        <span>{mine.blocked_reason === 'demo'
                            ? 'Create a free account to add your resume to the showcase.'
                            : 'The showcase publishes your active resume, and you do not have one yet.'}</span>
                        {mine.blocked_reason === 'no_resume' && <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/resumes')}>Upload resume</button>}
                    </div>
                </article>
            </div>
        );
    }

    return (
        <div className="ps-page">
            <Link className="sc-back" to="/showcase"><ArrowLeft size={15} aria-hidden="true" /> Resume showcase</Link>
            <div className="ps-split">
                <article className="ps-card" aria-labelledby="sc-pub-title">
                    <div className="ps-card-head">
                        <div>
                            <h2 className="ps-card-title" id="sc-pub-title">{mine.showcase ? 'Update your showcase resume' : 'Publish your resume'}</h2>
                            <p className="ps-card-sub">
                                Publishes a copy of <b>{mine.active_resume.filename}</b>, your active resume. You will be listed as <b>{mine.handle}</b> unless you show your name.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div className="ps-two-col" style={{ gap: 14 }}>
                            <div className="ps-field">
                                <label htmlFor="sc-pub-role">Rank me for</label>
                                <select id="sc-pub-role" className="ps-input" value={options.role_id} onChange={(e) => update({ role_id: Number(e.target.value) })}>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="ps-field">
                                <label htmlFor="sc-pub-level">Level</label>
                                <select id="sc-pub-level" className="ps-input" value={options.seniority} onChange={(e) => update({ seniority: e.target.value })}>
                                    {SENIORITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="ps-field">
                            <label htmlFor="sc-pub-country">Country</label>
                            <CountrySelect id="sc-pub-country" countries={countries} value={country} onChange={saveCountry} emptyLabel="Not set" />
                            <p className="ps-help">
                                Saved to your profile and also used for benchmarks.
                                {!country && mine.suggested_country && (
                                    <> Your resume suggests {mine.suggested_country.name}. <button type="button" className="ps-btn ps-btn-sm ps-btn-ghost" onClick={() => saveCountry(mine.suggested_country.code)}>Use it</button></>
                                )}
                            </p>
                        </div>

                        <div className="sc-switches">
                            {SWITCHES.map(s => (
                                <label key={s.key} className="sc-switch" htmlFor={`sc-pub-${s.key}`}>
                                    <span><strong>{s.title}</strong><span>{s.text}</span></span>
                                    <input id={`sc-pub-${s.key}`} type="checkbox" role="switch" checked={Boolean(options[s.key])}
                                        onChange={(e) => update({ [s.key]: e.target.checked })} />
                                </label>
                            ))}
                        </div>

                        <div>
                            <p className="ps-label">Always hidden</p>
                            <ul className="sc-always">
                                {ALWAYS_HIDDEN.map(item => <li key={item}><Check size={14} aria-hidden="true" />{item}</li>)}
                            </ul>
                        </div>

                        <p className="ps-help">
                            Your role readiness and mock interview average for this role are shown and stay up to date. You can update or remove the resume at any time from the showcase page.
                        </p>

                        <label className="sc-confirm" htmlFor="sc-pub-confirm">
                            <input id="sc-pub-confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={!preview || stale} />
                            <span>I checked the preview and want other PrepSphere users to see it.</span>
                        </label>

                        {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}

                        <div className="ps-link-actions">
                            <button className="ps-btn ps-btn-primary" type="button" onClick={publish} disabled={!confirmed || publishing || !preview || stale}>
                                {publishing && <Loader2 size={14} className="ps-spin" aria-hidden="true" />}
                                {mine.showcase ? 'Publish changes' : 'Publish'}
                            </button>
                            <Link className="ps-btn ps-btn-ghost" to="/showcase">Cancel</Link>
                        </div>
                    </div>
                </article>

                <article className="ps-card sc-preview" aria-labelledby="sc-prev-title" aria-busy={!preview}>
                    <p className="ps-label" id="sc-prev-title">Preview: what other users see</p>
                    {previewError && <div className="ps-banner ps-banner-error" role="alert">{previewError}</div>}
                    {!preview && !previewError && <div className="ps-skeleton" style={{ height: 360 }} />}
                    {preview && (
                        <div style={{ opacity: stale ? 0.55 : 1, transition: 'opacity .2s' }}>
                            <ShowcaseHeadline entry={preview} />
                            <ResumeView entry={preview} />
                        </div>
                    )}
                </article>
            </div>
        </div>
    );
};

export default PublishShowcasePage;
