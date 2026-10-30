import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Check, ChevronRight, FileText, Search, Target, Zap } from 'lucide-react';
import RoleIcon from './RoleIcon';
import TypingText from './TypingText';
import { SENIORITY_YEARS } from './format';

const CATEGORIES = ['All', 'Software & Web', 'AI & Data', 'Cloud & DevOps', 'Hardware & VLSI', 'Robotics & Automation', 'Core Engineering'];

// Optional job description: its required skills are added to the skill gap and the interview.
const JobDescriptionPanel = ({ jd }) => {
    const [open, setOpen] = useState(Boolean(jd.text));
    const required = jd.analysis?.required_skills || [];
    const preferred = jd.analysis?.preferred_skills || [];

    return (
        <div className="jd-panel">
            <button type="button" className="jd-toggle" onClick={() => setOpen(o => !o)}>
                <FileText size={14} />
                {open ? 'Hide job description' : 'Tailor to a specific job description (optional)'}
            </button>

            {open && (
                <div className="jd-body">
                    <textarea
                        className="jd-textarea"
                        rows={6}
                        maxLength={10000}
                        value={jd.text}
                        onChange={(e) => jd.onTextChange(e.target.value)}
                        placeholder="Paste the job description you are applying for..."
                    />
                    <div className="jd-actions">
                        <button
                            type="button"
                            className="btn-jd-analyze"
                            onClick={jd.onAnalyze}
                            disabled={jd.analyzing || jd.text.trim().length < 30}
                        >
                            {jd.analyzing ? 'Analyzing...' : jd.analysis ? 'Re-analyze' : 'Analyze Job Description'}
                        </button>
                        {(jd.analysis || jd.text) && (
                            <button type="button" className="btn-jd-clear" onClick={jd.onClear}>
                                Remove
                            </button>
                        )}
                    </div>
                    {jd.error && <p className="jd-error">{jd.error}</p>}

                    {jd.analysis && (
                        <div className="jd-results">
                            <p className="jd-results-note">
                                These requirements will be added to your skill gap analysis and interview questions.
                            </p>
                            <div className="jd-skill-row">
                                <span className="jd-skill-label">Required</span>
                                {required.length > 0
                                    ? required.map(s => <span key={s.name} className="jd-skill-chip required">{s.name}</span>)
                                    : <span className="skill-empty-note">No specific technical skills detected</span>}
                            </div>
                            {preferred.length > 0 && (
                                <div className="jd-skill-row">
                                    <span className="jd-skill-label">Nice to have</span>
                                    {preferred.map(s => <span key={s.name} className="jd-skill-chip">{s.name}</span>)}
                                </div>
                            )}
                            <div className="jd-meta">
                                Experience: {jd.analysis.experience_requirements} • Level: {jd.analysis.job_info?.experience_level}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const RoleStep = ({
    roles, selectedRole, onSelectRole,
    searchQuery, onSearchChange, selectedCategory, onCategoryChange,
    seniorityLevel, onSeniorityChange,
    jd, onContinue,
}) => {
    // Filtered roles based on search and category
    const q = searchQuery.toLowerCase().trim();
    const filteredRoles = roles.filter(role => {
        const matchesSearch = !q ||
            role.name.toLowerCase().includes(q) ||
            (role.category && role.category.toLowerCase().includes(q)) ||
            (role.description && role.description.toLowerCase().includes(q)) ||
            role.required_skills?.some(s => s.name.toLowerCase().includes(q));

        if (selectedCategory === 'All') return matchesSearch;
        return matchesSearch && role.category === selectedCategory;
    });

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Step Header */}
            <div className="dash-section-header">
                <div>
                    <h2>Step 1: Select Your Engineering Discipline & Role</h2>
                    <p>Specialized assessment rubrics and interview questions tailored for every engineering branch.</p>
                </div>

                {/* Level Selector */}
                <div className="seniority-toggle-group">
                    <span className="toggle-label">Target Level:</span>
                    {['Junior', 'Mid', 'Senior'].map(lvl => (
                        <button
                            key={lvl}
                            className={`toggle-btn ${seniorityLevel === lvl ? 'active' : ''}`}
                            onClick={() => onSeniorityChange(lvl)}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search & Engineering Category Filter Bar */}
            <div className="filter-toolbar dash-glass">
                <div className="search-box">
                    <Search size={18} color="var(--dash-muted)" />
                    <input
                        type="text"
                        placeholder={`Search ${roles.length} roles or skills (e.g. Robotics, VLSI, Aerospace, React, CFD)...`}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search-btn" onClick={() => onSearchChange('')}>✕</button>
                    )}
                </div>

                <div className="category-pills">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => onCategoryChange(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Split Screen Layout: Clean Left Rectangle List & Open Fluid Right Canvas */}
            <div className="roles-split-layout">
                {/* Left Column: Scrollable List of Job Rectangles */}
                <div className="roles-list-column">
                    <div className="roles-list-header">
                        <span className="roles-count-badge">
                            <Briefcase size={13} /> {filteredRoles.length} Engineering Roles
                        </span>
                        <span className="roles-hint-text">Click to inspect domain criteria</span>
                    </div>

                    {filteredRoles.length === 0 ? (
                        <div className="empty-search-state dash-glass">
                            <Search size={28} color="var(--dash-muted)" />
                            <p>No engineering roles matching "{searchQuery}". Try another keyword or switch category.</p>
                        </div>
                    ) : (
                        <div className="roles-rectangle-list">
                            {filteredRoles.map(r => {
                                const isSelected = selectedRole?.id === r.id;
                                return (
                                    <motion.div
                                        key={r.id}
                                        whileHover={{ x: 4 }}
                                        whileTap={{ scale: 0.99 }}
                                        className={`role-rectangle-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => onSelectRole(r)}
                                    >
                                        <div className="role-rect-left">
                                            <div className={`role-rect-icon ${isSelected ? 'selected' : ''}`}>
                                                <RoleIcon name={r.name} category={r.category} />
                                            </div>
                                            <div className="role-rect-info">
                                                <h4 className="role-rect-title">{r.name}</h4>
                                                <div className="role-rect-meta">
                                                    <span className="role-rect-category">{r.category || 'Engineering'}</span>
                                                    <span className="role-rect-dot">•</span>
                                                    <span className="role-rect-skills-count">{r.required_skills?.length || 0} skills</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="role-rect-right">
                                            {isSelected ? (
                                                <div className="role-rect-active-pill">
                                                    <Check size={12} /> Active
                                                </div>
                                            ) : (
                                                <ChevronRight size={16} className="role-rect-chevron" />
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Column: Open Fluid Canvas with Dynamic Typing Animation */}
                <div className="role-open-canvas">
                    {selectedRole ? (
                        <motion.div
                            key={selectedRole.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="canvas-content-wrapper"
                        >
                            {/* Category & Seniority Top Header */}
                            <div className="canvas-header-meta">
                                <span className="canvas-category-tag">
                                    <Target size={13} /> {selectedRole.category || 'Engineering Discipline'}
                                </span>
                                <span className="canvas-level-pill">
                                    {seniorityLevel} Level Engineer
                                </span>
                            </div>

                            {/* Role Main Headline */}
                            <h1 className="canvas-role-title">{selectedRole.name}</h1>
                            <div className="canvas-sub-header">
                                <span>TECHNICAL PROFILE & EVALUATION BENCHMARK</span>
                            </div>

                            {/* Dynamic Typing Role Manifesto */}
                            <div className="canvas-typing-container">
                                <p className="canvas-typing-desc">
                                    <TypingText
                                        key={`${selectedRole.id}-${seniorityLevel}`}
                                        text={selectedRole.description}
                                        speed={12}
                                    />
                                </p>
                            </div>

                            {/* Metrics & Parameters Matrix */}
                            <div className="canvas-spec-matrix">
                                <div className="canvas-spec-item">
                                    <span className="spec-item-label">Target Seniority</span>
                                    <span className="spec-item-val">{seniorityLevel} Level ({SENIORITY_YEARS[seniorityLevel]})</span>
                                </div>
                                <div className="canvas-spec-item">
                                    <span className="spec-item-label">Canonical Skills</span>
                                    <span className="spec-item-val">{selectedRole.required_skills?.length || 0} Core Competencies</span>
                                </div>
                                <div className="canvas-spec-item">
                                    <span className="spec-item-label">Evaluation Engine</span>
                                    <span className="spec-item-val">Adaptive AI Rubric</span>
                                </div>
                            </div>

                            {/* Canonical Skills Matrix */}
                            <div className="canvas-skills-section">
                                <h3 className="canvas-skills-heading">
                                    <Zap size={14} color="#818cf8" />
                                    CORE DOMAIN COMPETENCIES & REQUIRED STACK
                                </h3>
                                <div className="canvas-skills-grid">
                                    {selectedRole.required_skills?.map(skill => (
                                        <div key={skill.id} className="canvas-skill-chip">
                                            <div className="skill-chip-dot" />
                                            <span className="skill-chip-name">{skill.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <JobDescriptionPanel jd={jd} />

                            {/* Primary Navigation Trigger */}
                            <div className="canvas-action-row">
                                <button
                                    className="btn-continue-primary canvas-btn"
                                    onClick={onContinue}
                                >
                                    <span>Continue to Target Company</span>
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="canvas-placeholder">
                            <Briefcase size={36} color="var(--dash-muted)" />
                            <p>Select any engineering discipline from the left list to view assessment details.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default RoleStep;
