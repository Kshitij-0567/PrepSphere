import React, { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useApp } from '../components/layout/appContext';
import ProfileCard from './profile/ProfileCard';
import SphereCard from './profile/SphereCard';
import ProgressCard from './profile/ProgressCard';
import { GitHubCard, Insights, NextStepCard, RecentInterviews, StatTiles, StudyPlanCard } from './profile/ProfileWidgets';

const LoadingState = () => (
    <div className="ps-layout" aria-busy="true" aria-label="Loading your profile">
        <div className="ps-skeleton" style={{ height: 620 }} />
        <div className="ps-content">
            <div className="ps-tiles">
                {[0, 1, 2].map(i => <div key={i} className="ps-skeleton" style={{ height: 118 }} />)}
            </div>
            <div className="ps-skeleton" style={{ height: 480 }} />
        </div>
    </div>
);

const ProfilePage = () => {
    const { refreshStats } = useApp();
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(() => {
        return api.get('/profile/summary')
            .then(res => { setSummary(res.data); setError(''); })
            .catch(err => setError(apiErrorMessage(err, 'Could not load your profile.')));
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get('/profile/summary')
            .then(res => { if (!cancelled) setSummary(res.data); })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load your profile.')); });
        return () => { cancelled = true; };
    }, []);

    const reload = useCallback(() => { load(); refreshStats(); }, [load, refreshStats]);

    if (!summary) {
        return error ? (
            <div className="ps-banner ps-banner-error" role="alert">
                <span>{error}</span>
                <button className="ps-btn ps-btn-sm" type="button" onClick={load}>Retry</button>
            </div>
        ) : <LoadingState />;
    }

    const hasGithub = Boolean(summary.links.github);

    return (
        <div className="ps-layout">
            <ProfileCard summary={summary} onChanged={reload} />
            <section className="ps-content" aria-label="Your progress">
                {error && (
                    <div className="ps-banner ps-banner-error" role="alert">
                        <span>{error}</span>
                        <button className="ps-btn ps-btn-sm" type="button" onClick={load}>Retry</button>
                    </div>
                )}
                <StatTiles summary={summary} />
                <div className="ps-row-hero">
                    <SphereCard target={summary.target} nodes={summary.sphere.nodes} />
                    <div className="ps-side-stack">
                        <Insights insights={summary.insights} />
                        <NextStepCard nextStep={summary.next_step} stats={summary.stats} />
                    </div>
                </div>
                <ProgressCard stats={summary.stats} quality={summary.quality} />
                <RecentInterviews interviews={summary.recent_interviews} total={summary.stats.total} />
                <div className={`ps-row-bottom ${hasGithub ? 'has-github' : ''}`}>
                    <StudyPlanCard plan={summary.study_plan} />
                    {hasGithub && (
                        <GitHubCard
                            github={summary.github}
                            username={summary.links.github}
                            url={summary.links.github_url}
                            nodes={summary.sphere.nodes}
                            onSynced={reload}
                        />
                    )}
                </div>
            </section>
        </div>
    );
};

export default ProfilePage;
