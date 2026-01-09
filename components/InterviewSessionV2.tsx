'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import {
    Send, Mic, MicOff, Video, VideoOff, MessageCircle, Info,
    CheckCircle2, AlertCircle, Clock, Zap, ListChecks,
    MessageSquare, Code, Layout, ChevronRight, LogOut,
    CheckCircle, ShieldCheck, Settings, Monitor, Play, ShieldAlert, Lock, XCircle,
    MonitorX, Maximize2, Shield
} from 'lucide-react';
import clsx from 'clsx';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { RoundDefinition, DEFAULT_FLOW } from '@/data/round_presets';
import FlowConfigurationModal from './interview/FlowConfigurationModal';

// --- Types ---
type Message = {
    role: 'user' | 'model';
    text: string;
};

interface InterviewSessionV2Props {
    jobId?: string;
    candidateName?: string;
    onResume?: (resumeText: string) => void;
    isTerminated?: boolean;
    initialScreenStream?: MediaStream | null;
    onPermissionDenied?: () => void;
    onFinish?: (messages: any[], summaries: string[], recordingBlob: Blob | null, fullReport: string) => void;
    onCheckpoint?: (transcript: any[], fullReport: string) => void;
    showConfig?: boolean;
}

export interface InterviewSessionV2Ref {
}

