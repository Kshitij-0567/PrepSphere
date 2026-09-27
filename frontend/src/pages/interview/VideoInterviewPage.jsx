import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../../api/client';
import FeedbackProvider from '../../components/ui/FeedbackProvider';
import { initials } from '../../utils/format';
import InterviewRoom from './InterviewRoom';
import SetupScreen from './SetupScreen';
import { createFaceTracker } from './lib/faceTracker';
import { createMeter, listDevices, mediaSupported, openStream, permissionMessage, stopStream } from './lib/media';
import { englishVoices, stopSpeaking, voiceSupported } from './lib/speech';
import { loadSettings, saveSettings } from './lib/delivery';
import '../../styles/app.css';
import './interview-room.css';

const NO_MEDIA = { stream: null, requesting: false, error: '', cameraOn: false, micOn: false, hasCamera: false, hasMic: false, typeOnly: false };

/**
 * /interviews/:id/live — the full-screen video interview: a setup check, then the interview room.
 * The camera stream, level meter and face tracker live here so they survive the switch.
 */
const VideoInterviewPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [interview, setInterview] = useState(null);
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');
    const [phase, setPhase] = useState('setup');
    const [settings, setSettings] = useState(loadSettings);
    const [media, setMedia] = useState(() => ({ ...NO_MEDIA, error: mediaSupported ? '' : 'This browser cannot use a camera here. Video interviews need a current browser on HTTPS or localhost. You can still type your answers.' }));
    const [devices, setDevices] = useState({ cameras: [], mics: [] });
    const [voices, setVoices] = useState(englishVoices);
    const [meter, setMeter] = useState(null);
    const [tracker, setTracker] = useState(null);
    const streamRef = useRef(null);
    const meterRef = useRef(null);
    const trackerRef = useRef(null);
    const trackerVideo = useRef(null);
    const displayVideo = useRef(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([api.post(`/interviews/${id}/resume`), api.get('/users/me')])
            .then(([res, me]) => {
                if (cancelled) return;
                if (res.data.mode !== 'video') { navigate(`/dashboard?resume=${id}`, { replace: true }); return; }
                if (!res.data.current_question) { setError('This interview has no question to continue with.'); return; }
                setInterview(res.data);
                setUser(me.data);
            })
            .catch(err => {
                if (cancelled) return;
                if (err.response?.status === 409) navigate(`/interviews/${id}`, { replace: true });
                else setError(apiErrorMessage(err, 'Could not open this interview.'));
            });
        return () => { cancelled = true; };
    }, [id, navigate]);

    useEffect(() => {
        if (!voiceSupported) return undefined;
        const update = () => setVoices(englishVoices());
        speechSynthesis.addEventListener('voiceschanged', update);
        const retry = setTimeout(update, 700);
        return () => { speechSynthesis.removeEventListener('voiceschanged', update); clearTimeout(retry); };
    }, []);

    // Release the camera and microphone when leaving the page.
    useEffect(() => () => {
        stopStream(streamRef.current);
        meterRef.current?.close();
        trackerRef.current?.stop();
        stopSpeaking();
    }, []);

    useEffect(() => {
        if (phase !== 'room') return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [phase]);

    const rebuildTracker = useCallback((stream, eyeOn) => {
        trackerRef.current?.stop();
        trackerRef.current = null;
        const video = trackerVideo.current;
        if (eyeOn && stream?.getVideoTracks().length && video) {
            trackerRef.current = createFaceTracker(video, { onError: () => setTracker(null) });
        }
        setTracker(trackerRef.current);
    }, []);

    const attach = useCallback((stream, eyeOn) => {
        stopStream(streamRef.current);
        meterRef.current?.close();
        streamRef.current = stream;
        meterRef.current = createMeter(stream);
        setMeter(meterRef.current);
        const video = trackerVideo.current;
        if (video) {
            video.srcObject = stream;
            video.play().catch(() => {});
        }
        const hasCamera = stream.getVideoTracks().length > 0;
        const hasMic = stream.getAudioTracks().length > 0;
        setMedia({ ...NO_MEDIA, stream, cameraOn: hasCamera, micOn: hasMic, hasCamera, hasMic });
        rebuildTracker(stream, eyeOn);
        listDevices().then(setDevices);
    }, [rebuildTracker]);

    const requestMedia = async (kind = 'av', overrides = {}) => {
        if (!mediaSupported) return;
        const wanted = { ...settings, ...overrides };
        setMedia(m => ({ ...m, requesting: true, error: '' }));
        try {
            const stream = await openStream({ camera: kind === 'av', cameraId: wanted.cameraId, micId: wanted.micId });
            attach(stream, wanted.eye);
        } catch (err) {
            if (overrides.cameraId || overrides.micId) {
                // A device that disappeared: fall back to the default one.
                try { attach(await openStream({ camera: kind === 'av' }), wanted.eye); return; } catch { /* report below */ }
            }
            setMedia(m => ({ ...m, requesting: false, error: permissionMessage(err) }));
        }
    };

    const updateSettings = useCallback((patch) => {
        setSettings(s => {
            const next = { ...s, ...patch };
            saveSettings(next);
            return next;
        });
        if ('eye' in patch) rebuildTracker(streamRef.current, patch.eye);
    }, [rebuildTracker]);

    const onDevice = (key, value) => {
        updateSettings({ [key]: value });
        requestMedia(streamRef.current?.getVideoTracks().length ? 'av' : 'audio', { [key]: value });
    };

    const toggleTrack = (kind) => {
        const track = kind === 'video' ? streamRef.current?.getVideoTracks()[0] : streamRef.current?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setMedia(m => ({ ...m, [kind === 'video' ? 'cameraOn' : 'micOn']: track.enabled }));
    };

    const effectiveSettings = { ...settings, voiceURI: voices.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : voices[0]?.voiceURI || null };

    let content;
    if (error) {
        content = (
            <div className="vi-screen vi-message">
                <h1>Can't open this interview</h1>
                <p className="vi-muted">{error}</p>
                <Link className="vi-btn" to="/interviews">Back to your interviews</Link>
            </div>
        );
    } else if (!interview || !user) {
        content = <div className="vi-screen vi-message" role="status"><div className="ps-skeleton" style={{ height: 420 }} aria-label="Loading your interview" /></div>;
    } else {
        const meta = {
            roleName: interview.role_name || 'Interview', companyName: interview.company_name, seniority: interview.seniority || 'Mid',
            userName: user.name || '', initials: initials(user.name, user.email),
        };
        content = phase === 'setup' ? (
            <SetupScreen
                meta={meta} plan={interview.plan} completedSteps={interview.questions_answered} settings={effectiveSettings} onSettings={updateSettings}
                media={{ ...media, voiceOnly: Boolean(media.stream && !media.hasCamera) }} devices={devices} onDevice={onDevice}
                onRequestMedia={() => requestMedia('av')}
                onVoiceOnly={(kind) => (kind === 'type' ? setMedia(m => ({ ...m, typeOnly: true, error: '' })) : requestMedia('audio'))}
                videoRef={displayVideo} tracker={tracker} meter={meter} voices={voices}
                onStart={() => setPhase('room')} starting={false}
                onToggleCamera={() => toggleTrack('video')} onToggleMic={() => toggleTrack('audio')}
            />
        ) : (
            <InterviewRoom
                interview={interview} meta={meta} settings={effectiveSettings} onSettings={updateSettings} media={media}
                onToggleCamera={() => toggleTrack('video')} onToggleMic={() => toggleTrack('audio')}
                meter={meter} tracker={tracker} videoRef={displayVideo} voices={voices}
            />
        );
    }

    return (
        <FeedbackProvider>
            <div className="ps-app vi-app">
                {content}
                <video ref={trackerVideo} className="vi-tracker-video" muted playsInline aria-hidden="true" tabIndex={-1} />
            </div>
        </FeedbackProvider>
    );
};

export default VideoInterviewPage;
