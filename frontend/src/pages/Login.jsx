import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Brain, Zap } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import api, { apiErrorMessage } from '../api/client';
import { saveSession } from '../api/session';
import { GOOGLE_CLIENT_ID } from '../config';
import './Auth.css';

const Login = () => {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(
        searchParams.get('expired') ? 'Your session expired. Please sign in again.' : ''
    );
    const navigate = useNavigate();

    const completeSignIn = (data) => {
        saveSession(data);
        navigate('/profile');
    };

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            completeSignIn(res.data);
        } catch (err) {
            setErrorMsg(apiErrorMessage(err, "Invalid email or password"));
        }
        setLoading(false);
    };

    // Each demo session gets its own throwaway account, so visitors never see each other's resumes.
    const handleDemoLogin = async () => {
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await api.post('/auth/demo');
            completeSignIn(res.data);
        } catch (err) {
            setErrorMsg(apiErrorMessage(err, "Could not launch demo session"));
        }
        setLoading(false);
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await api.post('/auth/google', {
                token: credentialResponse.credential
            });
            completeSignIn(res.data);
        } catch (err) {
            setErrorMsg(apiErrorMessage(err, "Google Login failed"));
        }
    };

    return (
        <div className="auth-container">
            <motion.div
                className="auth-box glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="auth-header">
                    <Link to="/" className="auth-logo">
                        <Brain size={32} color="#6366f1" />
                        <span>PrepSphere</span>
                    </Link>
                    <h1>Welcome Back</h1>
                    <p>Continue your journey with a single click</p>
                </div>

                {errorMsg && (
                    <div role="alert" style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        fontSize: '0.85rem',
                        marginBottom: '20px',
                        textAlign: 'center'
                    }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleLogin} className="auth-form">
                    <div className="auth-input-group">
                        <label htmlFor="login-email">EMAIL ADDRESS</label>
                        <div className="input-with-icon">
                            <Mail size={18} />
                            <input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-input-group">
                        <label htmlFor="login-password">PASSWORD</label>
                        <div className="input-with-icon">
                            <Lock size={18} />
                            <input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
                        }}
                    >
                        {loading ? "Signing in..." : "Sign In"} <ArrowRight size={18} />
                    </button>

                    <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <Zap size={16} /> Try a Private Demo Session
                    </button>
                </form>

                {GOOGLE_CLIENT_ID && (
                    <>
                        <div className="auth-divider">
                            <span>or continue with</span>
                        </div>

                        <div className="google-btn-container">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setErrorMsg('Google Login Failed')}
                                useOneTap
                                theme="filled_black"
                                shape="pill"
                                size="large"
                            />
                        </div>
                    </>
                )}

                <div className="auth-footer">
                    Don't have an account? <Link to="/signup">Create account</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
