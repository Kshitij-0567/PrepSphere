import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Search } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import CompanyLogo from './dashboard/CompanyLogo';
import { formatInterviewRounds, formatPrepTips, formatWhatCompanyWants } from './dashboard/format';
import './Dashboard.css';

const PAGE_SIZE = 48;

const CompanyDetail = ({ company, onPractice }) => (
    <article className="ps-card" aria-labelledby="ps-co-title" style={{ position: 'sticky', top: 20 }}>
        <div className="ps-company-top" style={{ marginBottom: 14 }}>
            <CompanyLogo company={company} size={44} />
            <div>
                <h2 className="ps-card-title" id="ps-co-title">{company.name}</h2>
                <span>{company.tier} · {company.industry}{company.headquarters ? ` · ${company.headquarters}` : ''}</span>
            </div>
        </div>
        <div className="ps-badges" style={{ marginBottom: 14 }}>
            <span className="ps-badge">{company.difficulty_level} interviews</span>
            {company.domain && <a className="ps-badge ps-badge-quiet" href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer">{company.domain}</a>}
        </div>
        {company.description && <p style={{ color: 'var(--ink-2)', fontSize: 13, marginBottom: 16 }}>{company.description}</p>}

        <p className="ps-label">What they look for</p>
        <ul className="ps-detail-list" style={{ marginBottom: 18 }}>
            {formatWhatCompanyWants(company.what_company_wants, company.name).map((item, i) => (
                <li key={i}><CheckCircle2 size={14} aria-hidden="true" /><span>{item}</span></li>
            ))}
        </ul>

        <p className="ps-label">Interview rounds</p>
        <ol className="ps-detail-list" style={{ marginBottom: 18, listStyle: 'none' }}>
            {formatInterviewRounds(company.interview_rounds).map((r, i) => (
                <li key={i} style={{ gridTemplateColumns: '70px minmax(0, 1fr)' }}>
                    <span className="ps-src" style={{ paddingTop: 2 }}>{r.stage}</span>
                    <span>{r.title}</span>
                </li>
            ))}
        </ol>

        {company.common_topics?.length > 0 && (
            <>
                <p className="ps-label">Common topics</p>
                <div className="ps-chips" style={{ marginBottom: 18 }}>
                    {company.common_topics.map(t => <span key={t} className="ps-chip">{t}</span>)}
                </div>
            </>
        )}

        <p className="ps-label">Preparation tips</p>
        <ul className="ps-detail-list" style={{ marginBottom: 20 }}>
            {formatPrepTips(company.prep_tips).map((tip, i) => (
                <li key={i}><CheckCircle2 size={14} aria-hidden="true" /><span>{tip}</span></li>
            ))}
        </ul>

        <button className="ps-btn ps-btn-primary" type="button" onClick={() => onPractice(company)}>Practice for {company.name}</button>
    </article>
);

const CompaniesPage = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [tier, setTier] = useState('All');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [selectedId, setSelectedId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get('/companies')
            .then(res => { if (!cancelled) setCompanies(res.data); })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load companies.')); });
        return () => { cancelled = true; };
    }, []);

    const tiers = useMemo(() => {
        const counts = {};
        (companies || []).forEach(c => { counts[c.tier] = (counts[c.tier] || 0) + 1; });
        return ['All', ...Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([t]) => t)];
    }, [companies]);

    const q = query.trim().toLowerCase();
    const filtered = (companies || []).filter(c =>
        (tier === 'All' || c.tier === tier) &&
        (!q || c.name.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q) ||
            c.common_topics?.some(t => t.toLowerCase().includes(q)) || c.interview_focus?.some(t => t.toLowerCase().includes(q))));
    const selected = companies?.find(c => c.id === selectedId) || filtered[0] || null;

    const practice = (company) => navigate('/dashboard', { state: { companyId: company.id } });

    return (
        <div className="ps-page">
            <div className="ps-toolbar">
                <div className="ps-search">
                    <Search size={16} aria-hidden="true" />
                    <label htmlFor="ps-company-search" className="ps-sr-only">Search companies</label>
                    <input
                        id="ps-company-search"
                        className="ps-input"
                        type="search"
                        placeholder="Search by company, industry or topic"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
                    />
                </div>
            </div>
            <div className="ps-filters" style={{ padding: 0, border: 0 }} role="group" aria-label="Filter by tier">
                {tiers.map(t => (
                    <button key={t} type="button" className="ps-fchip" aria-pressed={tier === t} onClick={() => { setTier(t); setLimit(PAGE_SIZE); }}>{t}</button>
                ))}
            </div>
            {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
            {!companies && !error && <div className="ps-skeleton" style={{ height: 300 }} />}
            {companies && (
                <div className="ps-split">
                    <div>
                        <p className="ps-muted" style={{ marginBottom: 10, fontSize: 12.5 }}>{filtered.length} companies</p>
                        {filtered.length === 0 ? (
                            <p className="ps-muted">No companies match that search.</p>
                        ) : (
                            <div className="ps-company-grid">
                                {filtered.slice(0, limit).map(c => (
                                    <button key={c.id} type="button" className="ps-company-card" aria-pressed={selected?.id === c.id} onClick={() => setSelectedId(c.id)}>
                                        <span className="ps-company-top">
                                            <CompanyLogo company={c} size={34} />
                                            <span style={{ minWidth: 0 }}>
                                                <strong>{c.name}</strong>
                                                <span>{c.tier} · {c.difficulty_level}</span>
                                            </span>
                                        </span>
                                        <span className="ps-muted" style={{ fontSize: 12 }}>{(c.interview_focus || []).slice(0, 3).join(' · ')}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {filtered.length > limit && (
                            <button className="ps-btn ps-btn-sm" type="button" style={{ marginTop: 12 }} onClick={() => setLimit(l => l + PAGE_SIZE)}>
                                Show more ({filtered.length - limit} left)
                            </button>
                        )}
                    </div>
                    {selected && <CompanyDetail company={selected} onPractice={practice} />}
                </div>
            )}
        </div>
    );
};

export default CompaniesPage;
