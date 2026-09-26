import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Send } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import EvaluationConcepts, { ApproximateBadge } from './EvaluationConcepts';
import { countWords } from './format';

const MIN_ANSWER_WORDS = 4;

// Keyed by question id in the parent, so a new question starts with an empty answer box
// while a failed submission keeps the candidate's text.
const AnswerWorkspace = ({ loading, onSubmit }) => {
    const [answerText, setAnswerText] = useState('');
    const [hint, setHint] = useState('');
    const words = countWords(answerText);

    const submit = (e) => {
        if (e) e.preventDefault();
        if (words < MIN_ANSWER_WORDS) {
            setHint("Please provide a more complete answer before submitting.");
            return;
        }
        setHint('');
        onSubmit(answerText);
    };

    return (
        <div className="answer-workspace dash-glass">
            <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === 'Enter') submit(e);
                }}
                placeholder="Type your detailed explanation here (aim for clear concepts, concrete examples, and the trade-offs behind your decisions)..."
                rows={8}
                maxLength={8000}
                className="answer-textarea"
                aria-label="Your answer"
            />
            {hint && <p className="answer-hint">{hint}</p>}
            <div className="editor-toolbar">
                <div className="word-count-badge">
                    <span>Words: <strong>{words}</strong></span>
                    <span className="shortcut-hint">• Press <strong>Ctrl + Enter</strong> to submit</span>
                </div>
                <button
                    onClick={submit}
                    disabled={loading}
                    className="btn-continue-primary"
                    style={{ width: 'auto', padding: '10px 24px', margin: 0 }}
                >
                    {loading ? "Evaluating Answer..." : "Submit Answer"} <Send size={16} />
                </button>
            </div>
        </div>
    );
};

const InterviewStep = ({
    selectedRole, seniorityLevel, selectedCompany,
    question, questionNumber, totalQuestions, lastEvaluation, loading, onSubmit,
}) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* Question Header Status */}
        <div className="interview-top-bar">
            <div>
                <span className="session-role-tag" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {selectedCompany ? (
                        <>
                            <CompanyLogo company={selectedCompany} size={16} className="company-inline-logo" />
                            {selectedCompany.name} •&nbsp;
                        </>
                    ) : ''}
                    {selectedRole?.name} ({seniorityLevel})
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0 0 0' }}>Question {questionNumber} of {totalQuestions}</h2>
                {selectedCompany && (
                    <div className="company-context-pill">
                        <CompanyLogo company={selectedCompany} size={14} className="company-inline-logo" />
                        Targeting {selectedCompany.name} Interview Intel & Topics
                    </div>
                )}
            </div>
            <div className="difficulty-badge">
                <span>Difficulty: {question.difficulty}</span>
            </div>
        </div>

        <div className="interview-studio-grid">
            {/* Question Statement Card. Expected concepts stay hidden until the answer is evaluated. */}
            <div className="question-card-studio dash-glass">
                <div className="q-card-header">
                    <Brain size={20} color="var(--dash-accent)" />
                    <span>INTERVIEW QUESTION</span>
                </div>
                <p className="q-text">{question.question_text}</p>
            </div>

            {/* Previous Rubric Feedback */}
            {lastEvaluation && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="previous-eval-card">
                    <div className="eval-card-header">
                        <div className="eval-score-chip">
                            Score: {lastEvaluation.score} / 10
                        </div>
                        <span className="eval-title">Previous Question Rubric Result</span>
                        {lastEvaluation.evaluator === 'fallback' && <ApproximateBadge />}
                    </div>
                    <p className="eval-feedback">{lastEvaluation.feedback}</p>
                    <EvaluationConcepts detected={lastEvaluation.detected_concepts} missing={lastEvaluation.missing_concepts} />
                </motion.div>
            )}

            {/* Candidate Answer Workspace */}
            <AnswerWorkspace key={question.id} loading={loading} onSubmit={onSubmit} />
        </div>
    </motion.div>
);

export default InterviewStep;
