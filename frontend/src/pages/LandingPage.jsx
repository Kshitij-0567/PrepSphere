import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Brain, ArrowRight, CheckCircle2, ShieldCheck, Zap, 
    Terminal, Cpu, Database, Layers, Code2, 
    ChevronDown, ChevronRight, Sparkles, Building2, 
    BookOpen, ExternalLink, Activity, Compass, Binary,
    Check, X, Award, FileText, ChevronUp, Download
} from 'lucide-react';
import CurtainIntro from '../components/CurtainIntro';
import './LandingPage.css';

const WORKFLOW_STEPS = [
    {
        num: '01',
        title: 'Target Role Calibration',
        desc: 'Select your discipline from 34+ engineering tracks with standardized industry expectations.',
        icon: Compass
    },
    {
        num: '02',
        title: 'Deep Resume Parsing',
        desc: 'Extract your proven skills, normalizing variations and aliases into verified canonical competencies.',
        icon: FileText
    },
    {
        num: '03',
        title: 'Transparent Skill Gap Matrix',
        desc: 'Instantly visualize where you meet expectations and uncover critical gaps before real interviews.',
        icon: Layers
    },
    {
        num: '04',
        title: 'Rubric-Graded Mock Rounds',
        desc: 'Practice technical interview scenarios with immediate scoring on correctness, relevance, and key concepts.',
        icon: Award
    }
];

const CORE_CAPABILITIES = [
    {
        title: 'Canonical Skill Mapping',
        desc: "Standardizes variations like 'React', 'React.js', and 'ReactJS' into verified canonical benchmarks.",
        icon: Brain
    },
    {
        title: 'Weighted Readiness Scoring',
        desc: 'Calculates transparent readiness percentages weighted by what hiring teams actually prioritize.',
        icon: Zap
    },
    {
        title: 'Rubric-Based Assessment',
        desc: 'Scores answers across technical correctness, relevance, and completeness with concept-level feedback.',
        icon: ShieldCheck
    },
    {
        title: 'Targeted Action Plans',
        desc: 'Turn identified weaknesses into structured preparation steps with recommended topics and focus areas.',
        icon: Activity
    }
];

const TARGET_ROLES = [
    {
        id: 'cyber',
        title: 'Cybersecurity & Systems Engineer',
        category: 'SOFTWARE & SYSTEMS',
        skills: ['Linux Kernel', 'Cryptography', 'SIEM']
    },
    {
        id: 'ev',
        title: 'EV Powertrain & Battery Systems',
        category: 'CORE ENGINEERING',
        skills: ['BMS', 'Motor Control', 'Inverters']
    },
    {
        id: 'backend',
        title: 'Backend Systems Engineer',
        category: 'SOFTWARE & WEB',
        skills: ['FastAPI', 'PostgreSQL', 'Redis', 'Docker']
    },
    {
        id: 'mle',
        title: 'Machine Learning Engineer (MLE)',
        category: 'AI & DATA',
        skills: ['PyTorch', 'Transformers', 'CUDA', 'Python']
    },
    {
        id: 'vlsi',
        title: 'VLSI & ASIC Design Engineer',
        category: 'HARDWARE & VLSI',
        skills: ['Verilog', 'STA', 'ASIC Flow', 'FPGA']
    },
    {
        id: 'cloud',
        title: 'Cloud Platform Architect',
        category: 'CLOUD & DEVOPS',
        skills: ['Kubernetes', 'Terraform', 'AWS', 'Linux']
    },
    {
        id: 'robotics',
        title: 'Robotics & Autonomous Systems',
        category: 'HARDWARE & SYSTEMS',
        skills: ['ROS2', 'SLAM', 'C++', 'Kinematics']
    }
];

