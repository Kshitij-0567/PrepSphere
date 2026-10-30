import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Brain } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import api, { apiErrorMessage } from '../api/client';
import { saveSession } from '../api/session';
import { GOOGLE_CLIENT_ID } from '../config';
import './Auth.css';

const MIN_PASSWORD_LENGTH = 8;

const Signup = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const completeSignIn = (data) => {
        saveSession(data);
        navigate('/profile');
    };

    const handleSignup = async (e) => {
        if (e) e.preventDefault();
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await api.post('/auth/signup', formData);
            completeSignIn(res.data);
        } catch (err) {
            setErrorMsg(apiErrorMessage(err, "Signup failed"));
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
            setErrorMsg(apiErrorMessage(err, "Google Signup failed"));
        }
    };

    return (
        <div className="auth-container">
            <motion.div
                className="auth-box glass"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="auth-header">
                    <Link to="/" className="auth-logo">
                        <Brain size={32} color="#6366f1" />
                        <span>PrepSphere</span>
                    </Link>
                    <h1>Get Started</h1>
                    <p>Unlock your professional potential instantly</p>
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

                <form onSubmit={handleSignup} className="auth-form">
                    <div className="auth-input-group">
                        <label htmlFor="signup-name">FULL NAME</label>
                        <div className="input-with-icon">
                            <User size={18} />
                            <input
                                id="signup-name"
                                type="text"
                                autoComplete="name"
                                placeholder="Jane Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-input-group">
                        <label htmlFor="signup-email">EMAIL ADDRESS</label>
                        <div className="input-with-icon">
                            <Mail size={18} />
                            <input
                                id="signup-email"
                                type="email"
                                autoComplete="email"
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-input-group">
                        <label htmlFor="signup-password">PASSWORD</label>
                        <div className="input-with-icon">
                            <Lock size={18} />
                            <input
                                id="signup-password"
                                type="password"
                                autoComplete="new-password"
                                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                minLength={MIN_PASSWORD_LENGTH}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                        {loading ? "Creating Account..." : "Create Free Account"} <ArrowRight size={18} />
                    </button>
                </form>

                {GOOGLE_CLIENT_ID && (
                    <>
                        <div className="auth-divider">
                            <span>or sign up with</span>
                        </div>

                        <div className="google-btn-container">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setErrorMsg('Google Signup Failed')}
                                useOneTap
                                theme="filled_black"
                                shape="pill"
                                text="signup_with"
                                size="large"
                            />
                        </div>
                    </>
                )}

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign in here</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Signup;
