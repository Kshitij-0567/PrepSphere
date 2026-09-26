import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, FileText, GraduationCap, Mail, MapPin } from 'lucide-react';
import { formatDateLong } from '../../utils/format';
import LinkedProfiles from './LinkedProfiles';

const ProfileCard = ({ summary, onChanged }) => {
    const navigate = useNavigate();
    const { user, links, github, resume, target, readiness } = summary;
    const experience = resume?.experience || [];
    const education = resume?.education || [];

    return (
        <aside className="ps-card ps-profile" aria-label="Your profile">
            <div className="ps-banner-art" aria-hidden="true" />
            <div className="ps-p-body">
                <div className="ps-p-section">
                    <div
                        className="ps-avatar"
                        style={{ '--ready': `${readiness?.score || 0}%` }}
                        title={readiness ? `Ring shows role readiness: ${readiness.score}%` : 'Start an interview to measure readiness'}
                    >
                        <span>{user.initials}</span>
                    </div>
                    <h2 className="ps-name">{user.name}</h2>
                    <div className="ps-badges">
                        {target ? (
                            <>
                                <span className="ps-badge">{target.role_name}</span>
                                <span className="ps-badge ps-badge-quiet">{target.seniority}</span>
                            </>
                        ) : (
                            <span className="ps-badge ps-badge-quiet">No target role yet</span>
                        )}
                    </div>
                    <ul className="ps-meta">
                        {user.location && <li><MapPin size={15} aria-hidden="true" /><span>{user.location}</span></li>}
                        <li><Mail size={15} aria-hidden="true" /><span>{user.email}</span></li>
                    </ul>
                </div>

                <div className="ps-p-section">
                    <h3 className="ps-label">Linked profiles</h3>
                    <LinkedProfiles links={links} github={github} onChanged={onChanged} />
                </div>

                <div className="ps-p-section">
                    <h3 className="ps-label">Resume</h3>
                    {resume ? (
                        <div className="ps-row-3">
                            <span className="ps-mono-tile"><FileText size={16} aria-hidden="true" /></span>
                            <div>
                                <strong title={resume.filename}>{resume.filename}</strong>
                                <span>
                                    {resume.completeness != null ? `${resume.completeness}% complete · ` : ''}
                                    uploaded {formatDateLong(resume.uploaded_at)}
                                </span>
                            </div>
                            <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => navigate('/resumes')}>Replace</button>
                        </div>
                    ) : (
                        <div className="ps-empty">
                            <span>Upload a resume to see your skills and readiness.</span>
                            <button className="ps-btn ps-btn-sm" type="button" onClick={() => navigate('/resumes')}>Upload resume</button>
                        </div>
                    )}
                </div>

                {resume && resume.skills.length > 0 && (
                    <div className="ps-p-section">
                        <h3 className="ps-label">Skills on your resume · {resume.skills.length}</h3>
                        <div className="ps-chips">
                            {resume.skills.map(skill => <span key={skill} className="ps-chip">{skill}</span>)}
                        </div>
                    </div>
                )}

                {(experience.length > 0 || education.length > 0) && (
                    <div className="ps-p-section">
                        <h3 className="ps-label">Experience &amp; education</h3>
                        <div className="ps-items">
                            {experience.map((item, i) => (
                                <div className="ps-item" key={`x-${i}`}>
                                    <span className="ps-mono-tile"><Briefcase size={16} aria-hidden="true" /></span>
                                    <div><strong>{item.title}</strong>{item.subtitle && <span>{item.subtitle}</span>}</div>
                                </div>
                            ))}
                            {education.map((item, i) => (
                                <div className="ps-item" key={`e-${i}`}>
                                    <span className="ps-mono-tile"><GraduationCap size={16} aria-hidden="true" /></span>
                                    <div><strong>{item.title}</strong>{item.subtitle && <span>{item.subtitle}</span>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default ProfileCard;
