import React from 'react';

const PLACEHOLDER = /(\[(?:company|college|name|hidden|email hidden|phone hidden|link hidden|handle hidden)\])/;

/** Free text with the server's redaction markers shown as quiet tags. */
const Redacted = ({ text }) => (
    <>
        {String(text).split(PLACEHOLDER).map((part, i) => (
            PLACEHOLDER.test(part)
                ? <span key={i} className="sc-redacted" title="Hidden to protect privacy">{part.slice(1, -1)}</span>
                : <React.Fragment key={i}>{part}</React.Fragment>
        ))}
    </>
);

const Chips = ({ items }) => (items && items.length > 0 ? (
    <div className="ps-chips">{items.map(t => <span key={t} className="ps-chip">{t}</span>)}</div>
) : null);

const Hidden = ({ what }) => <span className="sc-hidden">{what} hidden</span>;

const joinParts = (parts) => parts.filter(Boolean).reduce((acc, part, i) => (i ? [...acc, ' · ', part] : [part]), []);

/** A published (or previewed) resume: only the redacted copy the server sends. */
const ResumeView = ({ entry }) => {
    const groups = Object.entries(entry.skill_groups || {}).filter(([, list]) => list && list.length);
    const empty = !groups.length && !entry.experience_items.length && !entry.project_items.length
        && !entry.education_items.length && !entry.certification_items.length;

    return (
        <div className="sc-resume">
            {groups.length > 0 && (
                <section className="sc-section" aria-label="Skills">
                    <h3>Skills</h3>
                    <div className="sc-skill-groups">
                        {groups.map(([category, list]) => (
                            <div className="sc-skill-group" key={category}>
                                <span>{category}</span>
                                <Chips items={list} />
                            </div>
                        ))}
                        {entry.github_skills?.length > 0 && (
                            <div className="sc-skill-group">
                                <span>Shown on GitHub</span>
                                <Chips items={entry.github_skills} />
                            </div>
                        )}
                    </div>
                </section>
            )}

            {entry.experience_items.length > 0 && (
                <section className="sc-section" aria-label="Experience">
                    <h3>Experience</h3>
                    <ul className="sc-entries">
                        {entry.experience_items.map((item, i) => (
                            <li className="sc-entry" key={i}>
                                <div>
                                    <strong><Redacted text={item.role} /></strong>
                                    <span className="sc-entry-sub">
                                        {joinParts([item.company ? <Redacted key="c" text={item.company} /> : <Hidden key="c" what="Company" />, item.duration])}
                                    </span>
                                    {item.points.length > 0 && <ul>{item.points.map((p, j) => <li key={j}><Redacted text={p} /></li>)}</ul>}
                                    <Chips items={item.technologies} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {entry.project_items.length > 0 && (
                <section className="sc-section" aria-label="Projects">
                    <h3>Projects</h3>
                    <ul className="sc-entries">
                        {entry.project_items.map((item, i) => (
                            <li className="sc-entry" key={i}>
                                <div>
                                    <strong><Redacted text={item.name} /></strong>
                                    {item.domain && <span className="sc-entry-sub">{item.domain}</span>}
                                    {item.description && <p><Redacted text={item.description} /></p>}
                                    <Chips items={item.technologies} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {entry.education_items.length > 0 && (
                <section className="sc-section" aria-label="Education">
                    <h3>Education</h3>
                    <ul className="sc-entries">
                        {entry.education_items.map((item, i) => (
                            <li className="sc-entry" key={i}>
                                <div>
                                    <strong><Redacted text={[item.degree, item.field].filter(Boolean).join(', ')} /></strong>
                                    <span className="sc-entry-sub">
                                        {joinParts([item.institution ? <Redacted key="i" text={item.institution} /> : <Hidden key="i" what="College" />, item.year, item.grade])}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {entry.certification_items.length > 0 && (
                <section className="sc-section" aria-label="Certifications">
                    <h3>Certifications</h3>
                    <ul className="sc-entries">
                        {entry.certification_items.map((item, i) => (
                            <li className="sc-entry" key={i}>
                                <div>
                                    <strong><Redacted text={item.name} /></strong>
                                    {(item.issuer || item.year) && <span className="sc-entry-sub">{joinParts([item.issuer, item.year])}</span>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {empty && <p className="ps-muted">No sections could be read from this resume.</p>}
        </div>
    );
};

export default ResumeView;
