// VITE_API_URL may be an empty string on purpose: the Docker image serves the API and the
// frontend from the same origin, so requests use relative URLs.
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
