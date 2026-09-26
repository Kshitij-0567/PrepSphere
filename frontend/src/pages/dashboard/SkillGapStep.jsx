import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Award, ClipboardCheck, FileText } from 'lucide-react';

const FILTERS = [
    { key: 'All', label: 'All' },
    { key: 'Strong', label: 'Strong' },
    { key: 'Developing', label: 'Developing' },
    { key: 'Weak', label: 'Minor Gaps' },
    { key: 'Missing', label: 'Missing' },
];

const CATEGORIES = [
    {
        filter: 'Strong', status: 'strong', field: 'strong_skills', title: 'Strong Skills', icon: '✓',
        empty: 'No strong competencies matched yet',
        hint: 'Required skills your resume shows repeatedly (e.g. listed and used in a project).',
    },
    {
        filter: 'Developing', status: 'developing', field: 'developing_skills', title: 'Developing Skills', icon: '•',
        empty: 'No skills currently in developing status',
        hint: 'Mentioned only once. Back them up with a project or experience bullet.',
    },
    {
        filter: 'Weak', status: 'weak', field: 'weak_skills', title: 'Minor Gaps', icon: '⚠',
        empty: 'No lower-priority gaps',
        hint: 'Lower-priority requirements that your resume does not show yet.',
    },
    {
        filter: 'Missing', status: 'missing', field: 'missing_skills', title: 'Missing Required Skills', icon: '✕',
        empty: 'All required role competencies covered',
        hint: 'High-priority requirements that your resume does not show yet.',
    },
];

const describeDetail = (detail) => {
    if (!detail) return undefined;
    if (!detail.matched_via?.length) return 'Not found in your resume';
    return `Matched by: ${detail.matched_via.join(', ')} (mentioned ${detail.mentions}×)`;
};

const ResumeInsights = ({ quality }) => {
    if (!quality || quality.completeness_score === undefined) return null;
    const tips = quality.improvement_feedback || [];
    return (
        <div className="resume-insights-card dash-glass">
            <div className="resume-insights-header">
                <FileText size={18} color="var(--dash-accent)" />
                <span>Resume Completeness</span>
                <strong className="resume-insights-score">{quality.completeness_score}%</strong>
            </div>
            {tips.length > 0 ? (
                <ul className="resume-insights-tips">
                    {tips.map(tip => <li key={tip}>{tip}</li>)}
                </ul>
            ) : (
                <p className="resume-insights-ok">Your resume covers every section we check for.</p>
            )}
        </div>
    );
};

const SkillGapStep = ({ skillGapData, quality, jdSkillCount, loading, onStartInterview }) => {
    const [activeSkillFilter, setActiveSkillFilter] = useState('All');
    const details = Object.fromEntries((skillGapData.skill_details || []).map(d => [d.name, d]));
    const score = skillGapData.readiness_score;

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="dash-section-header">
                <div>
                    <h2>Step 4: Transparent Skill Gap Matrix</h2>
                    <p>
                        Comparison of your active resume against the <strong style={{ color: '#fff' }}>{skillGapData.role_name}</strong> requirements.
                        {jdSkillCount > 0 && <span className="jd-inline-note"> Includes requirements from your job description.</span>}
                    </p>
                </div>
            </div>

            {/* Readiness Score Banner */}
            <div className="gap-header-card dash-glass">
                <div className="score-details">
                    <span className="score-label">Role Readiness Score</span>
                    <div className="score-number-row">
                        <h3 className="gauge-score" style={{ color: score >= 70 ? 'var(--dash-success)' : 'var(--dash-warning)' }}>
                            {score}%
                        </h3>
                        <span className="score-status-tag">
                            {score >= 80 ? 'Strong Alignment' : score >= 60 ? 'Moderate Readiness' : 'High Learning Needed'}
                        </span>
                    </div>
                    <span className="score-explainer">Share of the role's requirements (weighted by importance) that your resume demonstrates.</span>
                </div>

                <div className="readiness-icon-badge">
                    <Award size={44} color={score >= 70 ? 'var(--dash-success)' : 'var(--dash-warning)'} />
                </div>
            </div>

            <ResumeInsights quality={quality} />

            {/* Interactive Skill Category Filter Bar */}
            <div className="skill-filter-tabs">
                {FILTERS.map(({ key, label }) => (
                    <button
                        key={key}
                        className={`skill-tab ${activeSkillFilter === key ? 'active' : ''}`}
                        onClick={() => setActiveSkillFilter(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Skill Grid Matrix */}
            <div className="gap-categories-grid">
                {CATEGORIES.filter(c => activeSkillFilter === 'All' || activeSkillFilter === c.filter).map(c => {
                    const skills = skillGapData[c.field] || [];
                    return (
                        <div key={c.status} className={`gap-cat-card ${c.status}`}>
                            <div className="gap-cat-header">
                                <span className="gap-cat-title">{c.title}</span>
                                <span className={`gap-cat-count ${c.status}`}>{skills.length}</span>
                            </div>
                            <p className="gap-cat-hint">{c.hint}</p>
                            <div className="cat-skills-list">
                                {skills.length > 0 ? (
                                    skills.map(s => (
                                        <span key={s} className={`skill-badge ${c.status}`} title={describeDetail(details[s])}>
                                            {c.icon} {s}
                                        </span>
                                    ))
                                ) : (
                                    <span className="skill-empty-note">{c.empty}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '32px' }}>
                <button
                    onClick={onStartInterview}
                    disabled={loading}
                    className="btn-continue-primary"
                    style={{ maxWidth: '340px' }}
                >
                    <ClipboardCheck size={18} />
                    {loading ? "Preparing your first question..." : "Start Text Mock Interview"} <ArrowRight size={18} />
                </button>
            </div>
        </motion.div>
    );
};

export default SkillGapStep;
