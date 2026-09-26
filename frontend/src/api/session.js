import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function saveSession(authResponse) {
    localStorage.setItem(TOKEN_KEY, authResponse.access_token);
    if (authResponse.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    }
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function hasValidSession() {
    const token = getToken();
    if (!token) return false;
    try {
        const { exp } = jwtDecode(token);
        return !exp || exp * 1000 > Date.now();
    } catch {
        return false;
    }
}
