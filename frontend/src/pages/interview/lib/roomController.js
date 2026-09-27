// Runs one video interview question after another: the interviewer asks, the candidate thinks and
// answers, the answer is uploaded and scored, then the next question (or a follow-up) begins.
// Lives outside React so recorders and timers are never recreated by a render.

import api, { apiErrorMessage } from '../../../api/client';
import { createRecorder, toWav } from './media';
import { captionsSupported, createCaptions, speak, stopSpeaking, voiceSupported } from './speech';
import { saveClip } from './recordings';
import { boardDraftKey, codeDraftKey, notesDraftKey, writeDraft } from './delivery';

const ACKNOWLEDGEMENTS = ["Thanks, that's helpful.", 'Got it, thank you.', 'Okay, thanks.', 'Thank you, that makes sense.'];
const THINK_SECONDS = 15;
const REVEAL_MS = 330;

const wordsUpTo = (text, charIndex) => text.slice(0, charIndex).split(/\s+/).filter(Boolean).length + 1;
const firstSentences = (text, n) => ((text || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [text || '']).slice(0, n).join('').trim();

/**
 * `set` holds React state setters; `env()` returns the latest settings, stream, meter, tracker and
 * voices. Every method is safe to call at any time; calls that don't fit the current phase are ignored.
 */
export function createRoomController({ interviewId, plan, set, env, onFinished, onReload, toast }) {
    const st = {
        question: null, phase: 'idle', timers: new Set(), cancelSpeech: null, clip: null, clipStart: 0,
        audio: null, captions: null, captionsText: '', answerStart: 0, talking: false, retry: null, pending: null, disposed: false,
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepOf = q => plan[q.step_index];

    const later = (fn, ms) => {
        const id = setTimeout(() => { st.timers.delete(id); if (!st.disposed) fn(); }, ms);
        st.timers.add(id);
        return id;
    };
    const every = (fn, ms) => {
        const id = setInterval(() => { if (!st.disposed) fn(); }, ms);
        st.timers.add(id);
        return id;
    };
    const clearTimers = () => { st.timers.forEach(id => { clearTimeout(id); clearInterval(id); }); st.timers.clear(); };
    const setPhase = (phase) => { st.phase = phase; set.phase(phase); };
    const quiet = () => { st.cancelSpeech?.(); st.cancelSpeech = null; stopSpeaking(); };

    function say(text) {
        const { settings, voices } = env();
        if (settings.voice && voiceSupported && voices.length) st.cancelSpeech = speak(text, { voiceURI: settings.voiceURI });
    }

    function discardAnswer() {
        st.captions?.stop();
        st.captions = null;
        st.audio?.cancel();
        st.audio = null;
        const { meter, tracker } = env();
        meter?.end();
        tracker?.end();
        st.talking = false;
        set.talking(false);
    }

    function startClip() {
        st.clip?.cancel();
        st.clip = null;
        const { settings, stream } = env();
        if (settings.keep && stream) st.clip = createRecorder(stream, { video: stream.getVideoTracks().length > 0 });
        st.clipStart = performance.now();
        set.recSince(st.clip ? st.clipStart : null);
    }

    function ask(question) {
        clearTimers();
        quiet();
        discardAnswer();
        st.question = question;
        st.retry = null;
        st.captionsText = '';
        set.question(question);
        set.notice(null);
        set.coach(null);
        set.typed('');
        set.captionView({ text: '', interim: '' });
        set.answerSeconds(0);
        setPhase('asking');
        startClip();

        const text = question.question_text;
        const count = text.split(/\s+/).filter(Boolean).length;
        let shown = 0;
        let boundaries = false;
        let finished = false;
        set.reveal(0);
        set.orb('speaking');
        const revealTimer = every(() => {
            if (boundaries) return;
            shown = Math.min(count, shown + 1);
            set.reveal(shown);
        }, reduceMotion ? 20 : REVEAL_MS);
        const done = () => {
            if (finished || st.question !== question || st.phase !== 'asking') return;
            finished = true;
            clearInterval(revealTimer);
            st.timers.delete(revealTimer);
            set.reveal(count);
            set.orb('idle');
            afterAsk(question);
        };
        const { settings, voices } = env();
        if (settings.voice && voiceSupported && voices.length) {
            st.cancelSpeech = speak(text, {
                voiceURI: settings.voiceURI,
                onWord: (charIndex) => { boundaries = true; shown = Math.min(count, wordsUpTo(text, charIndex)); set.reveal(shown); },
                onEnd: () => later(done, 250),
            });
        } else {
            later(done, count * (reduceMotion ? 20 : REVEAL_MS) + 600);
        }
    }

    function afterAsk(question) {
        if (stepOf(question).kind === 'spoken' && !question.parent_id && env().settings.thinking && env().hasMic) think();
        else startAnswer();
    }

    function think() {
        clearTimers();
        let left = THINK_SECONDS;
        set.thinkLeft(left);
        setPhase('thinking');
        every(() => {
            left -= 1;
            set.thinkLeft(left);
            if (left <= 0) startAnswer();
        }, 1000);
    }

    function startAnswer() {
        const question = st.question;
        if (!question) return;
        clearTimers();
        quiet();
        discardAnswer();
        const { stream, hasMic, settings, meter, tracker } = env();
        set.reveal(9999);
        set.notice(null);
        set.typed('');
        set.captionView({ text: '', interim: '', unsupported: hasMic && !captionsSupported });
        st.captionsText = '';
        st.answerStart = performance.now();
        if (!st.clip) set.recSince(hasMic ? st.answerStart : null);
        if (hasMic) {
            st.audio = createRecorder(stream, { video: false });
            meter?.begin();
            if (settings.captions && captionsSupported) {
                st.captions = createCaptions({
                    lang: settings.lang,
                    onChange: (view) => { st.captionsText = view.text; set.captionView(view); },
                    onError: () => set.captionView(view => ({ ...view, unsupported: true })),
                });
                st.captions?.start();
            }
        }
        tracker?.begin();
        if (stepOf(question).kind === 'spoken') {
            setPhase(hasMic ? 'answering' : 'typing');
        } else {
            setPhase('working');
            st.talking = hasMic;
            set.talking(hasMic);
        }
        set.orb(hasMic ? 'listening' : 'idle');
        every(() => set.answerSeconds((performance.now() - st.answerStart) / 1000), 500);
    }

    async function collect() {
        const captions = st.captions ? st.captions.stop() : { text: '', segments: [] };
        st.captions = null;
        const audio = st.audio ? await st.audio.stop() : null;
        st.audio = null;
        const { meter, tracker } = env();
        const measured = meter ? meter.end() : null;
        const face = tracker ? tracker.end() : { eye_contact: null, face_in_frame: null };
        const wall = (performance.now() - st.answerStart) / 1000;
        const delivery = {
            duration: measured?.duration || wall,
            speaking: measured ? measured.speaking : null,
            pauses: measured ? measured.pauses : [],
            ...face,
            step_offset: st.clip ? Math.max(0, (st.answerStart - st.clipStart) / 1000) : 0,
        };
        return { captions, audio, delivery };
    }

    async function send({ typedText = null, code = '', language = '', image = null, notes = '' } = {}) {
        const question = st.question;
        if (!question || ['processing', 'finished', 'coach'].includes(st.phase)) return;
        const kind = stepOf(question).kind;
        clearTimers();
        quiet();
        setPhase('processing');
        set.orb('thinking');
        st.talking = false;
        set.talking(false);
        const ack = ACKNOWLEDGEMENTS[Math.floor(Math.random() * ACKNOWLEDGEMENTS.length)];
        set.ack(ack);
        say(ack);

        const { captions, audio, delivery } = await collect();
        let audioFile = null;
        if (typedText === null && audio?.blob?.size) {
            const wav = await toWav(audio.blob);
            const type = (audio.blob.type || 'audio/webm').split(';')[0];
            audioFile = wav ? new File([wav], 'answer.wav', { type: 'audio/wav' }) : new File([audio.blob], 'answer.webm', { type });
        }
        const form = new FormData();
        form.append('question_id', String(question.id));
        const text = typedText !== null ? typedText : [notes, captions.text].filter(Boolean).join('\n\n');
        form.append('text', text);
        form.append('text_source', typedText !== null || !captions.text ? 'typed' : 'captions');
        if (typedText === null && captions.segments.length) form.append('caption_segments', JSON.stringify(captions.segments));
        form.append('delivery', JSON.stringify(delivery));
        if (audioFile) form.append('audio', audioFile);
        if (kind === 'code') { form.append('code', code); form.append('language', language); }
        if (image) form.append('diagram', new File([image], 'whiteboard.png', { type: 'image/png' }));
        st.retry = { form, delivery };
        await post();
    }

    async function post() {
        const question = st.question;
        const { form, delivery } = st.retry;
        const kind = stepOf(question).kind;
        setPhase('processing');
        set.notice(null);
        set.orb('thinking');
        try {
            const { data } = await api.post(`/interviews/${interviewId}/video-answers`, form, { timeout: 180000 });
            if (st.disposed) return;
            st.retry = null;
            await keepClip(question, delivery);
            [codeDraftKey, boardDraftKey, notesDraftKey].forEach(key => writeDraft(key(question.id), null));
            if (env().settings.mode === 'coach') {
                st.pending = data;
                setPhase('coach');
                set.orb('idle');
                set.coach({
                    score: data.evaluation.score,
                    tip: firstSentences(data.evaluation.feedback, 2),
                    approx: data.evaluation.evaluator === 'fallback',
                    last: data.status === 'completed',
                });
                return;
            }
            advance(data);
        } catch (err) {
            if (st.disposed) return;
            const status = err.response?.status;
            const message = apiErrorMessage(err, 'Could not send your answer.');
            set.orb('idle');
            if (status === 409) {
                toast(message, { error: true });
                onReload();
                return;
            }
            const network = !err.response || status >= 500 || status === 408;
            if (!network) st.retry = null;
            if (kind === 'spoken') {
                setPhase('error');
                set.notice({ message: network ? `${message} Your answer is kept here, so you can send it again.` : message, retry: network, answerAgain: status === 422 || status === 400 });
            } else {
                // The code or drawing is still on screen; pick the think-aloud back up.
                if (!network) startAnswer();
                else setPhase('error');
                set.notice({ message: network ? `${message} Your answer is kept here, so you can send it again.` : message, retry: network });
            }
        }
    }

    async function keepClip(question, delivery) {
        if (!st.clip) { set.recSince(null); return; }
        const clip = await st.clip.stop();
        st.clip = null;
        set.recSince(null);
        await saveClip({ interviewId, questionId: question.id, stepIndex: question.step_index, blob: clip.blob, duration: clip.duration, answerOffset: delivery.step_offset });
    }

    function advance(data) {
        if (data.status === 'completed' || !data.next_question) {
            setPhase('finished');
            set.orb('speaking');
            say("That's the end of the interview. Thank you, you did the work. Let's look at your results.");
            later(() => onFinished(), 2600);
            return;
        }
        set.parentText(data.is_follow_up ? st.question.question_text : null);
        ask(data.next_question);
    }

    return {
        ask,
        replay() { if (st.phase === 'asking' || st.phase === 'thinking') ask(st.question); },
        skip() {
            if (st.phase !== 'asking') return;
            clearTimers();
            quiet();
            set.reveal(9999);
            set.orb('idle');
            afterAsk(st.question);
        },
        startNow() { if (st.phase === 'thinking') startAnswer(); },
        done() { if (st.phase === 'answering') send(); },
        restart() { if (['answering', 'error', 'typing'].includes(st.phase)) startAnswer(); },
        typeInstead() {
            if (!['answering', 'error'].includes(st.phase)) return;
            const said = st.captions?.snapshot().text || st.captionsText || '';
            st.captions?.stop();
            st.captions = null;
            st.audio?.cancel();
            st.audio = null;
            st.retry = null;
            clearTimers();
            set.typed(said);
            set.notice(null);
            set.orb('idle');
            setPhase('typing');
            every(() => set.answerSeconds((performance.now() - st.answerStart) / 1000), 500);
        },
        backToVoice() { if (st.phase === 'typing' && env().hasMic) startAnswer(); },
        submitTyped(text) { if (st.phase === 'typing' && text.trim()) send({ typedText: text.trim() }); },
        retry() { if (st.retry && st.phase === 'error') post(); },
        toggleTalk() {
            if (!st.audio || st.phase !== 'working') return;
            const { meter } = env();
            if (st.talking) { st.audio.pause(); st.captions?.pause(); meter?.pause(); set.orb('idle'); }
            else { st.audio.resume(); st.captions?.resume(); meter?.resume(); set.orb('listening'); }
            st.talking = !st.talking;
            set.talking(st.talking);
        },
        submitCode(code, language) { if (['working', 'error'].includes(st.phase)) { if (st.phase === 'error' && st.retry) { post(); return; } send({ code, language }); } },
        submitDesign({ image, notes }) { if (['working', 'error'].includes(st.phase)) { if (st.phase === 'error' && st.retry) { post(); return; } send({ image, notes }); } },
        showNotice(message) { set.notice({ message }); },
        continueCoach() {
            if (st.phase !== 'coach' || !st.pending) return;
            const data = st.pending;
            st.pending = null;
            set.coach(null);
            advance(data);
        },
        space() {
            if (st.phase === 'asking') this.skip();
            else if (st.phase === 'thinking') startAnswer();
            else if (st.phase === 'answering') send();
            else if (st.phase === 'coach') this.continueCoach();
        },
        async end() {
            clearTimers();
            quiet();
            discardAnswer();
            st.clip?.cancel();
            st.clip = null;
            set.recSince(null);
            st.disposed = true;
            await api.post(`/interviews/${interviewId}/finish`);
        },
        resumeAfterFailedEnd() {
            st.disposed = false;
            ask(st.question);
        },
        dispose() {
            st.disposed = true;
            clearTimers();
            quiet();
            discardAnswer();
            st.clip?.cancel();
            st.clip = null;
        },
    };
}
