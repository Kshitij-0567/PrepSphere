import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../../api/client';
import { useFeedback } from '../../components/ui/feedbackContext';
import CameraTile from './CameraTile';
import CodingStage from './CodingStage';
import DesignStage from './DesignStage';
import InterviewerOrb from './InterviewerOrb';
import SpokenStage from './SpokenStage';
import { CoachCard, EndDialog, Roadmap, RoomTopBar, StepHead } from './RoomParts';
import { createRoomController } from './lib/roomController';

const ORB_TEXT = { speaking: 'Speaking', listening: 'Listening to you', thinking: 'Thinking', idle: 'Waiting for you' };
const FOLLOW_UP_SECONDS = 90;

const InterviewRoom = ({ interview, meta, settings, onSettings, media, onToggleCamera, onToggleMic, meter, tracker, videoRef, voices }) => {
    const navigate = useNavigate();
    const { toast } = useFeedback();
    const plan = interview.plan;
    const [question, setQuestion] = useState(interview.current_question);
    const [parentText, setParentText] = useState(interview.parent_question || null);
    const [phase, setPhase] = useState('asking');
    const [reveal, setReveal] = useState(0);
    const [orb, setOrb] = useState('idle');
    const [captionView, setCaptionView] = useState({ text: '', interim: '' });
    const [answerSeconds, setAnswerSeconds] = useState(0);
    const [thinkLeft, setThinkLeft] = useState(15);
    const [typed, setTyped] = useState('');
    const [notice, setNotice] = useState(null);
    const [coach, setCoach] = useState(null);
    const [ack, setAck] = useState('');
    const [recSince, setRecSince] = useState(null);
    const [talking, setTalking] = useState(false);
    const [endOpen, setEndOpen] = useState(false);
    const [ending, setEnding] = useState(false);
    const [seconds, setSeconds] = useState(interview.elapsed_seconds || 0);

    // The controller reads the latest props through this ref instead of capturing them.
    const latest = useRef(null);
    const ctrl = useRef(null);
    useEffect(() => {
        latest.current = { settings, stream: media.stream, hasMic: media.hasMic, meter, tracker, voices };
    });

    useEffect(() => {
        const controller = createRoomController({
            interviewId: interview.id,
            plan: interview.plan,
            env: () => latest.current,
            set: {
                question: setQuestion,
                parentText: setParentText, phase: setPhase, reveal: setReveal, orb: setOrb, captionView: setCaptionView,
                answerSeconds: setAnswerSeconds, thinkLeft: setThinkLeft, typed: setTyped, notice: setNotice, coach: setCoach,
                ack: setAck, recSince: setRecSince, talking: setTalking,
            },
            onFinished: () => navigate(`/interviews/${interview.id}`, { replace: true }),
            onReload: () => window.location.reload(),
            toast,
        });
        ctrl.current = controller;
        controller.ask(interview.current_question);
        return () => controller.dispose();
    }, [interview, navigate, toast]);

    useEffect(() => {
        const started = performance.now();
        const base = interview.elapsed_seconds || 0;
        const id = setInterval(() => setSeconds(base + (performance.now() - started) / 1000), 1000);
        return () => clearInterval(id);
    }, [interview]);

    const step = plan[question.step_index];
    const isFollowUp = Boolean(question.parent_id);
    // A step counts as finished once its main question is answered.
    const finishedSteps = question.step_index + (isFollowUp ? 1 : 0);

    useEffect(() => {
        const onKey = (e) => {
            if (endOpen || e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target;
            if (target.closest?.('input, textarea, select, [contenteditable="true"], .cm-editor, .excalidraw')) return;
            if (step.kind !== 'spoken') return;
            if (e.code === 'Space' && !target.closest?.('button, a, [role="slider"]')) {
                e.preventDefault();
                ctrl.current?.space();
            } else if (e.key === 'r' || e.key === 'R') {
                ctrl.current?.replay();
            } else if (e.key === 'c' || e.key === 'C') {
                onSettings({ captions: !latest.current.settings.captions });
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [endOpen, step.kind, onSettings]);

    const endInterview = async () => {
        setEnding(true);
        try {
            await ctrl.current.end();
            navigate(`/interviews/${interview.id}`, { replace: true });
        } catch (err) {
            toast(apiErrorMessage(err, 'Could not end the interview. Try again.'), { error: true });
            setEnding(false);
            setEndOpen(false);
            ctrl.current.resumeAfterFailedEnd();
        }
    };

    const busy = phase === 'processing' || phase === 'finished' || phase === 'coach';
    const guideSeconds = isFollowUp ? FOLLOW_UP_SECONDS : step.minutes * 60;
    const captionText = [captionView.text, captionView.interim].filter(Boolean).join(' ');
    const spokenActions = {
        skip: () => ctrl.current?.skip(), start: () => ctrl.current?.startNow(), done: () => ctrl.current?.done(), restart: () => ctrl.current?.restart(),
        typeInstead: () => ctrl.current?.typeInstead(), backToVoice: () => ctrl.current?.backToVoice(), submitTyped: () => ctrl.current?.submitTyped(typed),
        retry: () => ctrl.current?.retry(), replay: () => ctrl.current?.replay(),
    };

    return (
        <main className="vi-room">
            <RoomTopBar
                meta={meta} step={step} stepNumber={question.step_index + 1} total={plan.length} seconds={seconds}
                voiceOn={settings.voice} captionsOn={settings.captions}
                onToggleVoice={() => onSettings({ voice: !settings.voice })} onToggleCaptions={() => onSettings({ captions: !settings.captions })}
                onEnd={() => setEndOpen(true)} ending={ending}
            />
            <aside className="vi-panel vi-rail" aria-label="Interviewer and your camera">
                <div className="vi-orb-box">
                    <InterviewerOrb state={orb} level={meter?.level} className="vi-orb" />
                    <div className="vi-orb-meta"><strong>Interviewer</strong><span className="vi-orb-state" aria-live="polite">{ORB_TEXT[orb]}</span></div>
                </div>
                <CameraTile
                    stream={media.stream} videoRef={videoRef} cameraOn={media.cameraOn} micOn={media.micOn}
                    onToggleCamera={media.hasCamera ? onToggleCamera : null} onToggleMic={media.hasMic ? onToggleMic : null}
                    tracker={tracker} showFrame={settings.eye} recordingSince={recSince} initials={meta.initials}
                />
                <Roadmap plan={plan} currentIndex={question.step_index} followUp={isFollowUp} />
            </aside>

            <div className="vi-stage">
                <StepHead step={step} stepNumber={question.step_index + 1} total={plan.length} plan={plan} currentIndex={question.step_index} />
                <div className="vi-stage-body">
                    {step.kind !== 'spoken' && notice && (
                        <div className="vi-notice" role="alert">
                            <p>{notice.message}</p>
                            {notice.retry && <div className="vi-row"><button type="button" className="vi-btn vi-primary vi-sm" onClick={() => ctrl.current?.retry()}>Try sending again</button></div>}
                        </div>
                    )}
                    {step.kind === 'spoken' && (
                        <SpokenStage
                            question={question} reveal={reveal} phase={phase} isFollowUp={isFollowUp} captionView={captionView}
                            captionsOn={settings.captions} micOn={media.micOn} lang={settings.lang} answerSeconds={answerSeconds}
                            guideSeconds={guideSeconds} thinkLeft={thinkLeft} typed={typed} onTyped={setTyped} notice={notice}
                            level={meter?.level} thinkingEnabled={settings.thinking} hasMic={media.hasMic} actions={spokenActions}
                        />
                    )}
                    {step.kind === 'code' && (
                        <CodingStage
                            key={question.id} question={question} reveal={reveal} guideSeconds={guideSeconds} stepSeconds={answerSeconds}
                            talking={talking} canTalk={media.hasMic && phase === 'working'} micOn={media.micOn} onToggleTalk={() => ctrl.current?.toggleTalk()}
                            captionText={captionText} busy={busy || phase === 'asking'} onSubmit={(code, language) => ctrl.current?.submitCode(code, language)}
                        />
                    )}
                    {step.kind === 'design' && (
                        <DesignStage
                            key={question.id} question={question} reveal={reveal} talking={talking} canTalk={media.hasMic && phase === 'working'}
                            onToggleTalk={() => ctrl.current?.toggleTalk()} captionText={captionText} busy={busy || phase === 'asking'}
                            onSubmit={(answer) => ctrl.current?.submitDesign(answer)} onError={(message) => ctrl.current?.showNotice(message)}
                        />
                    )}
                    {parentText && isFollowUp && step.kind === 'spoken' && phase === 'asking' && (
                        <p className="vi-fine vi-parent">Following up on: {parentText}</p>
                    )}
                    {(phase === 'processing' || phase === 'finished' || (phase === 'coach' && coach)) && (
                        <div className="vi-overlay">
                            {phase === 'coach' && coach ? <CoachCard coach={coach} onContinue={() => ctrl.current?.continueCoach()} /> : (
                                <div className="vi-processing" role="status">
                                    <InterviewerOrb state={phase === 'finished' ? 'speaking' : 'thinking'} className="vi-orb-small" />
                                    <p className="vi-ack">{phase === 'finished' ? 'That was the last step.' : `“${ack}”`}</p>
                                    <p className="vi-muted">
                                        {phase === 'finished' ? 'Opening your results' : settings.mode === 'coach' ? 'Scoring your answer' : 'The interviewer is thinking'}
                                        <span className="vi-dots" />
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <EndDialog open={endOpen} finished={finishedSteps} total={plan.length} onKeep={() => setEndOpen(false)} onEnd={endInterview} ending={ending} />
        </main>
    );
};

export default InterviewRoom;
