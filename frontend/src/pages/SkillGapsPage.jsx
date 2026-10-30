import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { useFeedback } from '../components/ui/feedbackContext';
import { SKILL_STATUS } from '../utils/format';

const GROUPS = [
    { key: 'strong', field: 'strong_skills', title: 'Strong', hint: 'Required skills your resume shows repeatedly.' },
    { key: 'developing', field: 'developing_skills', title: 'Developing', hint: 'Mentioned once. Back them up with a project.' },
    { key: 'missing', field: 'missing_skills', title: 'Missing', hint: 'High-priority requirements not on your resume yet.' },
    { key: 'weak', field: 'weak_skills', title: 'Minor gaps', hint: 'Lower-priority requirements not on your resume yet.' },
];

const SkillGapsPage = () => {
    const navigate = useNavigate();
    const { tipAt, hideTip } = useFeedback();
    const [roles, setRoles] = useState([]);
    const [roleId, setRoleId] = useState('');
    const [jdText, setJdText] = useState('');
    const [jdSkills, setJdSkills] = useState([]);
    const [gap, setGap] = useState(null);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState('');

    // Default to the role of the most recent interview, else the first role.
    useEffect(() => {
        let cancelled = false;
        Promise.all([api.get('/roles'), api.get('/interviews/history')])
            .then(([rolesRes, historyRes]) => {
                if (cancelled) return;
                setRoles(rolesRes.data);
                const recent = historyRes.data.find(i => i.role_id);
                setRoleId(String(recent?.role_id || rolesRes.data[0]?.id || ''));
            })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load roles.')); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!roleId) return undefined;
        let cancelled = false;
        const params = { role_id: roleId };
        if (jdSkills.length) params.jd_skills = jdSkills.join(',');
        api.get('/skill-gaps', { params })
            .then(res => { if (!cancelled) { setGap(res.data); setError(''); setLoading(false); } })
            .catch(err => { if (!cancelled) { setError(apiErrorMessage(err, 'Could not compute your skill gap.')); setLoading(false); } });
        return () => { cancelled = true; };
    }, [roleId, jdSkills]);

    const changeRole = (value) => {
        setLoading(true);
        setRoleId(value);
    };

    const analyzeJd = async () => {
        setAnalyzing(true);
        setError('');
        try {
            const role = roles.find(r => String(r.id) === roleId);
            const res = await api.post('/jobs/analyze', { jd_text: jdText, role_title: role?.name });
            setLoading(true);
            setJdSkills(res.data.required_skills.map(s => s.name));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not analyze the job description.'));
        }
        setAnalyzing(false);
    };

    const clearJd = () => {
        setJdText('');
        if (jdSkills.length) { setLoading(true); setJdSkills([]); }
    };

    const details = Object.fromEntries((gap?.skill_details || []).map(d => [d.name, d]));
    const describe = (name) => {
        const d = details[name];
        if (!d) return null;
        return (
            <>
                <strong>{name}</strong>
                <span>Weight ×{d.importance_weight.toFixed(1)}</span>
                <span>{d.matched_via.length ? `Matched by ${d.matched_via.join(', ')} (mentioned ${d.mentions}×)` : 'Not found in your resume'}</span>
            </>
        );
    };

    return (
        <div className="ps-page">
            <article className="ps-card" aria-labelledby="ps-gap-controls">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="ps-gap-controls">Compare your resume with a role</h2>
                        <p className="ps-card-sub">Uses your active resume and any skills imported from GitHub.</p>
                    </div>
                </div>
                <div className="ps-two-col">
                    <div className="ps-field">
                        <label htmlFor="ps-gap-role">Target role</label>
                        <select id="ps-gap-role" className="ps-input" value={roleId} onChange={(e) => changeRole(e.target.value)}>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="ps-field">
                        <label htmlFor="ps-gap-jd">Job description (optional)</label>
                        <textarea id="ps-gap-jd" className="ps-input" rows={3} maxLength={10000} value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste a job description to add its required skills" />
                        <div className="ps-link-actions">
                            <button className="ps-btn ps-btn-sm" type="button" onClick={analyzeJd} disabled={analyzing || jdText.trim().length < 30}>
                                {analyzing && <Loader2 size={13} className="ps-spin" aria-hidden="true" />}
                                {analyzing ? 'Analyzing…' : jdSkills.length ? 'Re-analyze' : 'Add JD skills'}
                            </button>
                            {(jdText || jdSkills.length > 0) && <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={clearJd}>Clear</button>}
                            {jdSkills.length > 0 && <span className="ps-help" style={{ alignSelf: 'center' }}>{jdSkills.length} JD skills included</span>}
                        </div>
                    </div>
                </div>
            </article>

            {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
            {gap && !gap.has_active_resume && (
                <div className="ps-banner ps-banner-warn">
                    <span>You have no active resume, so every requirement shows as a gap.</span>
                    <button className="ps-btn ps-btn-sm" type="button" onClick={() => navigate('/resumes')}>Upload resume</button>
                </div>
            )}

            {gap && (
                <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="ps-tiles" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                        <div className="ps-tile">
                            <span className="ps-tile-label">Readiness for {gap.role_name}</span>
                            <div className="ps-tile-row">
                                <span className="ps-tile-value">{gap.readiness_score.toFixed(1)}<small>%</small></span>
                                <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/dashboard', { state: { roleId: Number(roleId) } })}>Practice this role</button>
                            </div>
                            <div className="ps-meter" role="img" aria-label={`Readiness ${gap.readiness_score} percent`}><i style={{ width: `${gap.readiness_score}%` }} /></div>
                            <span className="ps-tile-foot">Share of the role's requirements, weighted by importance, that your profile demonstrates.</span>
                        </div>
                    </div>
                    <div className="ps-two-col">
                        {GROUPS.map(g => {
                            const skills = gap[g.field] || [];
                            const st = SKILL_STATUS[g.key];
                            return (
                                <article className="ps-card" key={g.key} aria-label={g.title}>
                                    <div className="ps-card-head" style={{ marginBottom: 12 }}>
                                        <div>
                                            <h3 className="ps-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <i className={`ps-sw ${st.hollow ? 'ring' : ''}`} style={{ '--c': st.hex }} />{g.title}
                                                <span className="ps-muted" style={{ fontFamily: 'var(--f-mono)', fontSize: 12 }}>{skills.length}</span>
                                            </h3>
                                            <p className="ps-card-sub">{g.hint}</p>
                                        </div>
                                    </div>
                                    {skills.length === 0 ? <p className="ps-muted">None</p> : (
                                        <div className="ps-chips">
                                            {skills.map(s => (
                                                <span
                                                    key={s}
                                                    className="ps-chip"
                                                    tabIndex={0}
                                                    onMouseEnter={(e) => { const c = describe(s); if (c) tipAt(e.currentTarget, c); }}
                                                    onMouseLeave={hideTip}
                                                    onFocus={(e) => { const c = describe(s); if (c) tipAt(e.currentTarget, c); }}
                                                    onBlur={hideTip}
                                                >{s}</span>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillGapsPage;
