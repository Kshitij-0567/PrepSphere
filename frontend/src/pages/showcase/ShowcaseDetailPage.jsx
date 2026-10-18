import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Flag, Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '../../api/client';
import { useFeedback } from '../../components/ui/feedbackContext';
import { relativeTime } from '../../utils/format';
import CompareView from './CompareView';
import ResumeView from './ResumeView';
import './showcase.css';

const REASONS = [
    { value: 'personal_details', label: 'Shows personal details' },
    { value: 'offensive', label: 'Offensive or inappropriate' },
    { value: 'fake', label: 'Fake or spam' },
];

const ReportPanel = ({ publicId, onClose }) => {
    const { toast } = useFeedback();
    const [reason, setReason] = useState(REASONS[0].value);
    const [sending, setSending] = useState(false);
    const send = async () => {
        setSending(true);
        try {
            const res = await api.post(`/showcase/${publicId}/report`, { reason });
            toast(res.data.already_reported ? 'You already reported this resume.' : 'Thanks. Resumes reported by several people are hidden.');
            onClose();
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not send the report.'), { error: true });
            setSending(false);
        }
    };
    return (
        <div className="sc-report">
            <label htmlFor="sc-report-reason" className="ps-sr-only">Reason</label>
            <select id="sc-report-reason" className="ps-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button className="ps-btn ps-btn-sm ps-btn-danger" type="button" onClick={send} disabled={sending}>
                {sending && <Loader2 size={13} className="ps-spin" aria-hidden="true" />} Send report
            </button>
            <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
    );
};

const ShowcaseDetailPage = () => {
    const { publicId } = useParams();
    const [params, setParams] = useSearchParams();
    const [entry, setEntry] = useState(null);
    const [error, setError] = useState('');
    const [comparison, setComparison] = useState(null);
    const [compareError, setCompareError] = useState('');
    const [reporting, setReporting] = useState(false);
    const tab = params.get('tab') === 'compare' ? 'compare' : 'resume';

    useEffect(() => {
        let cancelled = false;
        api.get(`/showcase/${publicId}`)
            .then(res => { if (!cancelled) { setEntry(res.data); setError(''); } })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load this resume.')); });
        return () => { cancelled = true; };
    }, [publicId]);

    useEffect(() => {
        if (tab !== 'compare') return undefined;
        let cancelled = false;
        api.get(`/showcase/${publicId}/compare`)
            .then(res => { if (!cancelled) { setComparison({ id: publicId, data: res.data }); setCompareError(''); } })
            .catch(err => { if (!cancelled) setCompareError(apiErrorMessage(err, 'Could not compare the resumes.')); });
        return () => { cancelled = true; };
    }, [tab, publicId]);

    const showTab = (name) => setParams(name === 'compare' ? { tab: 'compare' } : {}, { replace: true });
    const current = comparison?.id === publicId ? comparison.data : null;

    const back = <Link className="sc-back" to={entry ? `/showcase?role=${entry.role.id}` : '/showcase'}><ArrowLeft size={15} aria-hidden="true" /> Resume showcase</Link>;

    if (error) {
        return (
            <div className="ps-page">
                {back}
                <article className="ps-card"><div className="ps-empty"><strong>Resume not available</strong><span>{error}</span></div></article>
            </div>
        );
    }
    if (!entry) return <div className="ps-page">{back}<div className="ps-skeleton" style={{ height: 420 }} aria-label="Loading resume" /></div>;

    return (
        <div className="ps-page">
            {back}
            <article className="ps-card" aria-labelledby="sc-detail-name">
                <div className="sc-hero">
                    <div>
                        <h2 id="sc-detail-name">{entry.name}</h2>
                        <div className="sc-hero-meta">
                            {entry.is_you && <span className="sc-tag sc-tag-you">You</span>}
                            {entry.anonymous && <span className="ps-badge ps-badge-quiet">Anonymous</span>}
                            <span className="ps-badge">{entry.role.name}</span>
                            <span className="ps-badge ps-badge-quiet">{entry.seniority}</span>
                            {entry.country && <span className="ps-badge ps-badge-quiet">{entry.country.name}</span>}
                        </div>
                        <p className="ps-card-sub" style={{ marginTop: 10 }}>
                            {entry.rank ? `Rank #${entry.rank} of ${entry.total} for ${entry.role.name}` : 'Not ranked while hidden'}
                            {entry.updated_at && ` · updated ${relativeTime(entry.updated_at)}`}
                        </p>
                    </div>
                    <div className="sc-hero-scores">
                        <span className="sc-stat"><b>{Math.round(entry.score)}<small>/100</small></b>Score</span>
                        <span className="sc-stat"><b>{Math.round(entry.readiness)}<small>%</small></b>Readiness</span>
                        <span className="sc-stat"><b>{entry.interview != null ? entry.interview.toFixed(1) : '–'}{entry.interview != null && <small>/10</small>}</b>Interviews</span>
                    </div>
                </div>

                {entry.hidden && (
                    <div className="ps-banner ps-banner-error" style={{ marginTop: 16 }}>
                        <span>Only you can see this. Other users reported it, so it is hidden from the showcase until you change it and publish again.</span>
                    </div>
                )}

                <div className="sc-hero-actions">
                    {entry.is_you ? (
                        <Link className="ps-btn ps-btn-sm ps-btn-primary" to="/showcase/publish">Update or remove</Link>
                    ) : (
                        <>
                            {tab !== 'compare' && <button className="ps-btn ps-btn-sm ps-btn-primary" type="button" onClick={() => showTab('compare')}>Compare with my resume</button>}
                            {!reporting && (
                                <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => setReporting(true)}>
                                    <Flag size={13} aria-hidden="true" /> Report
                                </button>
                            )}
                        </>
                    )}
                </div>
                {reporting && <ReportPanel publicId={publicId} onClose={() => setReporting(false)} />}
            </article>

            {!entry.is_you && (
                <div className="ps-seg" role="group" aria-label="View" style={{ alignSelf: 'flex-start' }}>
                    <button type="button" aria-pressed={tab === 'resume'} onClick={() => showTab('resume')}>Resume</button>
                    <button type="button" aria-pressed={tab === 'compare'} onClick={() => showTab('compare')}>Compare with mine</button>
                </div>
            )}

            {tab === 'resume' || entry.is_you ? (
                <article className="ps-card" aria-label="Resume">
                    <ResumeView entry={entry} />
                </article>
            ) : compareError ? (
                <div className="ps-banner ps-banner-error" role="alert">{compareError}</div>
            ) : current ? (
                <CompareView data={current} />
            ) : (
                <div className="ps-skeleton" style={{ height: 360 }} aria-label="Comparing" />
            )}
        </div>
    );
};

export default ShowcaseDetailPage;
