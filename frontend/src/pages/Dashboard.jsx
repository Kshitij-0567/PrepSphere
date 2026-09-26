import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, LogOut } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { clearSession } from '../api/session';
import ParticleCanvas from '../components/ParticleCanvas';
import Stepper from './dashboard/Stepper';
import RoleStep from './dashboard/RoleStep';
import CompanyStep from './dashboard/CompanyStep';
import ResumeStep from './dashboard/ResumeStep';
import SkillGapStep from './dashboard/SkillGapStep';
import InterviewStep from './dashboard/InterviewStep';
import ResultsStep from './dashboard/ResultsStep';
import './Dashboard.css';

const DEFAULT_COMPANY = 'google';
const MAX_RESUME_MB = 10; // keep in sync with MAX_RESUME_MB on the backend

const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');

    // Workflow Steps: 'role', 'company', 'resume', 'skill-gap', 'interview', 'results'
    const [step, setStep] = useState('role');

    // Role Selection State & Filters
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [seniorityLevel, setSeniorityLevel] = useState('Mid'); // 'Junior', 'Mid', 'Senior'

    // Optional Job Description
    const [jdText, setJdText] = useState('');
    const [jdAnalysis, setJdAnalysis] = useState(null);
    const [analyzingJd, setAnalyzingJd] = useState(false);
    const [jdError, setJdError] = useState('');

    // Target Company Selection
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const companyChosen = useRef(false);

    // Resume & Skill Gap State
    const [savedResumes, setSavedResumes] = useState([]);
    const [activeResumeId, setActiveResumeId] = useState(null);
    const [busyResumeId, setBusyResumeId] = useState(null);
    const [resumeQuality, setResumeQuality] = useState(null);
    const [skillGapData, setSkillGapData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Interview Session State
    const [interviewId, setInterviewId] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [questionNumber, setQuestionNumber] = useState(1);
    const [totalQuestions, setTotalQuestions] = useState(5);
    const [lastEvaluation, setLastEvaluation] = useState(null);
    const [finalResults, setFinalResults] = useState(null);

    // Initial data loads once. (Re-running on every step change used to reset the chosen
    // role to the first role and the chosen company back to the default.)
    useEffect(() => {
        let cancelled = false;
        const report = (fallback) => (err) => {
            if (!cancelled) setError(apiErrorMessage(err, fallback));
        };

        api.get('/users/me')
            .then(res => { if (!cancelled) setUser(res.data); })
            .catch(() => { /* an expired session is handled by the API client */ });

        api.get('/roles')
            .then(res => {
                if (cancelled) return;
                setRoles(res.data);
                setSelectedRole(prev => prev ?? res.data[0] ?? null);
            })
            .catch(report('Could not load the role catalog.'));

        api.get('/companies')
            .then(res => {
                if (cancelled) return;
                setCompanies(res.data);
                if (!companyChosen.current) {
                    setSelectedCompany(res.data.find(c => c.name.toLowerCase() === DEFAULT_COMPANY) || null);
                }
            })
            .catch(report('Could not load companies.'));

        api.get('/resumes')
            .then(res => {
                if (cancelled) return;
                setSavedResumes(res.data);
                setActiveResumeId(res.data.find(r => r.is_active)?.id ?? null);
            })
            .catch(report('Could not load your saved resumes.'));

        return () => { cancelled = true; };
    }, []);

    const refreshSavedResumes = async () => {
        try {
            const res = await api.get('/resumes');
            setSavedResumes(res.data);
            setActiveResumeId(res.data.find(r => r.is_active)?.id ?? null);
        } catch (err) {
            console.error("Error refreshing saved resumes:", err);
        }
    };

    // --- Role & job description ---
    const handleSelectRole = (role) => {
        if (role.id !== selectedRole?.id) setSkillGapData(null);
        setSelectedRole(role);
    };

    const handleJdTextChange = (text) => {
        setJdText(text);
        setJdAnalysis(null);   // an edited JD needs re-analysis
        setJdError('');
    };

    const handleAnalyzeJd = async () => {
        setAnalyzingJd(true);
        setJdError('');
        try {
            const res = await api.post('/jobs/analyze', { jd_text: jdText, role_title: selectedRole?.name });
            setJdAnalysis(res.data);
        } catch (err) {
            setJdError(apiErrorMessage(err, 'Could not analyze the job description.'));
        }
        setAnalyzingJd(false);
    };

    const handleClearJd = () => {
        setJdText('');
        setJdAnalysis(null);
        setJdError('');
    };

    const jdRequiredSkills = jdAnalysis ? jdAnalysis.required_skills.map(s => s.name) : [];

    // --- Company ---
    const handleSelectCompany = (company) => {
        companyChosen.current = true;
        setSelectedCompany(company);
    };

    // --- Resume & skill gap (SRS FR-04 to FR-08) ---
    const loadSkillGap = async () => {
        const params = { role_id: selectedRole.id };
        if (jdRequiredSkills.length) params.jd_skills = jdRequiredSkills.join(',');
        const res = await api.get('/skill-gaps', { params });
        setSkillGapData(res.data);
    };

    const activateResume = async (request, fallbackMessage) => {
        if (!selectedRole) return;
        setLoading(true);
        setError('');
        try {
            const res = await request();
            setActiveResumeId(res.data.resume_id);
            setResumeQuality(res.data.quality_analysis || null);
            await loadSkillGap();
            refreshSavedResumes();
            setStep('skill-gap');
        } catch (err) {
            setError(apiErrorMessage(err, fallbackMessage));
        }
        setLoading(false);
    };

    const handleUpload = (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return activateResume(() => api.post('/resumes/upload', formData), 'Error processing resume.');
    };

    const handleUseSaved = async (resumeId) => {
        setBusyResumeId(resumeId);
        await activateResume(() => api.post(`/resumes/${resumeId}/select`), 'Error selecting saved resume.');
        setBusyResumeId(null);
    };

    const handleDeleteSaved = async (resume) => {
        if (!window.confirm(`Delete "${resume.filename}" from your saved resumes?`)) return;
        try {
            const res = await api.delete(`/resumes/${resume.id}`);
            setSavedResumes(prev => prev.filter(r => r.id !== resume.id));
            if (res.data.was_active) {
                setActiveResumeId(null);
                setResumeQuality(null);
                setSkillGapData(null);
            }
        } catch (err) {
            setError(apiErrorMessage(err, 'Error deleting saved resume.'));
        }
    };

    // --- Mock interview (SRS FR-09 to FR-14) ---
    const startInterview = async () => {
        if (!selectedRole) return;
        setLoading(true);
        setError('');
        try {
            const payload = {
                role_id: selectedRole.id,
                company_id: selectedCompany ? selectedCompany.id : null,
                seniority: seniorityLevel,
            };
            if (jdAnalysis && jdText.trim()) payload.job_description = jdText;
            const res = await api.post('/interviews', payload);
            setInterviewId(res.data.interview_id);
            setCurrentQuestion(res.data.question);
            setTotalQuestions(res.data.total_questions || 5);
            setQuestionNumber(1);
            setLastEvaluation(null);
            setFinalResults(null);
            setStep('interview');
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to start interview.'));
        }
        setLoading(false);
    };

    const handleAnswerSubmit = async (answerText) => {
        setLoading(true);
        setError('');
        try {
            const res = await api.post(`/interviews/${interviewId}/answers`, {
                question_id: currentQuestion.id,
                answer_text: answerText
            });
            setLastEvaluation(res.data.evaluation);

            if (res.data.status === 'completed') {
                const resultRes = await api.get(`/interviews/${interviewId}/results`);
                setFinalResults(resultRes.data);
                setStep('results');
            } else {
                setCurrentQuestion(res.data.next_question);
                setQuestionNumber(res.data.questions_answered + 1);
            }
        } catch (err) {
            setError(apiErrorMessage(err, 'Error evaluating answer.'));
        }
        setLoading(false);
    };

    const handleNavigate = (target) => {
        if (step === 'interview' && !window.confirm('Leave this interview? It will stay unfinished.')) return;
        setStep(target);
    };

    const handleRestart = () => {
        setStep('role');
        setSkillGapData(null);
        setInterviewId(null);
        setCurrentQuestion(null);
        setLastEvaluation(null);
        setFinalResults(null);
    };

    const handleLogout = () => {
        clearSession();
        navigate('/login');
    };

    return (
        <div className="dashboard-root">
            <ParticleCanvas />
            {/* Header Toolbar */}
            <header className="dash-header">
                <div
                    className="dash-logo-btn"
                    onClick={() => navigate('/')}
                    title="Go to Homepage"
                >
                    <div className="dash-brand-logo">
                        <Brain size={18} />
                    </div>
                    <span className="dash-brand-title">PrepSphere</span>
                    <span className="dash-brand-tag">Interactive Workspace</span>
                </div>

                <div className="dash-user-info">
                    <div className="dash-user-badge">
                        <span className="user-online-dot"></span>
                        <span className="dash-user-name">{user?.name || user?.email || 'Candidate'}</span>
                    </div>
                    <button onClick={handleLogout} className="dash-logout-btn">
                        <LogOut size={15} /> Logout
                    </button>
                </div>
            </header>

            {/* Main Content Container */}
            <main className="dash-main">
                <Stepper step={step} onNavigate={handleNavigate} />

                {error && (
                    <div className="dash-error-banner" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={() => setError('')} aria-label="Dismiss error">✕</button>
                    </div>
                )}

                {step === 'role' && (
                    <RoleStep
                        roles={roles}
                        selectedRole={selectedRole}
                        onSelectRole={handleSelectRole}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        seniorityLevel={seniorityLevel}
                        onSeniorityChange={setSeniorityLevel}
                        jd={{
                            text: jdText,
                            onTextChange: handleJdTextChange,
                            analysis: jdAnalysis,
                            analyzing: analyzingJd,
                            error: jdError,
                            onAnalyze: handleAnalyzeJd,
                            onClear: handleClearJd,
                        }}
                        onContinue={() => setStep('company')}
                    />
                )}

                {step === 'company' && (
                    <CompanyStep
                        companies={companies}
                        selectedCompany={selectedCompany}
                        onSelectCompany={handleSelectCompany}
                        selectedRole={selectedRole}
                        seniorityLevel={seniorityLevel}
                        onContinue={() => setStep('resume')}
                    />
                )}

                {step === 'resume' && (
                    <ResumeStep
                        selectedRole={selectedRole}
                        seniorityLevel={seniorityLevel}
                        selectedCompany={selectedCompany}
                        savedResumes={savedResumes}
                        activeResumeId={activeResumeId}
                        busyResumeId={busyResumeId}
                        loading={loading}
                        maxResumeMb={MAX_RESUME_MB}
                        onUseSaved={handleUseSaved}
                        onDeleteSaved={handleDeleteSaved}
                        onUpload={handleUpload}
                    />
                )}

                {step === 'skill-gap' && (skillGapData ? (
                    <SkillGapStep
                        skillGapData={skillGapData}
                        quality={resumeQuality}
                        jdSkillCount={jdRequiredSkills.length}
                        loading={loading}
                        onStartInterview={startInterview}
                    />
                ) : (
                    <div className="dash-empty-step dash-glass">
                        <p>Select or upload a resume to see your skill gap for {selectedRole?.name}.</p>
                        <button className="btn-continue-primary" style={{ maxWidth: '280px' }} onClick={() => setStep('resume')}>
                            Choose a Resume
                        </button>
                    </div>
                ))}

                {step === 'interview' && currentQuestion && (
                    <InterviewStep
                        selectedRole={selectedRole}
                        seniorityLevel={seniorityLevel}
                        selectedCompany={selectedCompany}
                        question={currentQuestion}
                        questionNumber={questionNumber}
                        totalQuestions={totalQuestions}
                        lastEvaluation={lastEvaluation}
                        loading={loading}
                        onSubmit={handleAnswerSubmit}
                    />
                )}

                {step === 'results' && finalResults && (
                    <ResultsStep
                        results={finalResults}
                        selectedRole={selectedRole}
                        seniorityLevel={seniorityLevel}
                        selectedCompany={selectedCompany}
                        onRestart={handleRestart}
                    />
                )}
            </main>
        </div>
    );
};

export default Dashboard;
