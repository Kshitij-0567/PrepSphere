import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Bookmark, CheckCircle, FileText, FolderCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import CompanyLogo from './CompanyLogo';

const SAMPLE_RESUME = `Alex Chen - Software Development Engineer
alex.chen@example.com | github.com/alexchen
Skills: Python, JavaScript, React, TypeScript, Node.js, PostgreSQL, REST APIs, Git, Data Structures, Algorithms, System Design, Docker, HTML, CSS.
Experience: Built full-stack web applications and RESTful services with Node.js and PostgreSQL, optimized SQL queries, and implemented automated test suites.
Project: Developed a React and TypeScript dashboard backed by a Python API running in Docker.`;

const ResumeStep = ({
    selectedRole, seniorityLevel, selectedCompany,
    savedResumes, activeResumeId, busyResumeId, loading, maxResumeMb,
    onUseSaved, onDeleteSaved, onUpload,
}) => {
    const [resumeFile, setResumeFile] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setResumeFile(e.dataTransfer.files[0]);
        }
    };

    // Quick sample resume for fast interactivity & testing
    const loadSampleResume = () => {
        const blob = new Blob([SAMPLE_RESUME], { type: 'text/plain' });
        setResumeFile(new File([blob], "alex_chen_sample_resume.txt", { type: 'text/plain' }));
    };

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="dash-section-header">
                <div>
                    <h2>Step 3: Upload or Select Candidate Resume</h2>
                    <p>
                        Target Role: <strong style={{ color: 'var(--dash-glow)' }}>{selectedRole?.name} ({seniorityLevel})</strong>
                        {selectedCompany ? (
                            <span> • Company: <strong style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center' }}><CompanyLogo company={selectedCompany} size={18} className="company-inline-logo" /> {selectedCompany.name}</strong></span>
                        ) : (
                            <span> • Company: <strong style={{ color: 'var(--dash-muted)' }}>General Standard</strong></span>
                        )}
                    </p>
                </div>
            </div>

            {/* SAVED RESUMES USER LIBRARY */}
            {savedResumes.length > 0 && (
                <div className="saved-resumes-container">
                    <div className="saved-resumes-header">
                        <FolderCheck size={20} color="var(--dash-accent)" />
                        <span>Your Saved Resumes Library ({savedResumes.length})</span>
                    </div>

                    <div className="saved-resumes-grid">
                        {savedResumes.map(r => {
                            const isActive = activeResumeId === r.id;
                            const uploadDate = r.uploaded_at
                                ? new Date(r.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                : '';

                            return (
                                <div
                                    key={r.id}
                                    className={`saved-resume-card dash-glass ${isActive ? 'selected' : ''}`}
                                >
                                    <div>
                                        <div className="saved-resume-top">
                                            <div className="saved-resume-file-info">
                                                <FileText size={28} color={isActive ? 'var(--dash-success)' : 'var(--dash-accent)'} />
                                                <div>
                                                    <h4 className="saved-resume-name">{r.filename || "Resume Document"}</h4>
                                                    <span className="saved-resume-date">
                                                        Saved on {uploadDate}
                                                        {isActive && <span className="active-resume-tag"><CheckCircle size={11} /> Active profile</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                className="btn-delete-resume"
                                                title="Delete saved resume from profile"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteSaved(r);
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="saved-resume-skills">
                                            <div className="skills-count-header">
                                                Extracted Skills ({r.extracted_skills?.length || 0}):
                                            </div>
                                            <div className="saved-skills-tags">
                                                {r.extracted_skills?.slice(0, 6).map((skill, i) => (
                                                    <span key={i} className="saved-skill-chip">{skill}</span>
                                                ))}
                                                {r.extracted_skills?.length > 6 && (
                                                    <span className="saved-skill-chip" style={{ color: 'var(--dash-glow)' }}>
                                                        +{r.extracted_skills.length - 6} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onUseSaved(r.id)}
                                        disabled={loading}
                                        className="btn-use-saved-resume"
                                    >
                                        {loading && busyResumeId === r.id ? "Analyzing..." : (
                                            <>
                                                <Bookmark size={15} /> Use This Saved Resume <ArrowRight size={15} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="upload-divider">
                        <span>OR UPLOAD A NEW RESUME FILE</span>
                    </div>
                </div>
            )}

            <div
                className={`dropzone-container dash-glass ${isDragOver ? 'drag-over' : ''} ${resumeFile ? 'file-loaded' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                <div className="dropzone-icon-circle">
                    <Upload size={36} color="var(--dash-accent)" />
                </div>

                <h3 className="dropzone-title">
                    {resumeFile ? "Resume File Ready for Analysis" : "Drag & Drop Your Resume File Here"}
                </h3>
                <p className="dropzone-subtitle">
                    {resumeFile ? resumeFile.name : `Supports PDF, DOCX, or TXT file formats up to ${maxResumeMb}MB (automatically saved to your profile)`}
                </p>

                <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setResumeFile(e.target.files[0] || null)}
                    style={{ display: 'none' }}
                    id="resume-file-input"
                />

                <div className="dropzone-actions">
                    <label htmlFor="resume-file-input" className="btn-file-select">
                        <FileText size={16} /> {resumeFile ? "Change Resume File" : "Browse Files from Computer"}
                    </label>

                    {!resumeFile && (
                        <button
                            type="button"
                            onClick={loadSampleResume}
                            className="btn-sample-resume"
                            title="Instantly test with an SDE resume"
                        >
                            <Sparkles size={15} color="#10b981" /> Load Sample SDE Resume
                        </button>
                    )}
                </div>

                {resumeFile && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ marginTop: '28px' }}>
                        <button
                            onClick={() => onUpload(resumeFile)}
                            disabled={loading}
                            className="btn-continue-primary"
                            style={{ maxWidth: '340px', margin: '0 auto' }}
                        >
                            {loading ? "Extracting & Saving Resume..." : "Analyze & Save to Profile"} <ArrowRight size={18} />
                        </button>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

export default ResumeStep;
