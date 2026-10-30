import { useEffect, useState } from 'react';
import api from '../../api/client';

// The country list never changes while the app is open, so it is fetched once.
let countriesRequest = null;

export function useCountries() {
    const [countries, setCountries] = useState([]);
    useEffect(() => {
        let cancelled = false;
        countriesRequest = countriesRequest || api.get('/countries').then(res => res.data).catch(() => { countriesRequest = null; return []; });
        countriesRequest.then(list => { if (!cancelled) setCountries(list); });
        return () => { cancelled = true; };
    }, []);
    return countries;
}

export const SENIORITIES = ['Junior', 'Mid', 'Senior'];

const count = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Rows shared by the benchmark table and the side-by-side comparison. */
export const METRICS = [
    { key: 'score', label: 'Candidate score', hint: '60% role readiness + 40% mock interview average', format: v => `${Math.round(v)}`, suffix: '/100', step: 1 },
    { key: 'readiness', label: 'Role readiness', hint: "Share of the role's weighted skills on the resume", format: v => `${Math.round(v)}`, suffix: '%', step: 1 },
    { key: 'interview', label: 'Mock interview average', hint: 'Latest 3 completed interviews for this role', format: v => v.toFixed(1), suffix: '/10', step: 0.1 },
    { key: 'projects', label: 'Projects', format: count, step: 1 },
    { key: 'experience', label: 'Work experience entries', format: count, step: 1 },
    { key: 'measurable', label: 'Measurable results', hint: 'Lines with a number, such as "cut load time by 40%"', format: count, step: 1 },
    { key: 'certifications', label: 'Certifications', format: count, step: 1 },
    { key: 'skills', label: 'Skills listed', format: count, step: 1 },
    { key: 'completeness', label: 'Resume completeness', format: v => `${Math.round(v)}`, suffix: '%', step: 1 },
];

export const plural = (n, word, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st... */
export function ordinal(n) {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}
