import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { useFeedback } from '../components/ui/feedbackContext';
import { formatDateLong } from '../utils/format';

const MAX_MB = 10; // matches MAX_RESUME_MB on the backend
const ACCEPT = ['.pdf', '.docx', '.txt'];

const ResumesPage = () => {
    const { toast } = useFeedback();
    const [resumes, setResumes] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(null); // 'upload' | resume id
    const [dragOver, setDragOver] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const inputRef = useRef(null);

    const load = useCallback(() => api.get('/resumes')
        .then(res => { setResumes(res.data); setError(''); })
        .catch(err => setError(apiErrorMessage(err, 'Could not load your resumes.'))), []);

    useEffect(() => {
        let cancelled = false;
        api.get('/resumes')
            .then(res => { if (!cancelled) setResumes(res.data); })
            .catch(err => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load your resumes.')); });
        return () => { cancelled = true; };
    }, []);

    const upload = async (file) => {
        if (!file) return;
        const name = file.name.toLowerCase();
        if (!ACCEPT.some(ext => name.endsWith(ext))) {
            toast('Upload a PDF, DOCX or TXT file.', { error: true });
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            toast(`Resume files must be ${MAX_MB} MB or smaller.`, { error: true });
            return;
        }
        setBusy('upload');
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post('/resumes/upload', form);
            toast(`${res.data.filename} analyzed: ${res.data.extracted_skills.length} skills found. It is now your active resume.`);
            await load();
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not analyze that resume.'), { error: true });
        }
        setBusy(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const activate = async (resume) => {
        setBusy(resume.id);
        try {
            await api.post(`/resumes/${resume.id}/select`);
            toast(`${resume.filename} is now your active resume.`);
            await load();
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not switch resumes.'), { error: true });
        }
        setBusy(null);
    };

    const remove = async (resume) => {
        setBusy(resume.id);
        try {
            const res = await api.delete(`/resumes/${resume.id}`);
            toast(res.data.was_active
                ? `${resume.filename} deleted. Choose another active resume to keep your skill profile.`
                : `${resume.filename} deleted.`);
            setPendingDelete(null);
            await load();
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not delete that resume.'), { error: true });
        }
        setBusy(null);
    };

    return (
        <div className="ps-page">
            <article className="ps-card" aria-labelledby="ps-up-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="ps-up-title">Upload a resume</h2>
                        <p className="ps-card-sub">PDF, DOCX or TXT up to {MAX_MB} MB. The newest upload becomes your active resume.</p>
                    </div>
                </div>
                <div
                    className={`ps-dropzone ${dragOver ? 'is-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}
                >
                    <Upload size={22} color="var(--accent-soft)" aria-hidden="true" />
                    <strong>Drag a file here or choose one</strong>
                    <input
                        ref={inputRef}
                        id="ps-resume-file"
                        type="file"
                        accept={ACCEPT.join(',')}
                        className="ps-sr-only"
                        onChange={(e) => upload(e.target.files?.[0])}
                    />
                    <label htmlFor="ps-resume-file" className="ps-btn ps-btn-primary" aria-disabled={busy === 'upload'} style={busy === 'upload' ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
                        {busy === 'upload' ? <Loader2 size={14} className="ps-spin" aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                        {busy === 'upload' ? 'Analyzing resume…' : 'Choose file'}
                    </label>
                </div>
            </article>

            <article className="ps-card" aria-labelledby="ps-lib-title">
                <div className="ps-card-head">
                    <div>
                        <h2 className="ps-card-title" id="ps-lib-title">Your resumes</h2>
                        <p className="ps-card-sub">Your skill profile, skill gaps and interview questions use the active resume.</p>
                    </div>
                </div>
                {error && <div className="ps-banner ps-banner-error" role="alert">{error}</div>}
                {!resumes && !error && <div className="ps-skeleton" style={{ height: 140 }} />}
                {resumes && resumes.length === 0 && <p className="ps-muted">No resumes yet. Upload one above.</p>}
                {resumes && resumes.length > 0 && (
                    <div className="ps-list">
                        {resumes.map(r => (
                            <div className="ps-list-row" key={r.id}>
                                <div className="ps-row-3" style={{ gridTemplateColumns: '34px minmax(0, 1fr)' }}>
                                    <span className="ps-mono-tile"><FileText size={16} aria-hidden="true" /></span>
                                    <div>
                                        <strong title={r.filename}>
                                            {r.filename}{' '}
                                            {r.is_active && <span className="ps-pill ps-pill-good" style={{ verticalAlign: 1 }}><CheckCircle2 size={11} aria-hidden="true" /> Active</span>}
                                        </strong>
                                        <span>
                                            {r.quality_score != null ? `${r.quality_score}% complete · ` : ''}
                                            {r.extracted_skills.length} skills · uploaded {formatDateLong(r.uploaded_at ? `${r.uploaded_at}Z`.replace('ZZ', 'Z') : null)}
                                        </span>
                                        {r.extracted_skills.length > 0 && (
                                            <div className="ps-chips" style={{ marginTop: 8 }}>
                                                {r.extracted_skills.slice(0, 8).map(s => <span key={s} className="ps-chip">{s}</span>)}
                                                {r.extracted_skills.length > 8 && <span className="ps-chip">+{r.extracted_skills.length - 8} more</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="ps-list-actions">
                                    {pendingDelete === r.id ? (
                                        <>
                                            <span className="ps-muted" style={{ fontSize: 12.5 }}>Delete this resume?</span>
                                            <button className="ps-btn ps-btn-sm ps-btn-danger" type="button" onClick={() => remove(r)} disabled={busy === r.id}>
                                                {busy === r.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                            <button className="ps-btn ps-btn-sm" type="button" onClick={() => setPendingDelete(null)} disabled={busy === r.id}>Keep</button>
                                        </>
                                    ) : (
                                        <>
                                            {!r.is_active && (
                                                <button className="ps-btn ps-btn-sm" type="button" onClick={() => activate(r)} disabled={busy != null}>
                                                    {busy === r.id ? 'Switching…' : 'Set as active'}
                                                </button>
                                            )}
                                            <button className="ps-btn ps-btn-sm ps-btn-ghost ps-btn-danger" type="button" onClick={() => setPendingDelete(r.id)} disabled={busy != null} aria-label={`Delete ${r.filename}`}>
                                                <Trash2 size={14} aria-hidden="true" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </article>
        </div>
    );
};

export default ResumesPage;
