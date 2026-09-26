import React from 'react';

// Shows which expected concepts an answer covered, once the question has been answered.
const EvaluationConcepts = ({ detected = [], missing = [] }) => {
    if (!detected.length && !missing.length) return null;
    return (
        <div className="eval-concepts">
            {detected.map(c => <span key={`d-${c}`} className="eval-concept covered">✓ {c}</span>)}
            {missing.map(c => <span key={`m-${c}`} className="eval-concept missed">✕ {c}</span>)}
        </div>
    );
};

export const ApproximateBadge = () => (
    <span className="approx-badge" title="The AI evaluator was unavailable, so this score comes from an automatic keyword and depth check.">
        Approximate score
    </span>
);

export default EvaluationConcepts;
