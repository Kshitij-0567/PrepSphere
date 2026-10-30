import axios from 'axios';
import { API_BASE_URL } from '../config';
import { clearSession, getToken } from './session';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// An expired or invalid session sends the user back to the login page.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthCall = error.config?.url?.startsWith('/auth/');
        if (error.response?.status === 401 && !isAuthCall) {
            clearSession();
            if (window.location.pathname !== '/login') {
                window.location.assign('/login?expired=1');
            }
        }
        return Promise.reject(error);
    }
);

// FastAPI returns `detail` as a string, or as a list of validation errors for 422 responses.
export function apiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
    if (!error?.response) {
        return 'Cannot reach the server. Check that the backend is running.';
    }
    const detail = error.response.data?.detail;
    if (typeof detail === 'string') {
        return detail;
    }
    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) => (item?.msg || '').replace(/^Value error, /, ''))
            .filter(Boolean);
        if (messages.length) return messages.join(' ');
    }
    return fallback;
}

export default api;
