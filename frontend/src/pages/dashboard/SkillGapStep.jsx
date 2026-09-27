import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Award, FileText, Keyboard, Video } from 'lucide-react';

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

const KIND_WORDS = { spoken: 'spoken', code: 'coding', design: 'whiteboard' };

// "Spoken, coding and whiteboard steps" for the kinds a plan uses.
function planKinds(plan) {
    const kinds = [...new Set(plan.map(s => KIND_WORDS[s.kind]))];
    const words = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0];
    return words.charAt(0).toUpperCase() + words.slice(1);
}

const FormatChooser = ({ format, onFormat, videoPlan, loading, onStart }) => {
    const options = [
        {
            key: 'text', icon: Keyboard, title: 'Text interview', meta: '5 questions · about 15 min',
            text: 'Type your answers and get rubric feedback after each one.',
        },
        {
            key: 'video', icon: Video, title: 'Video interview', badge: 'New',
            meta: videoPlan ? `${videoPlan.plan.length} steps · about ${videoPlan.minutes} min` : 'Camera and microphone',
            text: videoPlan
                ? `${planKinds(videoPlan.plan)} steps. The interviewer speaks each question and may ask a follow-up; you get a replay and delivery feedback.`
                : 'The interviewer speaks each question and may ask a follow-up; you get a replay and delivery feedback.',
        },
    ];
    return (
        <div className="interview-format">
            <h3 className="interview-format-title">How do you want to practise?</h3>
            <div className="interview-format-grid" role="radiogroup" aria-label="Interview format">
                {options.map(o => {
                    const Icon = o.icon;
                    return (
                        <button key={o.key} type="button" role="radio" aria-checked={format === o.key}
                            className={`interview-format-card dash-glass ${format === o.key ? 'selected' : ''}`} onClick={() => onFormat(o.key)}>
                            <span className="interview-format-icon"><Icon size={20} aria-hidden="true" /></span>
                            <span className="interview-format-body">
                                <strong>{o.title}{o.badge && <span className="interview-format-badge">{o.badge}</span>}</strong>
                                <span className="interview-format-meta">{o.meta}</span>
                                <span className="interview-format-text">{o.text}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <button onClick={() => onStart(format)} disabled={loading} className="btn-continue-primary" style={{ maxWidth: '340px' }}>
                {format === 'video' ? <Video size={18} /> : <Keyboard size={18} />}
                {loading ? (format === 'video' ? 'Preparing your interview…' : 'Preparing your first question…') : format === 'video' ? 'Set up video interview' : 'Start text interview'}
                <ArrowRight size={18} />
            </button>
        </div>
    );
};

const SkillGapStep = ({ skillGapData, quality, jdSkillCount, loading, onStartInterview, videoPlan }) => {
    const [activeSkillFilter, setActiveSkillFilter] = useState('All');
    const [format, setFormat] = useState('video');
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

            <FormatChooser format={format} onFormat={setFormat} videoPlan={videoPlan} loading={loading} onStart={onStartInterview} />
        </motion.div>
    );
};

export default SkillGapStep;
