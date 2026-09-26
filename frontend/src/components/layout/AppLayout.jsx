import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    BookOpen, Building2, FileText, LayoutGrid, LogOut, Mic, PanelLeft, Play, Settings, Target, User,
} from 'lucide-react';
import api from '../../api/client';
import { clearSession } from '../../api/session';
import { initials } from '../../utils/format';
import FeedbackProvider from '../ui/FeedbackProvider';
import { AppContext, useMediaQuery } from './appContext';
import '../../styles/app.css';

const NAV = [
    {
        section: 'Prepare',
        items: [
            { to: '/dashboard', label: 'Workspace', icon: LayoutGrid },
            { to: '/interviews', label: 'Mock interviews', icon: Mic, badge: true },
            { to: '/resumes', label: 'Resumes', icon: FileText },
            { to: '/companies', label: 'Companies', icon: Building2 },
        ],
    },
    {
        section: 'Track',
        items: [
            { to: '/profile', label: 'My profile', icon: User },
            { to: '/skill-gaps', label: 'Skill gaps', icon: Target },
            { to: '/study-plan', label: 'Study plan', icon: BookOpen },
        ],
    },
];

const TITLES = {
    '/profile': 'My profile',
    '/dashboard': 'Workspace',
    '/interviews': 'Mock interviews',
    '/resumes': 'Resumes',
    '/companies': 'Companies',
    '/skill-gaps': 'Skill gaps',
    '/study-plan': 'Study plan',
    '/settings': 'Settings',
};

const COLLAPSE_KEY = 'prepsphere-nav-collapsed';

const LogoMark = ({ size = 19 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="6.5" />
        <ellipse cx="12" cy="12" rx="10.5" ry="3.6" transform="rotate(-24 12 12)" />
    </svg>
);

const AppLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isPhone = useMediaQuery('(max-width: 900px)');
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
    });
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const navRef = useRef(null);
    const toggleRef = useRef(null);

    const refreshStats = useCallback(() => {
        api.get('/users/stats').then(res => setStats(res.data)).catch(() => { /* badge is optional */ });
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get('/users/me').then(res => { if (!cancelled) setUser(res.data); }).catch(() => { /* 401 handled by the API client */ });
        return () => { cancelled = true; };
    }, []);

    // Keep the in-progress badge current as the user moves between pages.
    useEffect(() => {
        let cancelled = false;
        api.get('/users/stats').then(res => { if (!cancelled) setStats(res.data); }).catch(() => { /* optional */ });
        return () => { cancelled = true; };
    }, [location.pathname]);

    const drawerVisible = isPhone && drawerOpen;

    const toggleNav = useCallback(() => {
        if (isPhone) {
            setDrawerOpen(open => !open);
        } else {
            setCollapsed(value => {
                const next = !value;
                try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
                return next;
            });
        }
    }, [isPhone]);

    useEffect(() => {
        if (drawerVisible) navRef.current?.querySelector('a')?.focus();
    }, [drawerVisible]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && drawerVisible) {
                setDrawerOpen(false);
                toggleRef.current?.focus();
                return;
            }
            const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
            if (e.key === '[' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) toggleNav();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [drawerVisible, toggleNav]);

    const signOut = () => {
        clearSession();
        navigate('/login');
    };

    const closeDrawer = () => setDrawerOpen(false);
    const toggleLabel = isPhone ? (drawerOpen ? 'Close menu' : 'Open menu') : (collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    const title = TITLES[location.pathname] || (location.pathname.startsWith('/interviews/') ? 'Interview results' : 'PrepSphere');
    const inProgress = stats?.in_progress_interviews || 0;
    const appValue = useMemo(() => ({ user, setUser, stats, refreshStats }), [user, stats, refreshStats]);

    return (
        <AppContext.Provider value={appValue}>
            <FeedbackProvider>
                <div className="ps-app">
                    <div className={`ps-shell ${collapsed && !isPhone ? 'is-collapsed' : ''} ${drawerVisible ? 'nav-open' : ''}`}>
                        <nav className="ps-sidenav" id="ps-sidenav" aria-label="Main" ref={navRef} inert={isPhone && !drawerOpen}>
                            <Link to="/profile" className="ps-nav-brand" onClick={closeDrawer}>
                                <span className="ps-logo"><LogoMark /></span>
                                <span className="ps-nav-hide">PrepSphere</span>
                            </Link>
                            {NAV.map(group => (
                                <React.Fragment key={group.section}>
                                    <p className="ps-nav-section">{group.section}</p>
                                    {group.items.map(item => {
                                        const Icon = item.icon;
                                        return (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                end={item.to !== '/interviews'}
                                                className="ps-nav-link"
                                                title={item.label}
                                                onClick={closeDrawer}
                                            >
                                                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                                                <span className="ps-nav-hide">{item.label}</span>
                                                {item.badge && inProgress > 0 && (
                                                    <span className="ps-nav-badge" aria-label={`${inProgress} in progress`}>{inProgress}</span>
                                                )}
                                            </NavLink>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            <div className="ps-nav-spacer" />
                            <NavLink to="/settings" className="ps-nav-link" title="Settings" onClick={closeDrawer}>
                                <Settings size={19} strokeWidth={1.8} aria-hidden="true" />
                                <span className="ps-nav-hide">Settings</span>
                            </NavLink>
                            <div className="ps-nav-user" title={user?.email || ''}>
                                <span className="ps-mini-avatar" aria-hidden="true">{initials(user?.name, user?.email)}</span>
                                <div className="ps-nav-user-text ps-nav-hide">
                                    <strong>{user?.name || 'Your account'}</strong>
                                    <span>{user?.email || ''}</span>
                                </div>
                                <button type="button" className="ps-icon-plain" onClick={signOut} aria-label="Sign out" title="Sign out">
                                    <LogOut size={16} aria-hidden="true" />
                                </button>
                            </div>
                        </nav>
                        <button className="ps-nav-backdrop" type="button" aria-label="Close menu" hidden={!drawerVisible} onClick={closeDrawer} />

                        <div className="ps-main">
                            <header className="ps-topbar">
                                <button
                                    ref={toggleRef}
                                    className="ps-nav-toggle"
                                    type="button"
                                    onClick={toggleNav}
                                    aria-controls="ps-sidenav"
                                    aria-expanded={isPhone ? drawerOpen : !collapsed}
                                    aria-label={toggleLabel}
                                    title={isPhone ? toggleLabel : `${toggleLabel} ( [ )`}
                                >
                                    <PanelLeft size={18} strokeWidth={1.8} aria-hidden="true" />
                                </button>
                                <h1>{title}</h1>
                                <div className="ps-grow" />
                                {location.pathname !== '/dashboard' && (
                                    <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate('/dashboard')} aria-label="Start mock interview">
                                        <Play size={13} fill="currentColor" aria-hidden="true" />
                                        <span>Start mock interview</span>
                                    </button>
                                )}
                            </header>
                            <Suspense fallback={<div className="ps-skeleton" style={{ height: 320 }} aria-label="Loading page" />}>
                                <Outlet />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </FeedbackProvider>
        </AppContext.Provider>
    );
};

export default AppLayout;
