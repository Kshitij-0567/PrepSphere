import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { useFeedback } from '../../components/ui/feedbackContext';
import { SKILL_STATUS } from '../../utils/format';
import SkillSphere from './SkillSphere';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'strong', label: 'Strong' },
    { key: 'developing', label: 'Developing' },
    { key: 'weak', label: 'Minor gap' },
    { key: 'missing', label: 'Missing' },
    { key: 'extra', label: 'Not required' },
];

const Swatch = ({ status }) => {
    const st = SKILL_STATUS[status] || SKILL_STATUS.extra;
    return <i className={`ps-sw ${st.hollow ? 'ring' : ''}`} style={{ '--c': st.hex }} />;
};

function nodeDetail(n) {
    const st = SKILL_STATUS[n.status] || SKILL_STATUS.extra;
    let evidence;
    if (n.github) evidence = 'Found in your public GitHub repositories';
    else if (n.mentions) evidence = `Mentioned ${n.mentions}× in your resume`;
    else if (n.via?.length) evidence = `Matched by ${n.via.join(', ')}`;
    else evidence = 'Not found in your resume';
    return (
        <>
            <strong>{n.name}</strong>
            <span className="ps-tip-row"><Swatch status={n.status} />{st.label}</span>
            <span>{n.required ? `Required · weight ×${Number(n.weight).toFixed(1)}` : 'Not required for this role'}</span>
            <span>{evidence}</span>
        </>
    );
}

const SphereCard = ({ target, nodes }) => {
    const navigate = useNavigate();
    const { showTip, hideTip } = useFeedback();
    const [filter, setFilter] = useState('all');
    const [listView, setListView] = useState(false);
    const [paused, setPaused] = useState(false);

    const onHover = useCallback((node, x, y) => {
        if (node) showTip(nodeDetail(node), x, y);
        else hideTip();
    }, [showTip, hideTip]);

    const shown = nodes
        .filter(n => filter === 'all' || n.status === filter)
        .sort((a, b) => (SKILL_STATUS[a.status]?.order ?? 9) - (SKILL_STATUS[b.status]?.order ?? 9) || (b.weight || 0) - (a.weight || 0));

    const subtitle = target
        ? `Your resume${nodes.some(n => n.github) ? ' and GitHub' : ''} against every requirement for ${target.role_name}${target.jd_skill_count ? ' plus your job description' : ''}. Bigger nodes matter more; hollow rings are gaps.`
        : 'Start a mock interview for a role and your skills will be mapped against it here.';

    return (
        <article className="ps-card ps-sphere-card" aria-labelledby="ps-sphere-title">
            <div className="ps-card-head">
                <div>
                    <h2 className="ps-card-title" id="ps-sphere-title">Skill Sphere</h2>
                    <p className="ps-card-sub">{subtitle}</p>
                </div>
                {target && (
                    <div className="ps-head-actions">
                        <button className="ps-icon-btn" type="button" aria-pressed={listView} onClick={() => { setListView(v => !v); hideTip(); }}>List</button>
                        {!listView && (
                            <button
                                className="ps-icon-btn"
                                type="button"
                                onClick={() => setPaused(p => !p)}
                                aria-label={paused ? 'Resume rotation' : 'Pause rotation'}
                                title={paused ? 'Resume rotation' : 'Pause rotation'}
                            >
                                {paused ? <Play size={13} fill="currentColor" aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {!target ? (
                <div className="ps-stage">
                    <div className="ps-stage-note">
                        <div className="ps-empty" style={{ alignItems: 'center' }}>
                            <strong>No target role yet</strong>
                            <span>Choose a role in the Workspace and start a mock interview.</span>
                            <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/dashboard')}>Choose a role</button>
                        </div>
                    </div>
                </div>
            ) : listView ? (
                <div className="ps-sphere-list">
                    <ul>
                        {shown.map(n => (
                            <li key={n.name}>
                                <Swatch status={n.status} />
                                <span>{n.name}{n.github ? ' · GitHub' : ''}</span>
                                <span className="m">{n.required ? `weight ×${Number(n.weight).toFixed(1)}` : 'not required'}</span>
                            </li>
                        ))}
                    </ul>
                    {shown.length === 0 && <p className="ps-muted">No skills in this group.</p>}
                </div>
            ) : (
                <SkillSphere nodes={nodes} filter={filter} paused={paused} onHover={onHover} />
            )}

            {target && (
                <div className="ps-filters" role="group" aria-label="Filter skills">
                    {FILTERS.map(f => {
                        const count = f.key === 'all' ? nodes.length : nodes.filter(n => n.status === f.key).length;
                        return (
                            <button key={f.key} type="button" className="ps-fchip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                                {f.key !== 'all' && <Swatch status={f.key} />}
                                {f.label}
                                <span className="n">{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </article>
    );
};

export default SphereCard;
