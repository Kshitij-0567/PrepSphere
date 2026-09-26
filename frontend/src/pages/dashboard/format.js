// Safe formatting helpers for company intelligence attributes
export const formatWhatCompanyWants = (val, companyName = "the company") => {
    if (!val) return [`${companyName} seeks candidates with strong algorithmic mastery, clean architecture principles, and high ownership.`];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        const parts = val.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        return parts.length > 0 ? parts : [val];
    }
    return [String(val)];
};

export const formatInterviewRounds = (val) => {
    if (!val) {
        return [
            { stage: "STAGE 01", title: "Initial Screen", desc: "Recruiter screen & technical baseline overview." },
            { stage: "STAGE 02", title: "Core Technical Coding", desc: "Live algorithms, data structures & complexity analysis." },
            { stage: "STAGE 03", title: "System Design & Architecture", desc: "Distributed systems, scalability & trade-off decisions." }
        ];
    }
    if (Array.isArray(val)) {
        return val.map((r, idx) => {
            if (typeof r === 'string') {
                const parts = r.split(/:\s*(.+)/);
                if (parts.length > 1) {
                    return { stage: parts[0].trim().toUpperCase(), title: parts[1].trim(), desc: '' };
                }
                return { stage: `STAGE 0${idx + 1}`, title: r.trim(), desc: '' };
            }
            if (typeof r === 'object' && r !== null) {
                return {
                    stage: (r.stage || r.round || `STAGE 0${idx + 1}`).toUpperCase(),
                    title: r.title || r.round || `Stage 0${idx + 1}`,
                    desc: r.desc || ''
                };
            }
            return { stage: `STAGE 0${idx + 1}`, title: String(r), desc: '' };
        });
    }
    if (typeof val === 'string') {
        return [{ stage: "STAGE 01", title: val, desc: '' }];
    }
    return [];
};

export const formatPrepTips = (val) => {
    if (!val) return ["Focus on time complexity explanations, edge cases, and clear structured communication."];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        const parts = val.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        return parts.length > 0 ? parts : [val];
    }
    return [String(val)];
};

export const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const SENIORITY_YEARS = { Junior: '0-2 Yrs', Mid: '3-5 Yrs', Senior: '5+ Yrs' };
