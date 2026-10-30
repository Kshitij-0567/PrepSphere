import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import { GOOGLE_CLIENT_ID } from './config'

// Google sign-in is optional; without a client ID the provider (and its script) is skipped.
const app = GOOGLE_CLIENT_ID
  ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}><App /></GoogleOAuthProvider>
  : <App />;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {app}
  </StrictMode>,
)