const TECH_STACK_ITEMS = [
    {
        name: 'Python',
        category: 'DATA & BACKEND CORE',
        desc: 'High-level, versatile language powering modern machine learning, distributed backends, and data science.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
        link: 'https://python.org'
    },
    {
        name: 'TypeScript',
        category: 'STATIC TYPED JAVASCRIPT',
        desc: 'Typed superset of JavaScript that compiles to plain JavaScript, providing strict type-safety for web applications.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
        link: 'https://typescriptlang.org'
    },
    {
        name: 'React',
        category: 'FRONTEND UI ENGINE',
        desc: 'Declarative component library for building highly interactive and reactive user interfaces.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
        link: 'https://react.dev'
    },
    {
        name: 'Next.js',
        category: 'FULL-STACK REACT FRAMEWORK',
        desc: 'Production-ready framework with hybrid static & server rendering, smart bundling, and route pre-fetching.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg',
        link: 'https://nextjs.org'
    },
    {
        name: 'Node.js',
        category: 'SERVER RUNTIME ENVIRONMENT',
        desc: 'Asynchronous event-driven JavaScript runtime built on Chromes V8 engine for scalable network apps.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
        link: 'https://nodejs.org'
    },
    {
        name: 'PyTorch',
        category: 'DEEP LEARNING PLATFORM',
        desc: 'Open source machine learning framework that accelerates the path from research prototyping to production.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg',
        link: 'https://pytorch.org'
    },
    {
        name: 'TensorFlow',
        category: 'END-TO-END ML TOOLKIT',
        desc: 'Comprehensive, flexible ecosystem of tools, libraries and community resources for machine learning workflows.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg',
        link: 'https://tensorflow.org'
    },
    {
        name: 'PostgreSQL',
        category: 'RELATIONAL SQL DATABASE',
        desc: 'Powerful, open-source object-relational database system with proven architecture, reliability, and data integrity.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg',
        link: 'https://postgresql.org'
    },
    {
        name: 'MongoDB',
        category: 'DOCUMENT DATA STORE',
        desc: 'Document-based distributed database designed for modern apps and flexible schema evolution.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg',
        link: 'https://mongodb.com'
    },
    {
        name: 'Redis',
        category: 'IN-MEMORY CACHE & STORE',
        desc: 'In-memory data structure store used as a distributed cache, message broker, and real-time streaming engine.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg',
        link: 'https://redis.io'
    },
    {
        name: 'Docker',
        category: 'CONTAINER RUNTIME ENGINE',
        desc: 'Platform designed to build, share, and run containerized modern microservices anywhere seamlessly.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',
        link: 'https://docker.com'
    },
    {
        name: 'Kubernetes',
        category: 'CONTAINER ORCHESTRATION',
        desc: 'Automated container deployment, scaling, and operational management system for production clusters.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-plain.svg',
        link: 'https://kubernetes.io'
    },
    {
        name: 'Go',
        category: 'COMPILED CONCURRENT LANGUAGE',
        desc: 'Fast, statically typed, compiled language that makes it easy to build simple, reliable, and efficient software.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg',
        link: 'https://go.dev'
    },
    {
        name: 'Rust',
        category: 'MEMORY-SAFE SYSTEMS LANGUAGE',
        desc: 'Empowers everyone to build reliable and efficient software with guaranteed memory safety and zero-cost abstractions.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg',
        link: 'https://rust-lang.org'
    },
    {
        name: 'Git',
        category: 'DISTRIBUTED VERSION CONTROL',
        desc: 'Fast, distributed version control system designed to handle everything from small to massive enterprise projects.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',
        link: 'https://git-scm.com'
    },
    {
        name: 'Linux',
        category: 'OPEN SOURCE OPERATING SYSTEM',
        desc: 'The bedrock of cloud computing, supercomputers, and modern production server infrastructure.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg',
        link: 'https://kernel.org'
    },
    {
        name: 'AWS',
        category: 'CLOUD COMPUTING INFRASTRUCTURE',
        desc: 'The worlds most comprehensive and broadly adopted cloud platform offering over 200 fully featured services.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original-wordmark.svg',
        link: 'https://aws.amazon.com'
    },
    {
        name: 'Kafka',
        category: 'DISTRIBUTED EVENT STREAMING',
        desc: 'Distributed event streaming platform used by thousands of companies for high-performance data pipelines.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apachekafka/apachekafka-original.svg',
        link: 'https://kafka.apache.org'
    },
    {
        name: 'GraphQL',
        category: 'QUERY LANGUAGE FOR APIS',
        desc: 'Query language for your API, and a server-side runtime for executing queries using a type system you define.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg',
        link: 'https://graphql.org'
    },
    {
        name: 'Kotlin',
        category: 'MODERN MULTIPLATFORM & ANDROID',
        desc: 'Concise, expressive and safe language by JetBrains, fully interoperable with Java and the official language for Android.',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kotlin/kotlin-original.svg',
        link: 'https://kotlinlang.org'
    }
];

