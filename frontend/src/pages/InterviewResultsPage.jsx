import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import ResultsStep from './dashboard/ResultsStep';
import VideoResults from './interview/results/VideoResults';
import { resumePath } from '../utils/format';
import './Dashboard.css';

const InterviewResultsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.get(`/interviews/${id}/results`)
            .then(res => { if (!cancelled) setResults(res.data); })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load these results.')); });
        return () => { cancelled = true; };
    }, [id]);

    if (results && results.status === 'completed' && results.mode === 'video') {
        return <div className="ps-page"><VideoResults results={results} /></div>;
    }

    return (
        <div className="ps-page">
            <div>
                <button className="ps-btn ps-btn-sm ps-btn-ghost" type="button" onClick={() => navigate('/interviews')}>
                    <ArrowLeft size={14} aria-hidden="true" /> All interviews
                </button>
            </div>
            {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
            {!results && !error && <div className="ps-skeleton" style={{ height: 320 }} />}
            {results && results.status !== 'completed' && (
                <div className="ps-card">
                    <div className="ps-empty">
                        <strong>This interview is not finished yet</strong>
                        <span>{results.questions_answered} of {results.total_questions} {results.mode === 'video' ? 'steps' : 'questions'} answered. Finish it to see your full results.</span>
                        <button className="ps-btn ps-btn-primary" type="button" onClick={() => navigate(resumePath({ id: results.interview_id, mode: results.mode }))}>Resume interview</button>
                    </div>
                </div>
            )}
            {results && results.status === 'completed' && (
                <div className="dashboard-embedded">
                    <ResultsStep
                        results={results}
                        selectedRole={{ name: results.role_name }}
                        seniorityLevel={results.seniority || 'Mid'}
                        selectedCompany={null}
                        onRestart={() => navigate('/dashboard')}
                    />
                </div>
            )}
        </div>
    );
};

export default InterviewResultsPage;
