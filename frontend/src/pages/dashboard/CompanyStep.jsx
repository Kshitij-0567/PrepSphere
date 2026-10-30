import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowRight, Award, Briefcase, Building2, CheckCircle2, Code, ExternalLink, Globe, Layers,
    Search, Sparkle, Sparkles, Target
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { formatInterviewRounds, formatPrepTips, formatWhatCompanyWants } from './format';

const QUICK_PICKS = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Netflix', 'OpenAI', 'Stripe', 'Jane Street', 'Swiggy'];

const CompanyStep = ({ companies, selectedCompany, onSelectCompany, selectedRole, seniorityLevel, onContinue }) => {
    const [companySearchQuery, setCompanySearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [highlightSearch, setHighlightSearch] = useState(false);
    const searchInputRef = useRef(null);
    const highlightTimer = useRef(null);

    useEffect(() => () => clearTimeout(highlightTimer.current), []);

    // "Search more companies": bring the search box into view and draw attention to it.
    const focusSearch = () => {
        const input = searchInputRef.current;
        if (!input) return;
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
        setIsSearchFocused(true);
        setHighlightSearch(true);
        clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setHighlightSearch(false), 1600);
    };

    const q = companySearchQuery.toLowerCase();
    const filteredCompanies = companies.filter(c => !q ||
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.tier?.toLowerCase().includes(q) ||
        c.headquarters?.toLowerCase().includes(q) ||
        c.interview_focus?.some(f => f.toLowerCase().includes(q)) ||
        c.common_topics?.some(t => t.toLowerCase().includes(q)));

    const quickPickIds = new Set(
        QUICK_PICKS.map(name => companies.find(c => c.name.toLowerCase() === name.toLowerCase())?.id).filter(Boolean)
    );
    const moreCount = companies.length - quickPickIds.size;

    const choose = (company) => {
        onSelectCompany(company);
        setCompanySearchQuery('');
        setIsSearchFocused(false);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="dash-section-header">
                <div>
                    <h2>Step 2: Target Company & Past Interview Intelligence</h2>
                    <p>Target Role: <strong style={{ color: 'var(--dash-glow)' }}>{selectedRole?.name} ({seniorityLevel} Level)</strong>. Search any of {companies.length}+ global companies or select a benchmark to calibrate real interview standards, candidate requirements, and assessment rounds.</p>
                </div>
            </div>

            {/* Search-First Typeahead Bar */}
            <div className="company-search-wrapper">
                <div className={`company-search-box ${highlightSearch ? 'is-highlighted' : ''}`}>
                    <Search size={20} color="var(--dash-muted)" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="company-search-input"
                        aria-label={`Search all ${companies.length} companies`}
                        placeholder={`Search all ${companies.length} companies by name, industry or topic (e.g. Razorpay, Fintech, System Design)...`}
                        value={companySearchQuery}
                        onChange={(e) => {
                            setCompanySearchQuery(e.target.value);
                            setIsSearchFocused(true);
                        }}
                        onFocus={() => setIsSearchFocused(true)}
                        // Delay so a click on a suggestion lands before the list closes.
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setIsSearchFocused(false); e.currentTarget.blur(); } }}
                    />
                    {companySearchQuery && (
                        <button
                            className="clear-search-btn"
                            onClick={() => {
                                setCompanySearchQuery('');
                                setIsSearchFocused(false);
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {isSearchFocused && companySearchQuery.trim().length === 0 && (
                    <div className="company-typeahead-dropdown">
                        <div className="company-search-hint">
                            Type to search all {companies.length} companies by name, industry or interview topic.
                        </div>
                    </div>
                )}

                {/* Autocomplete Suggestions Dropdown */}
                {isSearchFocused && companySearchQuery.trim().length > 0 && (
                    <div className="company-typeahead-dropdown">
                        {filteredCompanies.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                                No company found matching "{companySearchQuery}".
                            </div>
                        ) : (
                            filteredCompanies.slice(0, 8).map(c => (
                                <div
                                    key={c.id}
                                    className={`typeahead-item ${selectedCompany?.id === c.id ? 'selected' : ''}`}
                                    onClick={() => choose(c)}
                                >
                                    <div className="typeahead-item-left">
                                        <CompanyLogo company={c} size={32} />
                                        <div className="typeahead-item-info">
                                            <h5>{c.name}</h5>
                                            <span>{c.tier} • {c.industry} ({c.headquarters || 'Global'})</span>
                                        </div>
                                    </div>
                                    <span className={`difficulty-pill ${c.difficulty_level?.toLowerCase()}`}>
                                        {c.difficulty_level}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Popular Quick-Select Targets */}
            <div className="popular-companies-row">
                <span className="popular-label">Quick Select:</span>
                <button
                    type="button"
                    className={`popular-chip ${selectedCompany === null ? 'active' : ''}`}
                    onClick={() => choose(null)}
                >
                    <Globe size={14} /> General Standard
                </button>
                {QUICK_PICKS.map(name => {
                    const comp = companies.find(c => c.name.toLowerCase() === name.toLowerCase());
                    if (!comp) return null;
                    const isSelected = selectedCompany?.id === comp.id;
                    return (
                        <button
                            key={name}
                            type="button"
                            className={`popular-chip ${isSelected ? 'active' : ''}`}
                            onClick={() => choose(comp)}
                        >
                            <CompanyLogo company={comp} size={15} className="company-inline-logo" />
                            {name}
                        </button>
                    );
                })}
                {/* A company picked through search also shows up here, so the choice stays visible. */}
                {selectedCompany && !quickPickIds.has(selectedCompany.id) && (
                    <button type="button" className="popular-chip active" onClick={() => choose(selectedCompany)}>
                        <CompanyLogo company={selectedCompany} size={15} className="company-inline-logo" />
                        {selectedCompany.name}
                    </button>
                )}
                {moreCount > 0 && (
                    <button type="button" className="popular-chip search-more" onClick={focusSearch}>
                        <Search size={14} aria-hidden="true" />
                        Search {moreCount} more companies
                    </button>
                )}
            </div>

            {/* Executive Company Intelligence Dossier */}
            {selectedCompany ? (
                <div className="dossier-card">
                    {/* Hero Header */}
                    <div className="dossier-header-hero">
                        <div className="dossier-hero-left">
                            <CompanyLogo company={selectedCompany} size={64} className="dossier-hero-logo" />
                            <div className="dossier-hero-title">
                                <h3>
                                    {selectedCompany.name}
                                    {selectedCompany.domain && (
                                        <a
                                            href={`https://${selectedCompany.domain}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="dossier-domain-link"
                                            title={`Visit official ${selectedCompany.domain}`}
                                        >
                                            <Globe size={13} /> {selectedCompany.domain} <ExternalLink size={12} />
                                        </a>
                                    )}
                                </h3>
                                <div className="dossier-hero-tags">
                                    <span className="dossier-tier-badge">{selectedCompany.tier}</span>
                                    <span className="dossier-location-tag"><Building2 size={13} /> {selectedCompany.headquarters || 'Global HQ'}</span>
                                    <span className="dossier-location-tag"><Briefcase size={13} /> {selectedCompany.industry}</span>
                                </div>
                            </div>
                        </div>

                        <div className="dossier-rigor-badge">
                            <Award size={16} /> {selectedCompany.difficulty_level} Technical Rigor
                        </div>
                    </div>

                    {/* Company Overview */}
                    <p className="dossier-overview-desc">{selectedCompany.description}</p>

                    {/* Deep Intelligence Grid */}
                    <div className="dossier-sections-grid">

                        {/* 1. Candidate Expectations ("What Company Wants In A Candidate") */}
                        <div className="dossier-block">
                            <div className="dossier-block-header">
                                <Target size={18} color="var(--dash-accent)" />
                                <h4>Candidate Expectations at {selectedCompany.name}</h4>
                            </div>
                            <div className="what-wants-list">
                                {formatWhatCompanyWants(selectedCompany.what_company_wants, selectedCompany.name).map((item, idx) => (
                                    <div key={idx} className="what-wants-item">
                                        <CheckCircle2 size={16} className="what-wants-icon" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Assessment Rounds & Roadmap */}
                        <div className="dossier-block">
                            <div className="dossier-block-header">
                                <Layers size={18} color="var(--dash-glow)" />
                                <h4>Assessment Process & Interview Rounds</h4>
                            </div>
                            <div className="rounds-timeline-grid">
                                {formatInterviewRounds(selectedCompany.interview_rounds).map((r, idx) => (
                                    <div key={idx} className="round-card-node">
                                        <span className="round-card-badge">{r.stage}</span>
                                        <span className="round-card-title">{r.title}</span>
                                        {r.desc ? <p className="round-card-desc">{r.desc}</p> : null}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Core Technical Focus & Question Topics */}
                        <div className="dossier-block">
                            <div className="dossier-block-header">
                                <Code size={18} color="var(--dash-success)" />
                                <h4>Core Technical Focus & Question Topics</h4>
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority Competencies:</span>
                                <div className="intel-focus-grid">
                                    {selectedCompany.interview_focus?.map((f, i) => (
                                        <span key={i} className="intel-focus-badge">{f}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Historical Question Topics:</span>
                                <div className="intel-focus-grid">
                                    {selectedCompany.common_topics?.map((t, i) => (
                                        <span key={i} className="intel-topic-badge">#{t}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4. Strategic Preparation Tips */}
                        <div className="dossier-block">
                            <div className="dossier-block-header">
                                <Sparkles size={18} color="#f59e0b" />
                                <h4>Strategic Preparation Advice</h4>
                            </div>
                            <div className="prep-tips-list">
                                {formatPrepTips(selectedCompany.prep_tips).map((tip, idx) => (
                                    <div key={idx} className="prep-tip-item">
                                        <Sparkle size={15} className="prep-tip-icon" />
                                        <span>{tip}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Footer Action CTA */}
                    <div className="dossier-action-footer">
                        <button
                            className="btn-continue-primary"
                            style={{ maxWidth: '380px' }}
                            onClick={onContinue}
                        >
                            Target {selectedCompany.name} & Continue <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                /* Company-Agnostic Dossier View */
                <div className="dossier-card">
                    <div className="dossier-header-hero">
                        <div className="dossier-hero-left">
                            <div className="dossier-hero-logo">
                                <Globe size={32} color="#818cf8" />
                            </div>
                            <div className="dossier-hero-title">
                                <h3>General Industry Standard Benchmark</h3>
                                <div className="dossier-hero-tags">
                                    <span className="dossier-tier-badge">Agnostic Assessment</span>
                                    <span className="dossier-location-tag"><Briefcase size={13} /> Full Tech Stack</span>
                                </div>
                            </div>
                        </div>
                        <div className="dossier-rigor-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                            <Award size={16} /> Canonical Technical Benchmark
                        </div>
                    </div>

                    <p className="dossier-overview-desc">
                        Practicing without company-specific calibration focuses on the core fundamentals, problem-solving, and design trade-offs expected of a {selectedRole?.name}.
                    </p>

                    <div className="dossier-action-footer">
                        <button
                            className="btn-continue-primary"
                            style={{ maxWidth: '380px' }}
                            onClick={onContinue}
                        >
                            Continue with General Standard <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default CompanyStep;