const FAQS = [
    {
        q: 'How does PrepSphere extract skills from my resume?',
        a: 'Our parser analyzes your uploaded PDF resume using semantic extraction and canonical skill mapping. It accurately identifies both explicit technologies and contextual competencies, standardizing variations like "JS" to JavaScript and "Postgres" to PostgreSQL.'
    },
    {
        q: 'What makes PrepSphere mock interviews different?',
        a: 'Rather than generic conversational chat, PrepSphere provides structured technical interview scenarios evaluated against rigorous scoring rubrics with instant feedback on correctness, relevance, and missed concepts.'
    },
    {
        q: 'How are candidate answers evaluated?',
        a: 'Each response is scored across multiple dimensions: technical correctness, problem relevance, architectural completeness, and coverage of essential concepts expected by senior interviewers.'
    },
    {
        q: 'Can I practice across multiple roles and companies?',
        a: 'Yes. You can explore 34+ specialized engineering tracks, benchmark against 350+ calibrated tech companies, upload multiple resumes, and practice unlimited targeted interview loops.'
    }
];

const LandingPage = () => {
    const navigate = useNavigate();
    const [isCurtainLifted, setIsCurtainLifted] = useState(false);
    const [selectedTech, setSelectedTech] = useState(null);
    const [openFaq, setOpenFaq] = useState(null);

    const handleLiftCurtain = () => {
        setIsCurtainLifted(true);
    };

    const handleNavigateSection = (sectionId) => {
        setIsCurtainLifted(true);
        setTimeout(() => {
            const el = document.getElementById(sectionId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            }
        }, 120);
    };

    const toggleFaq = (idx) => {
        setOpenFaq(openFaq === idx ? null : idx);
    };

    return (
        <div className="landing-page-root">
            {/* 1. CURTAIN INTRO COVER */}
            <CurtainIntro 
                isLifted={isCurtainLifted} 
                onLift={handleLiftCurtain} 
                onNavigateSection={handleNavigateSection} 
            />

            {/* 2. REVEALED LANDING PAGE */}
            <div className={`landing-main-wrapper ${isCurtainLifted ? 'active-view' : ''}`}>
                
                {/* Navbar */}
                <nav className="landing-navbar">
                    <div className="nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="brand-icon-box">
                            <Brain size={18} />
                        </div>
                        <span className="brand-name">PrepSphere</span>
                    </div>

                    <div className="nav-center-links">
                        <a href="#how-it-works" className="nav-link">How It Works</a>
                        <a href="#features" className="nav-link">Features</a>
                        <a href="#roles" className="nav-link">Target Roles</a>
                        <a href="#faq" className="nav-link">FAQ</a>
                    </div>

                    <div className="nav-actions">
                        <button className="nav-cta-btn" onClick={() => navigate('/dashboard')}>
                            Go to Dashboard <ArrowRight size={14} />
                        </button>
                    </div>
                </nav>

                {/* Hero Section */}
                <section id="hero-section" className="landing-hero-section">
                    <div className="hero-grid-layout">
                        
                        {/* Left Column: Editorial Headline & CTAs */}
                        <div className="hero-left-col">
                            <div className="hero-pill-badge">
                                <Sparkles size={13} className="badge-spark" />
                                <span>AI Skill Gap Engine & Interactive Mock Rounds</span>
                            </div>

                            <h1 className="hero-main-title">
                                Master every interview<br />
                                with <span className="hero-gradient-accent">precision skill intelligence.</span>
                            </h1>

                            <p className="hero-subtitle">
                                Benchmark your resume against real engineering standards, practice role-tailored technical rounds, and receive rubric-scored feedback with detected and missing concepts.
                            </p>

                            <div className="hero-cta-group">
                                <button className="hero-btn-primary" onClick={() => navigate('/dashboard')}>
                                    Start Practice Session <ArrowRight size={16} />
                                </button>
                                <a href="#how-it-works" className="hero-btn-ghost">
                                    See How It Works
                                </a>
                            </div>

                            <div className="hero-checklist">
                                <div className="check-item">
                                    <CheckCircle2 size={15} className="check-icon" />
                                    <span>Objective Readiness Scoring</span>
                                </div>
                                <div className="check-item">
                                    <CheckCircle2 size={15} className="check-icon" />
                                    <span>Rubric-Guided Evaluation</span>
                                </div>
                                <div className="check-item">
                                    <CheckCircle2 size={15} className="check-icon" />
                                    <span>Prioritized Skill Recommendations</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Live Mock Simulation Preview Card */}
                        <div className="hero-right-col">
                            <div className="preview-window-card">
                                <div className="window-header">
                                    <div className="window-dots">
                                        <span className="dot dot-red"></span>
                                        <span className="dot dot-yellow"></span>
                                        <span className="dot dot-green"></span>
                                    </div>
                                    <span className="window-tag">Live Mock Simulation</span>
                                </div>

                                <div className="preview-content">
                                    {/* Question Box */}
                                    <div className="preview-q-box">
                                        <span className="q-label">AI Interviewer</span>
                                        <p className="q-text">
                                            &ldquo;How would you optimize a PostgreSQL query experiencing slow sequential scans on large tables?&rdquo;
                                        </p>
                                    </div>

                                    {/* Answer Box */}
                                    <div className="preview-a-box">
                                        <span className="a-label">Candidate Answer</span>
                                        <p className="a-text">
                                            &ldquo;I would run EXPLAIN ANALYZE to inspect the execution plan, verify buffer cache hits, and introduce a composite B-Tree index on the filtered columns.&rdquo;
                                        </p>
                                    </div>

                                    {/* Score Card */}
                                    <div className="preview-score-card">
                                        <div className="score-top-line">
                                            <span className="score-heading">Rubric Evaluation Score</span>
                                            <span className="score-badge-green">9.2 / 10</span>
                                        </div>
                                        <div className="score-rubric-chips">
                                            <span className="chip-green">✓ EXPLAIN ANALYZE</span>
                                            <span className="chip-green">✓ Composite Indexing</span>
                                            <span className="chip-green">✓ Buffer Cache Check</span>
                                            <span className="chip-red">✗ Partition Pruning</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* 4-Step Workflow Section */}
                <section id="how-it-works" className="landing-workflow-section">
                    <div className="section-header-center">
                        <span className="section-eyebrow">HOW IT WORKS</span>
                        <h2 className="section-title">
                            How <span className="title-gradient-purple">PrepSphere</span> Prepares You
                        </h2>
                        <p className="section-desc">
                            A structured four-step pipeline designed to identify skill gaps and build true interview confidence.
                        </p>
                    </div>

                    <div className="workflow-cards-grid">
                        {WORKFLOW_STEPS.map((step, idx) => {
                            const IconComponent = step.icon;
                            return (
                                <div key={idx} className="workflow-card">
                                    <div className="workflow-card-top">
                                        <span className="workflow-step-num">{step.num}</span>
                                        <div className="workflow-icon-badge">
                                            <IconComponent size={18} />
                                        </div>
                                    </div>
                                    <h3 className="workflow-card-title">{step.title}</h3>
                                    <p className="workflow-card-desc">{step.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Core Capabilities Section */}
                <section id="features" className="landing-features-section">
                    <div className="section-header-center">
                        <span className="section-eyebrow">CORE CAPABILITIES</span>
                        <h2 className="section-title">
                            Engineered for <span className="title-gradient-purple">Technical Depth</span> & Precision
                        </h2>
                        <p className="section-desc">
                            Built with calibrated rubric evaluation and canonical mapping to give you exact hiring signals.
                        </p>
                    </div>

                    <div className="capabilities-grid">
                        {CORE_CAPABILITIES.map((cap, idx) => {
                            const IconComp = cap.icon;
                            return (
                                <div key={idx} className="capability-card">
                                    <div className="cap-icon-box">
                                        <IconComp size={20} />
                                    </div>
                                    <h3 className="cap-title">{cap.title}</h3>
                                    <p className="cap-desc">{cap.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Universal Engineering Catalog: Supported Target Roles */}
                <section id="roles" className="landing-streams-section">
                    <div className="section-header-center">
                        <span className="section-eyebrow">TARGET DISCIPLINES</span>
                        <h2 className="section-title">
                            Curated across <span className="title-gradient-cyan">Modern Engineering Roles</span>
                        </h2>
                        <p className="section-desc">
                            Interactive engineering tracks configured with adaptive question matrices and industry benchmarks.
                        </p>
                    </div>

                    {/* Infinite Conveyor: Target Roles moving Right to Left */}
                    <div className="stream-conveyor-wrapper">
                        <div className="stream-track track-right-to-left">
                            {[...TARGET_ROLES, ...TARGET_ROLES].map((role, i) => (
                                <div key={i} className="stream-role-pill">
                                    <div className="role-pill-icon">
                                        <Cpu size={16} />
                                    </div>
                                    <div className="role-pill-content">
                                        <div className="role-pill-header">
                                            <span className="role-pill-title">{role.title}</span>
                                            <span className="role-pill-category">{role.category}</span>
                                        </div>
                                        <div className="role-pill-skills">
                                            {role.skills.map(s => (
                                                <span key={s} className="pill-skill-chip">{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="role-pill-arrow">
                                        <ArrowRight size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Canonical Engineering Toolchains & Tech Stack (Moving Left to Right, Clickable with Info Card) */}
                <section id="tech-stack" className="landing-tech-section">
                    <div className="section-header-center" style={{ marginBottom: '24px' }}>
                        <span className="section-eyebrow">INDUSTRY TECH STACK & TOOLCHAINS</span>
                    </div>

                    {/* Logo Conveyor moving Left to Right (opposite direction) */}
                    <div className={`tech-conveyor-wrapper ${selectedTech ? 'paused' : ''}`}>
                        <div className="tech-track track-left-to-right">
                            {[...TECH_STACK_ITEMS, ...TECH_STACK_ITEMS].map((tech, idx) => (
                                <div 
                                    key={idx} 
                                    className={`tech-logo-item ${selectedTech?.name === tech.name ? 'active-selected' : ''}`}
                                    onClick={() => setSelectedTech(selectedTech?.name === tech.name ? null : tech)}
                                    title={`Click to view ${tech.name} documentation & practice`}
                                >
                                    <img src={tech.logo} alt={tech.name} className="tech-logo-img" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Clicked Tech Stack Detail Modal Card (Transparent Box) */}
                    <AnimatePresence>
                        {selectedTech && (
                            <motion.div 
                                className="tech-detail-card"
                                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                                transition={{ duration: 0.25 }}
                            >
                                <div className="tech-card-header">
                                    <div className="tech-header-left">
                                        <img src={selectedTech.logo} alt={selectedTech.name} className="tech-card-logo" />
                                        <div>
                                            <div className="tech-title-row">
                                                <h3 className="tech-card-name">{selectedTech.name}</h3>
                                                <span className="tech-category-badge">{selectedTech.category}</span>
                                            </div>
                                            <span className="tech-subtitle">Industry Standard Tech Stack</span>
                                        </div>
                                    </div>
                                    <button className="tech-close-btn" onClick={() => setSelectedTech(null)}>
                                        <X size={16} />
                                    </button>
                                </div>

                                <p className="tech-card-desc">{selectedTech.desc}</p>

                                <div className="tech-card-actions">
                                    <a 
                                        href={selectedTech.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="tech-link-btn"
                                    >
                                        <Download size={14} /> Download & Official Documentation <ExternalLink size={12} />
                                    </a>
                                    <button 
                                        className="tech-practice-btn"
                                        onClick={() => navigate('/dashboard')}
                                    >
                                        <Sparkles size={14} /> Practice {selectedTech.name} Questions <ArrowRight size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Questions & Answers (FAQ) */}
                <section id="faq" className="landing-faq-section">
                    <div className="section-header-center">
                        <span className="section-eyebrow">FAQ</span>
                        <h2 className="section-title">
                            Frequently Asked <span className="title-gradient-cyan">Questions</span>
                        </h2>
                        <p className="section-desc">
                            Clear answers about resume parsing, skill gap scoring, and AI mock evaluation.
                        </p>
                    </div>

                    <div className="faq-accordion-list">
                        {FAQS.map((faq, idx) => (
                            <div key={idx} className={`faq-card ${openFaq === idx ? 'open' : ''}`}>
                                <button className="faq-question-btn" onClick={() => toggleFaq(idx)}>
                                    <span>{faq.q}</span>
                                    {openFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                {openFaq === idx && (
                                    <div className="faq-answer-body">
                                        <p>{faq.a}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Bottom CTA Card */}
                <section className="landing-bottom-cta">
                    <div className="cta-banner-box">
                        <h2 className="cta-banner-title">
                            Ready to Master Your <span className="title-gradient-purple">Technical</span>{' '}
                            <span className="title-gradient-cyan">Interviews</span>?
                        </h2>
                        <p className="cta-banner-desc">
                            Start your free practice session, benchmark your readiness score, and get instant rubric feedback.
                        </p>
                        <button className="cta-banner-btn" onClick={() => navigate('/dashboard')}>
                            Start Practice Session <ArrowRight size={16} />
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default LandingPage;
