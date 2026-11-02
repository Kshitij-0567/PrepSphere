import { Link } from 'react-router-dom';
import { ArrowLeft, Brain } from 'lucide-react';
import './PrivacyPage.css';

// The address people write to for data requests. Change it here if it changes.
const CONTACT_EMAIL = 'kshitijchaurasia15@gmail.com';
const EFFECTIVE_DATE = '2 November 2026';

const PrivacyPage = () => (
    <div className="privacy-root">
        <header className="privacy-bar">
            <Link to="/" className="privacy-brand">
                <Brain size={22} strokeWidth={2} />
                <span>PrepSphere</span>
            </Link>
            <Link to="/" className="privacy-back">
                <ArrowLeft size={16} /> Back to home
            </Link>
        </header>

        <main className="privacy-doc">
            <h1>Privacy policy</h1>
            <p className="privacy-meta">Effective {EFFECTIVE_DATE}</p>

            <p>
                PrepSphere is an interview preparation platform built as a student project at Madhav
                Institute of Technology &amp; Science, Gwalior. This page explains what information it
                collects, why, where it goes, and how you can have it removed.
            </p>

            <h2>What we collect</h2>
            <ul>
                <li>
                    <strong>Account details.</strong> Your name and email address. If you sign up with a
                    password, we store it only as a bcrypt hash, so we never see the password itself.
                    If you sign in with Google, Google sends us your name and email address and nothing
                    else: we get no access to your Gmail, Drive, contacts or Google password.
                </li>
                <li>
                    <strong>Profile details you choose to add.</strong> Your country, your LinkedIn
                    handle and your GitHub username. If you link GitHub, we import public information
                    about your repositories from GitHub's public API.
                </li>
                <li>
                    <strong>Resumes.</strong> The file you upload is read in memory and is not kept. We
                    store the file name, the text extracted from it and the skills found in that text.
                </li>
                <li>
                    <strong>Interview data.</strong> The questions you were asked, your typed answers,
                    transcripts of your spoken answers, code you submit, whiteboard drawings, your scores
                    and feedback, and delivery measurements: speaking pace, filler words, pauses and the
                    share of time you looked at the camera.
                </li>
            </ul>

            <h2>What stays on your device</h2>
            <ul>
                <li>
                    <strong>Camera video never leaves your browser.</strong> Replays of your answers are
                    saved in your browser's own storage on your device. Clearing this site's data in your
                    browser deletes them.
                </li>
                <li>
                    Eye-contact tracking runs entirely inside your browser, using a model file served from
                    this website.
                </li>
                <li>
                    The audio of each spoken answer is sent to our server only so it can be transcribed,
                    and is discarded straight afterwards. We do not store recordings.
                </li>
                <li>
                    Your sign-in session is kept in your browser's local storage. Signing out removes it.
                </li>
            </ul>

            <h2>How we use it</h2>
            <p>
                Only to run the features you use: measuring your readiness for a role, writing interview
                questions, marking your answers, building your study plan and showing your progress.
            </p>
            <ul>
                <li>
                    <strong>Benchmarks</strong> compare you with other candidates using totals and
                    averages only, and show a figure only when at least five other candidates stand
                    behind it. They never show anyone's resume.
                </li>
                <li>
                    <strong>The resume showcase</strong> shows your resume to others only if you choose to
                    publish it. Your email address, phone number and links are removed first, and you can
                    unpublish it at any time.
                </li>
            </ul>
            <p>
                We do not sell your information, show advertising, or use analytics or tracking tools.
            </p>

            <h2>Services we rely on</h2>
            <ul>
                <li><strong>Vercel</strong> hosts this website.</li>
                <li><strong>Render</strong> hosts our server and database, in its Singapore region.</li>
                <li>
                    <strong>Google</strong> provides Google Sign-In, if you use it. When AI features are
                    switched on, your resume text, your interview questions and answers, and the audio of
                    spoken answers are sent to Google's Gemini API to write questions, transcribe speech
                    and mark answers.
                </li>
                <li><strong>GitHub</strong> provides public profile data, only if you link a username.</li>
                <li>
                    <strong>Google Fonts, Google's favicon service and jsDelivr</strong> deliver this
                    site's fonts and company logos, so your browser contacts those services when pages load.
                </li>
            </ul>

            <h2>Keeping and deleting your data</h2>
            <p>
                We keep your information for as long as your account exists. Inside the app you can
                delete any resume and unpublish your showcase entry at any time. To delete your whole
                account and everything linked to it, email{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address you signed up
                with, and we will delete it within 30 days.
            </p>

            <h2>Security</h2>
            <p>
                The site is served over HTTPS, passwords are stored as bcrypt hashes, sign-in sessions
                expire after 24 hours, and repeated sign-in attempts are rate-limited. No system is
                perfectly secure, but we take reasonable care to protect what you share.
            </p>

            <h2>Who it is for</h2>
            <p>
                PrepSphere is meant for college students and job seekers, and is not intended for anyone
                under 18.
            </p>

            <h2>Changes and contact</h2>
            <p>
                If this policy changes, we will update it here and change the date at the top. For any
                question about your data, write to{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
        </main>
    </div>
);

export default PrivacyPage;
