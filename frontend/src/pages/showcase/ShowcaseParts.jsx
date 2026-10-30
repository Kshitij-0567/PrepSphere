import React from 'react';

export function MetricValue({ metric, value }) {
    if (value === null || value === undefined) return <span className="ps-muted">–</span>;
    return <>{metric.format(value)}{metric.suffix && <small>{metric.suffix}</small>}</>;
}

/** "+2" / "−0.5" against a reference value, or nothing when either side is missing. */
export function Delta({ metric, value, against, label }) {
    if (value === null || value === undefined || against === null || against === undefined) return null;
    const diff = value - against;
    if (Math.abs(diff) < metric.step / 2) return <span className="bm-delta is-even">Level{label ? ` with ${label}` : ''}</span>;
    return (
        <span className={`bm-delta ${diff > 0 ? 'is-up' : 'is-down'}`}>
            {diff > 0 ? '+' : '−'}{metric.format(Math.abs(diff))}{label ? ` vs ${label}` : ''}
        </span>
    );
}

/** Name, tags and score at the top of a showcase resume (the publish preview and the detail page). */
export function ShowcaseHeadline({ entry, children }) {
    return (
        <div className="sc-preview-head">
            <span className="ps-mini-avatar" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{entry.name}</strong>
                <span>{[entry.anonymous ? 'Anonymous' : null, entry.country?.name, entry.seniority, entry.role.name].filter(Boolean).join(' · ')}</span>
            </div>
            {children}
            <span className="sc-score"><b>{Math.round(entry.score)}</b><span>score</span></span>
        </div>
    );
}

export function CountrySelect({ id, countries, value, onChange, emptyLabel, counts, disabled }) {
    return (
        <select id={id} className="ps-input" value={value || ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled}>
            <option value="">{emptyLabel}</option>
            {counts && counts.length > 0 && (
                <optgroup label="With candidates">
                    {counts.map(c => <option key={`n-${c.code}`} value={c.code}>{c.name} ({c.count ?? c.candidates})</option>)}
                </optgroup>
            )}
            <optgroup label={counts && counts.length ? 'All countries' : 'Countries'}>
                {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </optgroup>
        </select>
    );
}
