'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, AlertCircle, Code, MessageSquare, Layout, ChevronRight, Play, Terminal, LogOut, CheckCircle, Smartphone, Monitor, ShieldCheck, Zap, ListChecks } from 'lucide-react';
import { Message } from '@/types';
import clsx from 'clsx';

interface InterviewSessionProps {
    selectedJobId: string;
    customSkills?: string[];
    candidateName?: string;
    mode?: 'DM' | 'CANDIDATE';
    config?: {
        customInstructions: string;
        durations: { mcq: number; conceptual: number; coding: number; systemDesign: number };
        mcq: { enabled: boolean; maxQuestions: number };
        conceptual?: { maxQuestions: number };
        coding?: { enabled?: boolean; maxQuestions: number; focusAreas: string };
        systemDesign?: { enabled?: boolean };
    };
    onFinish: (transcript: Message[], summaries: string[], recordingBlob: Blob | null, fullReport: string) => void;
}

type Round = 'MCQ' | 'CONCEPTUAL' | 'CODING' | 'SYSTEM_DESIGN';

export default function InterviewSession({ selectedJobId, customSkills = [], candidateName = "Candidate", mode = 'DM', config, onFinish }: InterviewSessionProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [technicalReport, setTechnicalReport] = useState<string>('');
    const [input, setInput] = useState('');
    const [code, setCode] = useState('// Your code here...');
    const [currentRound, setCurrentRound] = useState<Round>(config?.mcq?.enabled ? 'MCQ' : 'CONCEPTUAL');
    const [currentChallenge, setCurrentChallenge] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState((config?.durations?.mcq || 2) * 60);
    const [isActive, setIsActive] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [consoleOutput, setConsoleOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [questionCount, setQuestionCount] = useState(0);
    const [codingChallengeCount, setCodingChallengeCount] = useState(1);
    const [roundSummaries, setRoundSummaries] = useState<Record<string, string[]>>({
        'MCQ': [],
        'CONCEPTUAL': [],
        'CODING': [],
        'SYSTEM_DESIGN': []
    });

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const messagesRef = useRef<Message[]>([]);
    const hasInitializedRef = useRef(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const activeStreamsRef = useRef<MediaStream[]>([]);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Initialize Timer based on starting round
    useEffect(() => {
        if (config?.durations) {
            const duration = config.durations[currentRound === 'MCQ' ? 'mcq' : currentRound === 'CONCEPTUAL' ? 'conceptual' : currentRound === 'CODING' ? 'coding' : 'systemDesign'] || 5;
            setTimeLeft(duration * 60);
        }
    }, [currentRound, config]);

    const triggerAI = async (customPrompt?: string, targetRound?: Round, isNewRound = false) => {
        setIsLoading(true);
        const activeRound = targetRound || currentRound;
        const roundNum = activeRound === 'MCQ' ? 0 : activeRound === 'CONCEPTUAL' ? 1 : activeRound === 'CODING' ? 2 : 3;

        const initialMessages = customPrompt
            ? [...messages, { role: 'user', text: customPrompt }]
            : (messages.length > 0 ? messages : [{ role: 'user', text: 'Start the interview.' }]);

        try {
            const res = await fetch('/api/interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: initialMessages,
                    selectedJobId,
                    type: 'chat',
                    round: roundNum,
                    customSkills,
                    isNewRound,
                    currentQuestion: messages.length > 0 ? currentQuestion : "",
                    customInstructions: config?.customInstructions, // Pass global instructions
                    codingFocusAreas: config?.coding?.focusAreas
                }),
            });
            const data = await res.json();
            if (data.text) {
                setMessages((prev) => [...prev, { role: 'model', text: data.text }]);
                // Update current question context for the next turn
                setCurrentQuestion(data.text);

                // Increment question count if AI asks a new question
                setQuestionCount(prev => prev + 1);

                if (data.codeSnippet) {
                    setCode(data.codeSnippet);
                }

                if (data.candidateNote && data.candidateNote.trim().length > 5) {
                    const roundKey = activeRound === 'SYSTEM_DESIGN' ? 'SYSTEM_DESIGN' : activeRound;
                    setRoundSummaries(prev => ({
                        ...prev,
                        [roundKey]: [...(prev[roundKey] || []), data.candidateNote]
                    }));

                    const roundTitle = activeRound.charAt(0) + activeRound.slice(1).toLowerCase().replace('_', ' ');
                    setTechnicalReport(prev => prev + `\n### ${roundTitle} - Note:\n- ${data.candidateNote}\n`);
                }
            } else {
                setMessages((prev) => [...prev, { role: 'model', text: "Ready. Let's begin." }]);
            }
        } catch (err) {
            console.error('Failed to trigger AI', err);
        } finally {
            setIsLoading(false);
        }
    };

    const runCheck = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setConsoleOutput('> Initializing AI Diagnostic Engine...\n> Integrating workspace knowledge...\n> Communicating with validation core...\n');

        try {
            const res = await fetch('/api/interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'validate',
                    selectedJobId,
                    code,
                    round: currentRound,
                    currentQuestion: currentQuestion || "General implementation validation",
                    customInstructions: config?.customInstructions
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Validation engine failed');
            }

            const data = await res.json();
            setConsoleOutput(data.text || '> Evaluation complete. Logic looks sound.');

            if (data.detailed_analysis) {
                const phaseTitle = currentRound === 'SYSTEM_DESIGN' ? 'SYSTEM DESIGN' : 'CODING CHALLENGE';
                setTechnicalReport(prev => prev + `\n\n### ${phaseTitle} - VALIDATION CHECK:\n${data.detailed_analysis}\n`);
            }
        } catch (err: any) {
            setConsoleOutput(`> ERROR: Verification process interrupted.\n> Reason: ${err.message || 'Unknown network failure.'}\n> Please try again in 5 seconds.`);
        } finally {
            setIsRunning(false);
        }
    };

    const stopRecordingAndGetBlob = () => {
        return new Promise<Blob | null>((resolve) => {
            if (!recorderRef.current) {
                // Safely stop tracks if recorder ref is gone
                if (activeStreamsRef.current) {
                    activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                    activeStreamsRef.current = [];
                }
                setStream(null);
                resolve(null);
                return;
            }

            const timeoutId = setTimeout(() => {
                console.warn("Recording stop timeout - forcing finish");
                resolve(null);
            }, 2000);

            if (recorderRef.current.state !== 'inactive') {
                recorderRef.current.onstop = () => {
                    clearTimeout(timeoutId);
                    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                    activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                    activeStreamsRef.current = [];
                    setStream(null);
                    resolve(blob);
                };
                recorderRef.current.stop();
            } else {
                clearTimeout(timeoutId);
                activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                activeStreamsRef.current = [];
                setStream(null);
                resolve(null);
            }
        });
    };

    const handleRoundTransition = async () => {
        setIsLoading(true);
        setQuestionCount(0); // Reset question count for next round

        if (currentRound === 'MCQ') {
            setCurrentRound('CONCEPTUAL');
            const transitionMsg = "MCQ round complete. Transitioning to Round 2: Conceptual Deep Dive.";
            setMessages(prev => [...prev, { role: 'model', text: transitionMsg }]);
            triggerAI('Transition to Conceptual Round. Ask the first conceptual question.', 'CONCEPTUAL', true);
        } else if (currentRound === 'CONCEPTUAL') {
            // Check if Coding is enabled
            if (config?.coding?.enabled) {
                setCurrentRound('CODING');
                const transitionMsg = "Conceptual round complete. Transitioning to Round 3: Practical / Coding.";
                setMessages(prev => [...prev, { role: 'model', text: transitionMsg }]);
                triggerAI('Transition to Coding Round. Provide a new coding challenge.', 'CODING', true);
            } else if (config?.systemDesign?.enabled) {
                setCurrentRound('SYSTEM_DESIGN');
                const transitionMsg = "Conceptual round complete. Transitioning to Round 4: Strategy / System Design.";
                setMessages(prev => [...prev, { role: 'model', text: transitionMsg }]);
                triggerAI('Transition to System Design Round. Provide a design scenario.', 'SYSTEM_DESIGN', true);
            } else {
                finishInterview();
            }
        } else if (currentRound === 'CODING') {
            const maxCodingQs = config?.coding?.maxQuestions || 1;
            if (codingChallengeCount < maxCodingQs) {
                // Stay in Coding Round, Next Question
                setCodingChallengeCount(prev => prev + 1);

                // --- ROLE AWARE PLACEHOLDER ---
                const isNonTech = (selectedJobId || '').includes('pm') || (selectedJobId || '').includes('hr');
                setCode(isNonTech ? 'Loading next case study...' : '// Next challenge loading...');

                setConsoleOutput('');
                const transitionMsg = `Coding Challenge ${codingChallengeCount} complete. Loading Challenge ${codingChallengeCount + 1}...`;
                setMessages(prev => [...prev, { role: 'model', text: transitionMsg }]);
                triggerAI(`Candidate finished question ${codingChallengeCount}. Move to Question ${codingChallengeCount + 1}. Provide a NEW and DIFFERENT coding problem than the previous ones.`, 'CODING', true);
            } else {
                // Check if System Design is enabled
                if (config?.systemDesign?.enabled) {
                    // CAPTURE CODING WORKSPACE BEFORE MOVING
                    setTechnicalReport(prev => prev + `\n\n## FINAL CODING WORKSPACE CAPTURE\n\`\`\`\n${code}\n\`\`\`\n`);

                    setCurrentRound('SYSTEM_DESIGN');
                    setCode('');
                    setCurrentChallenge('');
                    setConsoleOutput('');
                    const transitionMsg = "Coding round complete. Transitioning to Round 4: Strategy / System Design.";
                    setMessages(prev => [...prev, { role: 'model', text: transitionMsg }]);
                    triggerAI('Transition to System Design Round. Provide a design scenario.', 'SYSTEM_DESIGN', true);
                } else {
                    finishInterview();
                }
            }
        } else {
            finishInterview();
        }
        setIsLoading(false);
    };

    const finishInterview = async () => {
        setIsActive(false);
        try {
            const blob = await stopRecordingAndGetBlob();

            // Append the final round's workspace state to the report
            // Only if it's a workspace-enabled round and has content
            let finalConsolidatedReport = technicalReport;
            if ((currentRound === 'CODING' || currentRound === 'SYSTEM_DESIGN') && code.trim().length > 50) {
                finalConsolidatedReport += `\n\n## FINAL ${currentRound} WORKSPACE CAPTURE\n\`\`\`\n${code}\n\`\`\`\n`;
            }

            // Consolidate round-wise summaries into a flat array for the feedback generator
            const flatSummaries = Object.entries(roundSummaries).flatMap(([round, notes]) =>
                notes.length > 0 ? [`### PHASE: ${round}`, ...notes] : []
            );
            onFinish(messagesRef.current, flatSummaries, blob, finalConsolidatedReport);
        } catch (e) {
            console.error("Error during finish:", e);
            const flatSummaries = Object.entries(roundSummaries).flatMap(([round, notes]) =>
                notes.length > 0 ? [`### PHASE: ${round}`, ...notes] : []
            );
            onFinish(messagesRef.current, flatSummaries, null, technicalReport);
        }
    };

    const handleFinishEarly = async () => {
        if (confirm('Are you finished with the entire interview? This will submit your session for a final report.')) {
            setIsActive(false);
            try {
                const blob = await stopRecordingAndGetBlob();
                let finalConsolidatedReport = technicalReport;
                if ((currentRound === 'CODING' || currentRound === 'SYSTEM_DESIGN') && code.trim().length > 50) {
                    finalConsolidatedReport += `\n\n## FINAL ${currentRound} WORKSPACE CAPTURE\n\`\`\`\n${code}\n\`\`\`\n`;
                }
                onFinish(messagesRef.current, [], blob, finalConsolidatedReport);
            } catch (e) {
                console.error("Error during finish:", e);
                onFinish(messagesRef.current, [], null, technicalReport);
            }
        }
    };

    const sendMessage = async (messageOverride?: string) => {
        const messageToSend = messageOverride || input;
        if (!messageToSend.trim() || isLoading || !isActive) return;

        // Check Timer Lockdown
        if (timeLeft <= 0) {
            handleRoundTransition();
            return;
        }

        // Check Max Questions Limit
        let maxQs = 100;
        if (currentRound === 'MCQ') maxQs = config?.mcq?.maxQuestions || 7;
        if (currentRound === 'CONCEPTUAL') maxQs = config?.conceptual?.maxQuestions || 10;
        if (currentRound === 'CODING') maxQs = (config?.coding?.maxQuestions || 1) * 3; // Allow some back-and-forth but cap it

        if (questionCount >= maxQs) {
            handleRoundTransition();
            return;
        }

        const roundNum = currentRound === 'MCQ' ? 0 : currentRound === 'CONCEPTUAL' ? 1 : currentRound === 'CODING' ? 2 : 3;
        const userInput = (currentRound === 'CODING' || currentRound === 'SYSTEM_DESIGN')
            ? `[${currentRound} SUBMISSION]\n${code}\n\n[FOLLOW-UP RESPONSE]\n${messageToSend}`
            : messageToSend;

        const newMsg: Message = { role: 'user', text: userInput };
        const newHistory = [...messages, newMsg];
        setMessages(newHistory);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newHistory,
                    selectedJobId,
                    type: 'chat',
                    round: roundNum,
                    currentQuestion,
                    customInstructions: config?.customInstructions
                }),
            });
            const data = await res.json();
            if (data.text) {
                setMessages((prev) => [...prev, { role: 'model', text: data.text }]);
                setQuestionCount(prev => prev + 1);

                if (data.codeSnippet) {
                    setCode(data.codeSnippet);
                }

                if (data.candidateNote && data.candidateNote.trim().length > 5) {
                    const roundKey = currentRound === 'SYSTEM_DESIGN' ? 'SYSTEM_DESIGN' : currentRound;
                    setRoundSummaries(prev => ({
                        ...prev,
                        [roundKey]: [...(prev[roundKey] || []), data.candidateNote]
                    }));

                    const roundTitle = currentRound.charAt(0) + currentRound.slice(1).toLowerCase().replace('_', ' ');
                    setTechnicalReport(prev => prev + `\n### ${roundTitle} - Note:\n- ${data.candidateNote}\n`);
                }
            }
        } catch (err) {
            console.error('Failed to send message', err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Media Setup ---
    useEffect(() => {
        const setupRecording = async () => {
            if (hasInitializedRef.current) return;
            hasInitializedRef.current = true;

            try {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                setStream(userMediaStream);
                activeStreamsRef.current.push(userMediaStream);

                const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
                    video: true,
                    audio: true
                });
                activeStreamsRef.current.push(screenStream);

                const audioContext = new AudioContext();
                const dest = audioContext.createMediaStreamDestination();

                if (userMediaStream.getAudioTracks().length > 0) {
                    audioContext.createMediaStreamSource(userMediaStream).connect(dest);
                }
                if (screenStream.getAudioTracks().length > 0) {
                    audioContext.createMediaStreamSource(screenStream).connect(dest);
                }

                const combinedStream = new MediaStream([
                    ...screenStream.getVideoTracks(),
                    ...dest.stream.getAudioTracks()
                ]);

                const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data);
                };
                recorder.start();
                recorderRef.current = recorder;

                triggerAI();
            } catch (err) {
                console.error("Recording setup failed:", err);
                triggerAI();
            }
        };

        setupRecording();

        return () => {
            activeStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        };
    }, []);

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

    useEffect(() => {
        if (timeLeft === 0 && isActive) {
            handleRoundTransition();
        }
    }, [timeLeft, isActive]);

    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'model') {
            const raw = lastMsg.text;
            let extracted = '';

            const patterns = [
                /Problem #\d+:?\s*([\s\S]*?)(?=Follow-up|Points to cover|```|$)/i,
                /(?:Your task is to|Here is the problem:)\s*([\s\S]*?)(?=```|$)/i,
                /([\s\S]*?)(?=```[a-z]*\s*[\s\S]*?```|$)/i
            ];

            for (const p of patterns) {
                const match = raw.match(p);
                if (match && match[1]?.trim().length > 20) {
                    extracted = match[1].trim();
                    break;
                }
            }

            if (!extracted && raw.length > 5) {
                extracted = raw.split('```')[0].trim();
            }

            if (extracted) {
                const cleanExtracted = extracted.replace(/[#*`]/g, '').trim();
                setCurrentQuestion(cleanExtracted);
                if (currentRound === 'CODING' || currentRound === 'SYSTEM_DESIGN') {
                    setCurrentChallenge(cleanExtracted);
                    const isNonTech = (selectedJobId || '').includes('pm') || (selectedJobId || '').includes('hr');
                    const header = currentRound === 'CODING' ? (isNonTech ? "STRATEGY WORKSPACE" : "CODE EDITOR") : (isNonTech ? "STRATEGY BLUEPRINT" : "SYSTEM DESIGN WORKSPACE");

                    const techHint = currentRound === 'CODING' ? "// Start coding here..." : "// Design your system here...";
                    const nonTechHint = "Write your proposed strategy, action plan, and key considerations here...";

                    const initialContent = `/*\n  ${header}\n  ---------------------------\n  TASK: ${cleanExtracted}\n*/\n\n` + (isNonTech ? nonTechHint : techHint);

                    if (!code || code.trim().length < 10 || code.startsWith('/*\n  CODE EDITOR') || code.startsWith('/*\n  SYSTEM DESIGN')) {
                        setCode(initialContent);
                    }
                }
            }
        }
    }, [messages, currentRound]);

    return (
        <div className="fixed inset-0 z-[100] h-screen w-screen bg-[#F8FAFC] overflow-hidden flex font-sans text-slate-900">
            {/* Sidebar (20%) */}
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
                            {[
                                { id: 'MCQ', label: 'Round 1: Screening', icon: ListChecks },
                                { id: 'CONCEPTUAL', label: 'Round 2: Conceptual', icon: MessageSquare },
                                { id: 'CODING', label: 'Round 3: Practical', icon: Code },
                                { id: 'SYSTEM_DESIGN', label: 'Round 4: Design', icon: Layout }
                            ].map((stage) => (
                                <div key={stage.id} className={clsx(
                                    "px-4 py-3 rounded-xl flex items-center gap-3 border transition-all duration-300",
                                    currentRound === stage.id ? "bg-[#0095A9]/5 border-[#0095A9]/20 text-[#0095A9]" : "border-transparent text-slate-400",
                                    (stage.id === 'MCQ' && (!config?.mcq?.enabled)) ? 'hidden' : ''
                                )}>
                                    <stage.icon className={clsx("w-4 h-4", currentRound === stage.id ? "text-[#0095A9]" : "text-slate-200")} />
                                    <span className="text-xs font-bold">{stage.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleRoundTransition}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-[#0095A9] hover:bg-[#008496] text-white rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#0095A9]/20 group disabled:opacity-50"
                            >
                                {currentRound === 'SYSTEM_DESIGN' ? 'Finish' : (currentRound === 'CODING' && codingChallengeCount < (config?.coding?.maxQuestions || 1) ? 'Next Challenge' : 'Next Stage')}
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-6 border-t border-slate-100">
                    <button onClick={handleFinishEarly} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-red-50/50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 hover:border-red-500 rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest group">
                        <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Quit Session
                    </button>
                </div>
            </div>

            {/* Middle (35%) - Dynamic Chat */}
            <div className="flex-1 h-full bg-white flex flex-col relative shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between relative z-10">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Technical Dialog</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Connected</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Questions</span>
                        <p className="text-lg font-black text-[#0095A9]">{questionCount}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-10">
                            <Zap className="w-12 h-12 text-[#0095A9]" />
                            <p className="text-xs font-bold uppercase tracking-widest text-[#0095A9]">Initializing Protocol...</p>
                        </div>
                    )}
                    {messages.map((m, i) => {
                        const isTechnicalBlock = m.role === 'model' && (
                            m.text.includes('Problem #') ||
                            m.text.includes('ROUND 2') ||
                            m.text.includes('ROUND 3') ||
                            m.text.includes('```')
                        );

                        let displayChatText = m.text;
                        if (isTechnicalBlock) {
                            const segments = m.text.split(/Problem #\d+|ROUND \d|```/gi);
                            const preamble = segments[0]?.trim();
                            displayChatText = preamble && preamble.length > 5 ? preamble : "Please refer to the technical workspace for your next task.";
                        }

                        return (
                            <div key={i} className={clsx("flex flex-col group", m.role === 'user' ? "items-end" : "items-start")}>
                                <div className={clsx(
                                    "max-w-[90%] p-4 rounded-3xl text-[13.5px] leading-relaxed shadow-sm transition-all duration-300",
                                    m.role === 'user'
                                        ? "bg-[#0095A9] text-white rounded-tr-none hover:-translate-y-0.5"
                                        : "bg-slate-50 text-slate-700 rounded-tl-none border border-slate-200 hover:-translate-y-0.5"
                                )}>
                                    <p className="whitespace-pre-wrap font-medium">{displayChatText}</p>
                                </div>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2 px-1">
                                    {m.role === 'user' ? 'Candidate' : 'Examiner'}
                                </span>
                            </div>
                        );
                    })}
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
                    <div className="relative group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder={timeLeft <= 0 ? "Time is up for this round." : currentRound === 'MCQ' ? "Select an answer below or type here" : "Share your thoughts..."}
                            disabled={isLoading || !isActive || timeLeft <= 0}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-16 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:border-[#0095A9]/30 transition-all duration-500 resize-none min-h-[60px] disabled:opacity-50"
                            rows={1}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={isLoading || !input.trim() || timeLeft <= 0}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-[#0095A9] text-white rounded-xl hover:bg-[#008496] disabled:opacity-30 disabled:hover:bg-[#0095A9] transition-all transform hover:scale-105 active:scale-95 shadow-md shadow-[#0095A9]/10"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>

                    {/* MCQ Answer Buttons */}
                    {currentRound === 'MCQ' && (
                        <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quick Answer:</span>
                            {['A', 'B', 'C', 'D'].map((option) => (
                                <button
                                    key={option}
                                    onClick={() => {
                                        setInput(option);
                                    }}
                                    disabled={isLoading || timeLeft <= 0}
                                    className={`px-6 py-3 font-black text-sm rounded-xl disabled:opacity-30 transition-all transform hover:scale-105 active:scale-95 shadow-sm ${input === option
                                            ? 'bg-[#0095A9] text-white border-2 border-[#0095A9]'
                                            : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-[#0095A9] hover:bg-[#0095A9]/5 hover:text-[#0095A9]'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right (45%) - Workspace Panel */}
            <div className="w-[45%] h-full bg-[#F1F5F9] border-l border-slate-200 flex flex-col overflow-hidden">
                {currentRound === 'MCQ' || currentRound === 'CONCEPTUAL' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 animate-in fade-in duration-1000">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200/50">
                            <ShieldCheck className="w-10 h-10 text-[#0095A9]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-[0.2em] mb-4">Round {currentRound === 'MCQ' ? '01' : '02'}: {currentRound === 'MCQ' ? 'Screening' : 'Conceptual'}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                                {currentRound === 'MCQ' ? 'Rapid-fire validation of core concepts.' : 'Evaluating architectural patterns and conceptual depth.'}
                                The technical workspace will activate during the practical assessment.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-md pt-8 border-t border-slate-200">
                            <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-black text-[#0095A9] uppercase tracking-widest mb-1 italic">Security</p>
                                <p className="text-xs text-slate-600 font-bold italic tracking-tight">Active Protocol</p>
                            </div>
                            <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-black text-[#0095A9] uppercase tracking-widest mb-1 italic">Vitals</p>
                                <div className="flex items-center gap-2 justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]"></div>
                                    <p className="text-xs text-slate-600 font-bold italic">Nominal</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-slate-50 rounded-lg">
                                    {currentRound === 'CODING' ? <Code className="w-4 h-4 text-slate-400" /> : <Layout className="w-4 h-4 text-slate-400" />}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                        {currentRound === 'CODING'
                                            ? ((selectedJobId || '').includes('pm') || (selectedJobId || '').includes('hr') ? 'Strategy Module' : 'Logic Module')
                                            : ((selectedJobId || '').includes('pm') || (selectedJobId || '').includes('hr') ? 'Case Blueprint' : 'System Blueprint')}
                                    </h3>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Primary Workspace</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><Smartphone className="w-4 h-4" /></button>
                                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><Monitor className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 bg-white">
                            <textarea
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="flex-1 w-full bg-white text-slate-800 p-8 font-mono text-[14px] leading-relaxed resize-none focus:outline-none caret-[#0095A9] overflow-y-auto selection:bg-[#0095A9]/10"
                                spellCheck={false}
                            />

                            <div className="h-52 bg-[#0d1117] flex flex-col shadow-2xl">
                                <div className="px-5 py-3 border-b border-white/5 bg-[#161b22] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Standard Shell</span>
                                    </div>
                                    <button
                                        onClick={runCheck}
                                        disabled={isRunning}
                                        className="px-4 py-1.5 bg-[#0095A9] hover:bg-[#008496] text-[10px] text-white font-black rounded-lg transition-all transform active:scale-95 uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {isRunning ? 'Analyzing...' : ((selectedJobId || '').includes('pm') || (selectedJobId || '').includes('hr') ? 'Evaluate Plan' : 'Execute Checks')}
                                    </button>
                                </div>
                                <div className="flex-1 p-5 font-mono text-xs text-green-400/90 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                    <pre className="whitespace-pre-wrap">{consoleOutput || '> System ready. Awaiting instructions...'}</pre>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
