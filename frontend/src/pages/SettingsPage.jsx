import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { clearSession } from '../api/session';
import { useApp } from '../components/layout/appContext';
import { useFeedback } from '../components/ui/feedbackContext';
import LinkedProfiles from './profile/LinkedProfiles';

const AccountForm = ({ user, onSaved }) => {
    const { toast } = useFeedback();
    const [name, setName] = useState(user.name || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Enter your name.'); return; }
        setSaving(true);
        setError('');
        try {
            const res = await api.patch('/users/me', { name: name.trim() });
            onSaved(res.data);
            toast('Your name was updated.');
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not update your name.'));
        }
        setSaving(false);
    };

    return (
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ps-field">
                <label htmlFor="ps-settings-name">Display name</label>
                <input id="ps-settings-name" className="ps-input" type="text" autoComplete="name" maxLength={120} value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }} aria-invalid={error ? 'true' : 'false'} />
                {error && <p className="ps-error-text" role="alert">{error}</p>}
            </div>
            <div className="ps-field">
                <label htmlFor="ps-settings-email">Email</label>
                <input id="ps-settings-email" className="ps-input" type="email" value={user.email} readOnly aria-describedby="ps-settings-email-help" />
                <p className="ps-help" id="ps-settings-email-help">Your email is your sign-in and cannot be changed here.</p>
            </div>
            <div>
                <button className="ps-btn ps-btn-primary" type="submit" disabled={saving || name.trim() === (user.name || '')}>
                    {saving && <Loader2 size={14} className="ps-spin" aria-hidden="true" />}
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </form>
    );
};

const SettingsPage = () => {
    const navigate = useNavigate();
    const { user, setUser } = useApp();
    const [links, setLinks] = useState(null);
    const [github, setGithub] = useState(null);
    const [error, setError] = useState('');

    const loadLinks = useCallback(() => api.get('/profile/summary')
        .then(res => { setLinks(res.data.links); setGithub(res.data.github); })
        .catch(err => setError(apiErrorMessage(err, 'Could not load your linked profiles.'))), []);

    useEffect(() => {
        let cancelled = false;
        api.get('/profile/summary')
            .then(res => { if (!cancelled) { setLinks(res.data.links); setGithub(res.data.github); } })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load your linked profiles.')); });
        return () => { cancelled = true; };
    }, []);

    const signOut = () => {
        clearSession();
        navigate('/login');
    };

    return (
        <div className="ps-page" style={{ maxWidth: 760 }}>
            <article className="ps-card" aria-labelledby="ps-acc-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="ps-acc-title">Account</h2>
                        <p className="ps-card-sub">How your name appears across PrepSphere.</p>
                    </div>
                </div>
                {user ? <AccountForm key={user.name || ''} user={user} onSaved={setUser} /> : <div className="ps-skeleton" style={{ height: 150 }} />}
            </article>

            <article className="ps-card" aria-labelledby="ps-links-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="ps-links-title">Linked profiles</h2>
                        <p className="ps-card-sub">Shown on your profile. GitHub repositories also count as skill evidence.</p>
                    </div>
                </div>
                {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
                {links ? <LinkedProfiles links={links} github={github} onChanged={loadLinks} /> : !error && <div className="ps-skeleton" style={{ height: 120 }} />}
            </article>

            <article className="ps-card" aria-labelledby="ps-session-title">
                <div className="ps-card-head" style={{ marginBottom: 12 }}>
                    <div>
                        <h2 className="ps-card-title" id="ps-session-title">Session</h2>
                        <p className="ps-card-sub">Sign out of PrepSphere on this device.</p>
                    </div>
                </div>
                <button className="ps-btn ps-btn-danger" type="button" onClick={signOut}><LogOut size={14} aria-hidden="true" /> Sign out</button>
            </article>
        </div>
    );
};

export default SettingsPage;
