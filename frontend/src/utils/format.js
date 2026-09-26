// Formatting helpers shared by the signed-in pages.

export function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatDateLong(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(iso) {
    if (!iso) return '';
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return formatDateLong(iso);
}

export const scoreBand = (v) => (v >= 8 ? 'strong' : v >= 6 ? 'track' : 'work');

export const BAND = {
    strong: { label: 'Strong', hex: '#10b981' },
    track: { label: 'On track', hex: '#818cf8' },
    work: { label: 'Needs work', hex: '#f59e0b' },
};

// Skill status colours: the app's existing strong / developing / gap / missing palette.
export const SKILL_STATUS = {
    strong: { label: 'Strong', hex: '#10b981', hollow: false, order: 0 },
    developing: { label: 'Developing', hex: '#60a5fa', hollow: false, order: 1 },
    weak: { label: 'Minor gap', hex: '#f59e0b', hollow: true, order: 2 },
    missing: { label: 'Missing', hex: '#ef4444', hollow: true, order: 3 },
    extra: { label: 'Not required', hex: '#94a3b8', hollow: false, order: 4 },
};

export function initials(name, email = '') {
    const words = (name || email.split('@')[0] || '').replace(/[._]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const LINKEDIN_PATTERN = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})\/?(?:\?.*)?$/i;
export const GITHUB_PATTERN = /^@?(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/?$/i;

export function isValidLink(kind, value) {
    const text = value.trim();
    if (kind === 'linkedin') return LINKEDIN_PATTERN.test(text) || /^[A-Za-z0-9_-]{3,100}$/.test(text);
    return GITHUB_PATTERN.test(text);
}
