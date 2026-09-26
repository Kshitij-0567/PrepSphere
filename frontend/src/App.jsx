import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { clearSession, hasValidSession } from './api/session';

// Signed-in pages load on demand so the landing page stays light.
const AppLayout = lazy(() => import('./components/layout/AppLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage'));
const InterviewResultsPage = lazy(() => import('./pages/InterviewResultsPage'));
const ResumesPage = lazy(() => import('./pages/ResumesPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const SkillGapsPage = lazy(() => import('./pages/SkillGapsPage'));
const StudyPlanPage = lazy(() => import('./pages/StudyPlanPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const PageLoader = () => (
  <div role="status" aria-label="Loading" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: '#6f7b98', fontSize: 14 }}>
    Loading…
  </div>
);

// CSS Imports
import './App.css';
import './pages/LandingPage.css';
import './pages/Auth.css';

const PrivateRoute = ({ children }) => {
  if (hasValidSession()) return children;
  clearSession();
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* Signed-in pages share the sidebar layout */}
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/interviews" element={<InterviewsPage />} />
          <Route path="/interviews/:id" element={<InterviewResultsPage />} />
          <Route path="/resumes" element={<ResumesPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/skill-gaps" element={<SkillGapsPage />} />
          <Route path="/study-plan" element={<StudyPlanPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
