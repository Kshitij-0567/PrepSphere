import React, { useState } from 'react';
import { Github, Linkedin, Loader2 } from 'lucide-react';
import api, { apiErrorMessage } from '../../api/client';
import { useFeedback } from '../../components/ui/feedbackContext';
import { isValidLink } from '../../utils/format';

const KINDS = {
    linkedin: {
        name: 'LinkedIn',
        icon: Linkedin,
        placeholder: 'linkedin.com/in/your-name',
        help: 'Shown on your profile. LinkedIn does not let apps import profile data, so only the link is saved.',
        emptyHint: 'Add your profile link',
        invalid: 'Enter a LinkedIn profile URL, for example linkedin.com/in/your-name.',
        display: (v) => `linkedin.com/in/${v}`,
    },
    github: {
        name: 'GitHub',
        icon: Github,
        placeholder: 'github.com/your-name or your-name',
        help: 'PrepSphere reads your public repositories and counts their languages and topics as skill evidence.',
        emptyHint: 'Import repos as skill evidence',
        invalid: 'Enter a GitHub username or profile URL, for example github.com/your-name.',
        display: (v) => `github.com/${v}`,
    },
};

const LinkRow = ({ kind, links, github, editing, onEdit, onDone }) => {
    const { toast } = useFeedback();
    const config = KINDS[kind];
    const Icon = config.icon;
    const value = links?.[kind];
    const url = links?.[`${kind}_url`];
    const [draft, setDraft] = useState(value ? config.display(value) : '');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async (nextValue) => {
        setSaving(true);
        setError('');
        try {
            const res = await api.put('/profile/links', { [kind]: nextValue });
            if (res.data.warning) toast(res.data.warning, { error: true, duration: 6000 });
            else if (!nextValue) toast(`${config.name} link removed.`);
            else if (kind === 'github') toast(`GitHub imported: ${res.data.github?.skills?.length || 0} skills found in your public repositories.`);
            else toast('LinkedIn link saved to your profile.');
            onDone(true);
        } catch (err) {
            setError(apiErrorMessage(err, `Could not save your ${config.name} link.`));
        }
        setSaving(false);
    };

    const submit = (e) => {
        e.preventDefault();
        if (!isValidLink(kind, draft)) {
            setError(config.invalid);
            return;
        }
        save(draft.trim());
    };

    if (editing) {
        const inputId = `ps-${kind}-input`;
        return (
            <form className="ps-link-row is-editing" onSubmit={submit} noValidate onKeyDown={(e) => { if (e.key === 'Escape') onDone(false); }}>
                <span className="ps-brand-ico"><Icon size={17} aria-hidden="true" /></span>
                <div className="ps-link-edit">
                    <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 600 }}>{config.name} profile</label>
                    <input
                        id={inputId}
                        className="ps-input"
                        type="text"
                        inputMode="url"
                        autoComplete="url"
                        spellCheck={false}
                        autoFocus
                        placeholder={config.placeholder}
                        value={draft}
                        onChange={(e) => { setDraft(e.target.value); setError(''); }}
                        aria-invalid={error ? 'true' : 'false'}
                        aria-describedby={`${inputId}-help ${inputId}-error`}
                        disabled={saving}
                    />
                    <p className="ps-help" id={`${inputId}-help`}>{config.help}</p>
                    {error && <p className="ps-error-text" id={`${inputId}-error`} role="alert">{error}</p>}
                    <div className="ps-link-actions">
                        <button className="ps-btn ps-btn-sm ps-btn-primary" type="submit" disabled={saving}>
                            {saving && <Loader2 size={13} className="ps-spin" aria-hidden="true" />}
                            {saving ? (kind === 'github' ? 'Importing…' : 'Saving…') : (kind === 'github' ? 'Save and import' : 'Save')}
                        </button>
                        <button className="ps-btn ps-btn-sm" type="button" onClick={() => onDone(false)} disabled={saving}>Cancel</button>
                        {value && (
                            <button className="ps-btn ps-btn-sm ps-btn-ghost ps-btn-danger" type="button" onClick={() => save(null)} disabled={saving}>
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            </form>
        );
    }

    if (value) {
        let detail = null;
        if (kind === 'github') {
            detail = github
                ? <span className="ps-muted">{github.public_repos} repositories imported</span>
                : <span className="ps-muted">Import not finished yet</span>;
        }
        return (
            <div className="ps-link-row">
                <span className="ps-brand-ico"><Icon size={17} aria-hidden="true" /></span>
                <div className="ps-link-main">
                    <strong>{config.name}</strong>
                    <a href={url} target="_blank" rel="noopener noreferrer">{config.display(value)}</a>
                    {detail}
                </div>
                <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={onEdit} aria-label={`Edit ${config.name} link`}>Edit</button>
            </div>
        );
    }

    return (
        <div className="ps-link-row is-empty">
            <span className="ps-brand-ico"><Icon size={17} aria-hidden="true" /></span>
            <div className="ps-link-main">
                <strong>{config.name}</strong>
                <span className="ps-muted">{config.emptyHint}</span>
            </div>
            <button className="ps-btn ps-btn-sm" type="button" onClick={onEdit}>Add</button>
        </div>
    );
};

// Only one link is edited at a time; `onChanged` reloads whatever the page shows.
const LinkedProfiles = ({ links, github, onChanged }) => {
    const [editing, setEditing] = useState(null);
    const done = (changed) => {
        setEditing(null);
        if (changed) onChanged();
    };
    return (
        <div className="ps-links">
            {Object.keys(KINDS).map(kind => (
                <LinkRow
                    key={`${kind}-${editing === kind ? 'edit' : 'view'}-${links?.[kind] || ''}`}
                    kind={kind}
                    links={links}
                    github={github}
                    editing={editing === kind}
                    onEdit={() => setEditing(kind)}
                    onDone={done}
                />
            ))}
        </div>
    );
};

export default LinkedProfiles;