const InterviewSessionV2 = forwardRef<InterviewSessionV2Ref, InterviewSessionV2Props>(
    ({ jobId: initialJobId, candidateName: initialCandidateName, isTerminated, initialScreenStream, onPermissionDenied, onFinish, onCheckpoint, showConfig = false }, ref) => {
        const router = useRouter();

        // -- State: Modular Flow --
        const [flow, setFlow] = useState<RoundDefinition[]>(DEFAULT_FLOW);
        const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
        const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
        const [hydrated, setHydrated] = useState(false);

        // -- Candidate/Job State (Internal) --
        const [jobId, setJobId] = useState(initialJobId || '');
        const [candidateName, setCandidateName] = useState(initialCandidateName || '');
        const [skills, setSkills] = useState<string[]>([]);
        const [customInstructions, setCustomInstructions] = useState('');

        // -- Derived State --
        const currentRound = flow[currentRoundIndex] || flow[0];
        const isLastRound = currentRoundIndex >= flow.length - 1;

        // -- Core State --
        const [isActive, setIsActive] = useState(false);
        const [messages, setMessages] = useState<Message[]>([]);
        const [input, setInput] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 mins default
        const [isTransitioning, setIsTransitioning] = useState(false);
        const [transitionMessage, setTransitionMessage] = useState('');
        const [technicalReport, setTechnicalReport] = useState<string>('');
        const [roundSummaries, setRoundSummaries] = useState<Record<string, string[]>>({});
        const [questionCount, setQuestionCount] = useState(0);

        // -- Media State --
        const [isRecording, setIsRecording] = useState(false);
        const [stream, setStream] = useState<MediaStream | null>(null);
        const videoRef = useRef<HTMLVideoElement>(null);
        const hasInitializedRef = useRef(false);
        const chunksRef = useRef<Blob[]>([]);
        const recorderRef = useRef<MediaRecorder | null>(null);
        const activeStreamsRef = useRef<MediaStream[]>([]);
        const messagesRef = useRef<Message[]>([]);

        useImperativeHandle(ref, () => ({
        }));

        // -- Speech State --
        const [isListening, setIsListening] = useState(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognitionRef = useRef<any>(null);

        // -- Coding/Design State --
        const [code, setCode] = useState('// Your workspace is ready...');
        const [executionOutput, setExecutionOutput] = useState('');

        // --- Hydration ---
        useEffect(() => {
            const hydrate = async () => {
                const params = new URLSearchParams(window.location.search);
                const sessionId = params.get('sessionId');
                const token = params.get('token');

                if (sessionId) {
                    try {
                        const res = await fetch(`/api/session/${sessionId}`);
                        if (res.ok) {
                            const data = await res.json();
                            setFlow(data.config.customFlow || DEFAULT_FLOW);
                            setCandidateName(data.candidateName || '');
                            setJobId(data.jobId || '');
                            setSkills(data.skills || []);
                            setCustomInstructions(data.config.customInstructions || '');
                        }
                    } catch (e) {
                        console.error("Failed to hydrate from sessionId", e);
                    }
                } else if (token) {
                    // Legacy Token Decoder
                    try {
                        const jsonStr = decodeURIComponent(atob(token).split('').map((c) => {
                            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                        }).join(''));
                        const data = JSON.parse(jsonStr);
                        setFlow(data.config?.customFlow || DEFAULT_FLOW);
                        setCandidateName(data.candidateName || '');
                        setJobId(data.jobId || '');
                        setSkills(data.skills || []);
                        setCustomInstructions(data.config?.customInstructions || '');
                    } catch (e) {
                        console.error("Failed to hydrate from token", e);
                    }
                }
                setHydrated(true);
            };
            hydrate();
        }, []);

        // --- Media Setup ---
        // --- Media Synchronization ---
        useEffect(() => {
            if (videoRef.current && stream) {
                videoRef.current.srcObject = stream;
            }
        }, [stream]);

        // --- Media Setup ---
        const setupMedia = async () => {
            if (hasInitializedRef.current) return;
            hasInitializedRef.current = true;

            try {
                let screenStream: MediaStream;

                if (initialScreenStream && initialScreenStream.active) {
                    console.log("[V2] Using pre-initialized screen stream.");
                    screenStream = initialScreenStream;
                } else {
                    // Fallback to requesting Screen Sharing if not provided or inactive
                    // @ts-ignore - displayMedia is standard but types might lag
                    screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            // @ts-ignore
                            displaySurface: 'monitor'
                        },
                        audio: false
                    });
                }

                const settings = screenStream.getVideoTracks()[0].getSettings();

                // Robust validation for displaySurface
                // @ts-ignore
                if (settings.displaySurface && settings.displaySurface !== 'monitor') {
                    screenStream.getTracks().forEach(t => t.stop());
                    alert("Security Policy Violation: You must share your ENTIRE SCREEN (Monitor) to proceed.\n\nThe session will now restart. Please ensure you select the 'Entire Screen' tab in the sharing picker.");
                    setIsActive(false);
                    window.location.reload();
                    return;
                }

                // Handle screen share stop
                screenStream.getVideoTracks()[0].onended = () => {
                    console.warn("[V2] Screen sharing track ended. Terminating session.");
                    if (isActive && onPermissionDenied) {
                        onPermissionDenied();
                    }
                };

                const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

                // --- Recording Setup ---
                const combinedStream = new MediaStream([
                    ...screenStream.getTracks(),
                    ...userStream.getAudioTracks()
                ]);

                const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
                recorderRef.current = recorder;
                chunksRef.current = [];
                activeStreamsRef.current = [screenStream, userStream];

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data);
                };
                recorder.start(1000);

                setStream(userStream);
                setIsActive(true);
            } catch (e: any) {
                hasInitializedRef.current = false; // Allow retry

                if (e.name === 'NotAllowedError' || e.message?.includes('Permission denied')) {
                    setIsActive(false); // CRITICAL: Prevent session from starting
                    if (onPermissionDenied) {
                        onPermissionDenied();
                    }
                } else {
                    console.error("Media setup failed unexpectedly:", e);
                }
            }
        };

        useEffect(() => {
            setupMedia();
        }, []);

        // --- Integrity: Termination ---
        useEffect(() => {
            if (isTerminated && isActive) {
                setIsActive(false);
                // Parent page handles UI switch via state
            }
        }, [isTerminated, isActive]);

        // --- Initial AI Trigger ---
        useEffect(() => {
            if (isActive && hydrated && messages.length === 0) {
                triggerAI(true);
            }
        }, [isActive, hydrated, messages.length]);

        // --- Timer ---
        useEffect(() => {
            if (!isActive) return;
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) return 0;
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }, [isActive]);


        // --- AI Logic ---
        const triggerAI = async (isStart = false, userReply?: string) => {
            setIsLoading(true);

            // Construct context based on CURRENT ROUND definition
            const roundContext = currentRound.systemPromptContext;
            const roundType = currentRound.type;

            const payload = {
                messages: isStart ? [] : [...messages, { role: 'user', text: userReply || 'Ready.' }],
                type: 'chat',
                selectedJobId: jobId,
                roundType: roundType, // V2 Specific
                roundContext: roundContext, // V2 Specific: Inject dynamic instructions
                isNewRound: isStart,
                // Include extra context
                customSkills: skills,
                customInstructions: customInstructions
            };

            try {
                const res = await fetch('/api/interview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.text) {
                    setMessages(prev => {
                        const next = userReply
                            ? [...prev, { role: 'user' as const, text: userReply }, { role: 'model' as const, text: data.text }]
                            : [...prev, { role: 'model' as const, text: data.text }];
                        messagesRef.current = next;
                        return next;
                    });

                    setQuestionCount(prev => prev + 1);

                    // --- Evaluation Capture ---
                    if (data.candidateNote && data.candidateNote.trim().length > 5) {
                        const roundKey = currentRound.id;
                        setRoundSummaries(prev => ({
                            ...prev,
                            [roundKey]: [...(prev[roundKey] || []), data.candidateNote]
                        }));

                        const roundTitle = currentRound.title;
                        const header = `\n## Round: ${roundTitle}\n`;

                        const evaluationTrip = `
${header}
- **Interviewer (AI):** ${data.text.substring(0, 100)}...
- **Candidate Reply:** ${userReply || 'N/A'}
- **AI Evaluation:**
${data.candidateNote}
`;
                        setTechnicalReport(prev => {
                            const next = prev + evaluationTrip;
                            if (onCheckpoint) onCheckpoint(messagesRef.current, next);
                            return next;
                        });
                    }
                }

                // Speak response
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel(); // Clear previous
                    const utterance = new SpeechSynthesisUtterance(data.text);
                    window.speechSynthesis.speak(utterance);
                }

            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        const handleSendMessage = async () => {
            if (!input.trim()) return;
            const txt = input;
            setInput('');
            await triggerAI(false, txt);
        };

        // --- Transitions ---
        const stopRecordingAndGetBlob = () => {
            return new Promise<Blob | null>((resolve) => {
                if (!recorderRef.current) {
                    activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                    resolve(null);
                    return;
                }

                if (recorderRef.current.state !== 'inactive') {
                    recorderRef.current.onstop = () => {
                        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                        activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                        resolve(blob);
                    };
                    recorderRef.current.stop();
                } else {
                    activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                    resolve(null);
                }
            });
        };

        const finishInterview = async () => {
            setIsActive(false);
            try {
                const blob = await stopRecordingAndGetBlob();
                let finalReport = technicalReport;

                if ((currentRound.type === 'CODING' || currentRound.type === 'SYSTEM_DESIGN') && code.trim().length > 20) {
                    finalReport += `\n\n## FINAL WORKSPACE CAPTURE\n\`\`\`\n${code}\n\`\`\`\n`;
                }

                const flatSummaries = Object.entries(roundSummaries).flatMap(([r, notes]) =>
                    notes.length > 0 ? [`### PHASE: ${r}`, ...notes] : []
                );

                if (onFinish) {
                    onFinish(messagesRef.current, flatSummaries, blob, finalReport);
                } else {
                    router.push('/dashboard');
                }
            } catch (e) {
                console.error("Finish failed", e);
                if (onFinish) onFinish(messagesRef.current, [], null, technicalReport);
            }
        };

        const handleNextRound = () => {
            if (isLastRound) {
                finishInterview();
                return;
            }

            const nextIndex = currentRoundIndex + 1;
            setIsTransitioning(true);
            setTransitionMessage(`Preparing Round ${nextIndex + 1}: ${flow[nextIndex].title}...`);

            setTimeout(() => {
                setCurrentRoundIndex(nextIndex);
                setMessages(prev => [...prev, { role: 'model', text: `Transitioning to ${flow[nextIndex].title}...` }]);

                // Trigger AI with "isStart=true" to initialize the NEW round context
                triggerAI(true);
                setIsTransitioning(false);
            }, 3000);
        };


        // --- Helper UI ---
        const formatTime = (s: number) => {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m}:${sec < 10 ? '0' : ''}${sec}`;
        };

        return (
            <div className="flex h-[calc(100vh-64px)] bg-[#F8FAFC] overflow-hidden font-sans selection:bg-[#0095A9]/10 relative">
                {/* --- TRANSITION OVERLAY --- */}
                {isTransitioning && (
                    <div className="absolute inset-0 z-[200] bg-[#0095A9]/95 backdrop-blur-xl flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
                        <div className="w-20 h-20 border-4 border-white/30 border-t-white rounded-full animate-spin mb-8"></div>
                        <h2 className="text-3xl font-black tracking-tighter mb-2">ADVANCING TO NEXT ROUND</h2>
                        <p className="text-xl font-medium opacity-80">{transitionMessage}</p>
                    </div>
                )}
                {/* --- CONFIG MODAL --- */}
                {showConfig && (
                    <FlowConfigurationModal
                        isOpen={isConfigModalOpen}
                        onClose={() => setIsConfigModalOpen(false)}
                        currentFlow={flow}
                        onSaveFlow={(newFlow) => {
                            setFlow(newFlow);
                            setCurrentRoundIndex(0);
                            setMessages([]); // Reset chat
                            triggerAI(true); // Restart with new flow
                        }}
                    />
                )}

                {/* LEFT: Sidebar (20%) */}
                <div className="w-[20%] h-full bg-white border-r border-slate-200 flex flex-col shadow-sm">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-[#0095A9] rounded-xl flex items-center justify-center font-black text-white text-xs shadow-lg shadow-[#0095A9]/20">EP</div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 tracking-tight">EPAM</h2>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">Interviewer v2.0</p>
                            </div>
                        </div>

                        <div className="relative aspect-video rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden shadow-inner group">
                            {stream ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-200 bg-slate-50/50 backdrop-blur-sm">
                                    <AlertCircle className="w-8 h-8 opacity-20" />
                                </div>
                            )}
                            <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2 py-1 bg-white/80 backdrop-blur-md rounded-full border border-slate-200 shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest">Live Feed</span>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="flex items-center justify-between px-4 py-4 bg-slate-50 rounded-2xl border border-slate-200 transition-colors hover:bg-slate-100">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-[#0095A9]" />
                                    <span className="text-xs font-bold text-slate-600">Session Timer</span>
                                </div>
                                <span className={clsx("text-sm font-mono font-black", timeLeft < 30 ? "text-red-500 animate-pulse" : "text-[#0095A9]")}>
                                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </span>
                            </div>

                            <div className="space-y-2 pt-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Stage</p>
                                {flow.map((round, idx) => {
                                    const isCurrent = currentRoundIndex === idx;
                                    const isCompleted = currentRoundIndex > idx;
                                    return (
                                        <div key={round.id} className={clsx(
                                            "px-4 py-3 rounded-xl flex items-center gap-3 border transition-all duration-300",
                                            isCurrent ? "bg-[#0095A9]/5 border-[#0095A9]/20 text-[#0095A9]" : "border-transparent text-slate-400"
                                        )}>
                                            {round.type === 'QUIZ' ? <ListChecks className="w-4 h-4" /> :
                                                round.type === 'CHAT' ? <MessageSquare className="w-4 h-4" /> :
                                                    round.type === 'CODING' ? <Code className="w-4 h-4" /> :
                                                        <Layout className="w-4 h-4" />}
                                            <span className="text-xs font-bold">{round.title}</span>
                                            {isCompleted && <CheckCircle size={12} className="ml-auto text-green-500" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleNextRound}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-[#0095A9] hover:bg-[#008496] text-white rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#0095A9]/20 group"
                                >
                                    {isLastRound ? 'Finish Interview' : 'Next Round'}
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-6 border-t border-slate-100">
                        {showConfig && (
                            <button
                                onClick={() => setIsConfigModalOpen(true)}
                                className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl transition-all duration-300 font-bold text-[10px] uppercase tracking-widest mb-2 border border-slate-100"
                            >
                                <Settings className="w-3.5 h-3.5" /> Customize Flow
                            </button>
                        )}
                        <button onClick={() => window.location.reload()} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-red-50/50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 hover:border-red-500 rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest group">
                            <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Quit Session
                        </button>
                    </div>
                </div>

                {/* MIDDLE: Dynamic Chat (35%) */}
                <div className="flex-1 h-full bg-white flex flex-col relative shadow-sm min-w-[35%]">
                    <div className="p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between relative z-10">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Technical Dialog</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Connected</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Phase</span>
                            <p className="text-lg font-black text-[#0095A9]">{currentRound.title}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200">
                        {messages.map((msg, i) => (
                            <div key={i} className={clsx("flex flex-col group", msg.role === 'user' ? "items-end" : "items-start")}>
                                <div className={clsx(
                                    "max-w-[90%] p-4 rounded-3xl text-[13.5px] leading-relaxed shadow-sm transition-all duration-300",
                                    msg.role === 'user'
                                        ? "bg-[#0095A9] text-white rounded-tr-none hover:-translate-y-0.5"
                                        : "bg-slate-50 text-slate-700 rounded-tl-none border border-slate-200 hover:-translate-y-0.5"
                                )}>
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <Markdown
                                            components={{
                                                code({ node, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { node?: any }) {
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    return match ? (
                                                        <SyntaxHighlighter
                                                            style={vscDarkPlus as any}
                                                            language={match[1]}
                                                            PreTag="div"
                                                            {...props}
                                                        >
                                                            {String(children).replace(/\n$/, '')}
                                                        </SyntaxHighlighter>
                                                    ) : (
                                                        <code className={className} {...props}>
                                                            {children}
                                                        </code>
                                                    )
                                                }
                                            }}
                                        >
                                            {msg.text}
                                        </Markdown>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2 px-1">
                                    {msg.role === 'user' ? 'Candidate' : 'Examiner'}
                                </span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 rounded-tl-none flex gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0095A9] animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0095A9] animate-bounce delay-75"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0095A9] animate-bounce delay-150"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-white border-t border-slate-100">
                        {/* Dictation Hints */}
                        <div className="flex justify-between items-center mb-3 px-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                <Mic size={12} className="text-[#0095A9]" />
                                <span>💡 Pro-Tip: Use Dictation to save time</span>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                    <span className="text-slate-400">WIN:</span> <span>⊞ + H</span>
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                    <span className="text-slate-400">MAC:</span> <span>Fn Fn</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                onPaste={(e) => {
                                    e.preventDefault();
                                    alert("Security Policy: Copy-Pasting is disabled for this session. Please type your answer or use dictation.");
                                }}
                                placeholder="Share your thoughts..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-16 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:border-[#0095A9]/30 transition-all duration-500 resize-none min-h-[60px] disabled:opacity-50"
                                rows={1}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-[#0095A9] text-white rounded-xl hover:bg-[#008496] disabled:opacity-30 transition-all transform hover:scale-105 active:scale-95 shadow-md shadow-[#0095A9]/10"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Workspace / Floating Info (45%) */}
                <div className="w-[45%] h-full bg-[#F1F5F9] border-l border-slate-200 flex flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col p-8 space-y-6 overflow-y-auto">
                        {/* Progress Tracker - Always Visible */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-[#0095A9] uppercase tracking-widest">
                                    Assessment Progress
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-600">
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Stage {currentRoundIndex + 1} of {flow.length}</span>
                                    <span className="font-black text-slate-700">
                                        {Math.round(((currentRoundIndex + 1) / flow.length) * 100)}%
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-[#0095A9] to-[#00B4CC] h-full transition-all duration-500 rounded-full"
                                        style={{ width: `${((currentRoundIndex + 1) / flow.length) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Round Specific Instructions / Evaluation */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-2 mb-4">
                                <ListChecks className="w-5 h-5 text-[#0095A9]" />
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">What We're Evaluating</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-slate-600">
                                {currentRound.type === 'QUIZ' ? (
                                    <>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#0095A9] mt-0.5 flex-shrink-0" />
                                            <span>Core technical knowledge</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#0095A9] mt-0.5 flex-shrink-0" />
                                            <span>Foundational concepts</span>
                                        </li>
                                    </>
                                ) : currentRound.type === 'CODING' ? (
                                    <>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#0095A9] mt-0.5 flex-shrink-0" />
                                            <span>Problem-solving depth</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#0095A9] mt-0.5 flex-shrink-0" />
                                            <span>Code quality and edge cases</span>
                                        </li>
                                    </>
                                ) : (
                                    <>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#0095A9] mt-0.5 flex-shrink-0" />
                                            <span>Conceptual clarity</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#0095A9] mt-0.5 flex-shrink-0" />
                                            <span>Communication efficiency</span>
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* Placeholder for future Monaco/Excalidraw */}
                        {(currentRound.type === 'CODING' || currentRound.type === 'SYSTEM_DESIGN') && (
                            <div className="bg-white rounded-2xl p-0 shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden min-h-[400px]">
                                <div className="bg-slate-900 px-4 py-2 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {currentRound.type} Workspace
                                    </span>
                                </div>
                                <textarea
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        alert("Security Policy: Pasting is disabled for this session.");
                                    }}
                                    onCopy={(e) => {
                                        e.preventDefault();
                                    }}
                                    onCut={(e) => {
                                        e.preventDefault();
                                    }}
                                    className="flex-1 w-full p-6 font-mono text-sm bg-slate-900 text-slate-50 resize-none focus:outline-none leading-relaxed"
                                    spellCheck={false}
                                    placeholder="Workspace initialized..."
                                />
                            </div>
                        )}

                        {/* Tips - Dynamic */}
                        <div className="bg-gradient-to-br from-[#0095A9]/5 to-[#00B4CC]/5 rounded-2xl p-6 border border-[#0095A9]/10">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-5 h-5 text-[#0095A9]" />
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Tip for This Round</h3>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {currentRound.type === 'QUIZ' ? "Take your time to read each question carefully." :
                                    currentRound.type === 'CHAT' ? "Explain your thought process clearly." :
                                        currentRound.type === 'CODING' ? "Focus on clean logic and performance." :
                                            "Focus on scalability and system trade-offs."}
                            </p>
                        </div>

                        {/* Branding / Helper */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-auto">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Session Identity</h3>
                            <p className="text-sm font-bold text-slate-700 mb-1">
                                Technical Assessment V2
                            </p>
                            <p className="text-xs text-slate-500">EPAM Interview Engine</p>
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                    <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                                        Full monitor sharing active. Session is being audited for integrity.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    });

export default InterviewSessionV2;
