import React from 'react';
import { motion } from 'framer-motion';
import { Award, Info, ListChecks, RefreshCw } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import EvaluationConcepts, { ApproximateBadge } from './EvaluationConcepts';

const ResultsStep = ({ results, selectedRole, seniorityLevel, selectedCompany, onRestart }) => {
    const recommendations = results.recommendations || [];

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Results Header Banner */}
            <div className="results-score-banner dash-glass">
                <div className="banner-trophy">
                    <Award size={52} color="var(--dash-success)" />
                </div>
                <h2>Interview Evaluation Complete</h2>
                <p>
                    Target Role: <strong>{results.role_name || selectedRole?.name} ({results.seniority || seniorityLevel} Level)</strong>
                    {selectedCompany
                        ? <span> • Target Company: <strong style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center' }}><CompanyLogo company={selectedCompany} size={18} className="company-inline-logo" /> {selectedCompany.name}</strong></span>
                        : results.company_name && <span> • Target Company: <strong style={{ color: '#10b981' }}>{results.company_name}</strong></span>}
                </p>

                <div className="final-score-display">
                    <span className="score-num">{results.overall_score}</span>
                    <span className="score-denom">/ 10</span>
                </div>
            </div>

            {results.used_fallback_evaluator && (
                <div className="fallback-notice">
                    <Info size={16} />
                    <span>
                        The AI evaluator was unavailable for some answers, so those scores come from an automatic
                        keyword and depth check and are approximate.
                    </span>
                </div>
            )}

            {/* Question Breakdown */}
            <h3 className="results-section-title">Detailed Rubric Evaluation</h3>
            <div className="evaluations-stack">
                {results.evaluations?.map((item, idx) => (
                    <div key={item.question_id || idx} className="evaluation-row-card dash-glass">
                        <div className="eval-row-header">
                            <strong className="eval-q-title">Q{idx + 1}: {item.question}</strong>
                            <span className="eval-q-score">
                                {item.score} / 10 {item.evaluator === 'fallback' && <ApproximateBadge />}
                            </span>
                        </div>
                        <p className="eval-user-ans"><strong>Your Answer:</strong> {item.user_answer}</p>
                        <div className="eval-rubric-box">
                            <strong>Rubric Feedback:</strong> {item.feedback}
                            <EvaluationConcepts detected={item.detected_concepts} missing={item.missing_concepts} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Prioritized Recommendations (SRS FR-15) */}
            {recommendations.length > 0 && (
                <div className="recommendations-container dash-glass">
                    <h3 className="results-section-title" style={{ marginTop: 0 }}>
                        <ListChecks size={20} color="var(--dash-accent)" /> Prioritized Action Plan & Study Recommendations
                    </h3>
                    <div className="recommendations-grid">
                        {recommendations.map(rec => (
                            <div key={rec.id} className="recommendation-card">
                                <div className="rec-card-header">
                                    <strong className="rec-topic">{rec.topic}</strong>
                                    <span className={`priority-tag ${rec.priority?.toLowerCase()}`}>
                                        {rec.priority} Priority
                                    </span>
                                </div>
                                <p className="rec-reason">{rec.reason}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginTop: '36px' }}>
                <button
                    onClick={onRestart}
                    className="btn-continue-primary"
                    style={{ maxWidth: '300px' }}
                >
                    <RefreshCw size={16} /> Practice Another Session
                </button>
            </div>
        </motion.div>
    );
};

export default ResultsStep;
