import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
    { key: 'role', label: 'Target Role' },
    { key: 'company', label: 'Target Company' },
    { key: 'resume', label: 'Resume' },
    { key: 'skill-gap', label: 'Skill Gap' },
    { key: 'interview', label: 'Interview' },
    { key: 'results', label: 'Results' },
];

// Interactive Stepper Navigation Bar: completed steps can be revisited.
const Stepper = ({ step, onNavigate }) => {
    const currentIndex = STEPS.findIndex(s => s.key === step);

    return (
        <div className="stepper-container dash-glass">
            {STEPS.map(({ key, label }, idx) => {
                const isActive = step === key;
                const isDone = currentIndex > idx;

                return (
                    <button
                        key={key}
                        className={`step-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                        onClick={() => {
                            if (isDone) onNavigate(key);
                        }}
                    >
                        <div className="step-circle">
                            {isDone ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className="step-label">{label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default Stepper;
