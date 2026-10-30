import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { Delta, MetricValue } from './ShowcaseParts';
import { METRICS } from './showcaseData';

const importance = (weight) => (weight >= 2 ? 'Critical' : weight >= 1.5 ? 'High' : 'Standard');

const Has = ({ yes, who }) => (yes
    ? <span className="sc-yes" title={`${who} has it`}><Check size={16} aria-hidden="true" /><span className="ps-sr-only">{who} has it</span></span>
    : <span className="sc-no" title={`${who} does not`}><Minus size={16} aria-hidden="true" /><span className="ps-sr-only">{who} does not</span></span>);

const SkillColumn = ({ title, items, tone, empty }) => (
    <div>
        <p className="sc-col-title">{title} <span className="n">{items.length}</span></p>
        {items.length === 0 ? <p className="ps-muted">{empty}</p> : (
            <div className="ps-chips">{items.map(s => <span key={s} className={`ps-chip ${tone}`}>{s}</span>)}</div>
        )}
    </div>
);

/** The viewer's active resume next to a published one, measured against the published one's role. */
const CompareView = ({ data }) => {
    const them = data.them;
    const you = data.you;
    return (
        <>
            {!data.has_resume && (
                <div className="ps-banner ps-banner-warn">
                    <span>You have no active resume, so only their side is shown.</span>
                    <Link className="ps-btn ps-btn-sm" to="/resumes">Upload resume</Link>
                </div>
            )}

            <article className="ps-card" aria-labelledby="sc-cmp-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="sc-cmp-title">You and {them.name}</h2>
                        <p className="ps-card-sub">Both measured against {data.role.name}. Your side uses your active resume and your mock interviews for this role.</p>
                    </div>
                </div>
                <div className="bm-table-wrap">
                    <table className="bm-table">
                        <thead>
                            <tr>
                                <th scope="col">Section</th>
                                <th scope="col" className="num">You</th>
                                <th scope="col" className="num">{them.anonymous ? 'Them' : them.name}</th>
                                <th scope="col"><span className="ps-sr-only">Gap</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {METRICS.map(m => (
                                <tr key={m.key}>
                                    <td className="bm-metric"><strong>{m.label}</strong>{m.hint && <span>{m.hint}</span>}</td>
                                    <td className="num is-you"><MetricValue metric={m} value={you?.[m.key]} /></td>
                                    <td className="num"><MetricValue metric={m} value={them[m.key]} /></td>
                                    <td><Delta metric={m} value={you?.[m.key]} against={them[m.key]} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </article>

            <article className="ps-card" aria-labelledby="sc-cmp-skills">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="sc-cmp-skills">Skills</h2>
                        <p className="ps-card-sub">Every skill on either profile, including skills shown on GitHub.</p>
                    </div>
                </div>
                <div className="sc-split3">
                    <SkillColumn title="Only they have" items={data.skills.only_them} tone="sc-chip-them" empty="Nothing you are missing." />
                    <SkillColumn title="You both have" items={data.skills.both} tone="sc-chip-both" empty="No skills in common." />
                    <SkillColumn title="Only you have" items={data.skills.only_you} tone="sc-chip-you" empty={data.has_resume ? 'Nothing extra.' : 'No resume yet.'} />
                </div>
            </article>

            <article className="ps-card" aria-labelledby="sc-cmp-reqs">
                <div className="ps-card-head bm-head-wrap">
                    <div>
                        <h2 className="ps-card-title" id="sc-cmp-reqs">What {data.role.name} asks for</h2>
                        <p className="ps-card-sub">The role's required skills, most important first.</p>
                    </div>
                    <Link className="ps-btn ps-btn-sm" to="/skill-gaps">Open skill gaps</Link>
                </div>
                <div className="bm-table-wrap">
                    <table className="bm-table">
                        <thead>
                            <tr>
                                <th scope="col">Skill</th>
                                <th scope="col">Importance</th>
                                <th scope="col">You</th>
                                <th scope="col">{them.anonymous ? 'Them' : them.name}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.requirements.map(r => (
                                <tr key={r.name}>
                                    <td style={{ color: 'var(--ink)', fontWeight: 600 }}>{r.name}</td>
                                    <td>{importance(r.weight)}</td>
                                    <td><Has yes={r.you} who="You" /></td>
                                    <td><Has yes={r.them} who="They" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
};

export default CompareView;
