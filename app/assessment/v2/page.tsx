'use client';

import React, { useState, useEffect, useRef } from 'react';
import InterviewSessionV2, { InterviewSessionV2Ref } from '@/components/InterviewSessionV2';
import AssessmentShield from '@/components/AssessmentShield';
import { Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function AssessmentV2Page() {
    const [started, setStarted] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [isTerminated, setIsTerminated] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [candidateName, setCandidateName] = useState('Test Candidate');
    const [jobTitle, setJobTitle] = useState('Senior Product Designer');
    const [completed, setCompleted] = useState(false);
    const [finishing, setFinishing] = useState(false);

    const interviewRef = useRef<InterviewSessionV2Ref>(null);

    useEffect(() => {
        // Generate a stable Session ID immediately
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        setSessionId(`v2_session_${timestamp}`);
    }, []);

    const handleStart = () => {
        setStarted(true);
    };

    const handleFinish = async (messages: any[], summaries: string[], recordingBlob: Blob | null, fullReport: string) => {
        setFinishing(true);
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let recordingPath = '';

            // 1. Direct Upload to Firebase if recording exists
            if (recordingBlob) {
                try {
                    console.log('[Assessment V2] Requesting signed upload URL...');
                    const fileName = `sessions/${sessionId}/recording.webm`;
                    const urlRes = await fetch('/api/archive/upload-url', {
                        method: 'POST',
                        body: JSON.stringify({ fileName, contentType: 'video/webm' }),
                    });

                    if (!urlRes.ok) throw new Error('Failed to get upload URL');
                    const { url } = await urlRes.json();

                    console.log('[Assessment V2] Uploading video directly to Firebase...');
                    const uploadRes = await fetch(url, {
                        method: 'PUT',
                        body: recordingBlob,
                        headers: { 'Content-Type': 'video/webm' }
                    });

                    if (!uploadRes.ok) throw new Error('Direct upload failed');
                    recordingPath = fileName;
                    console.log('[Assessment V2] Direct upload successful!');
                } catch (uploadErr) {
                    console.error('[Assessment V2] Video upload failed, proceeding with metadata only', uploadErr);
                }
            }

            // 2. Send Metadata to Archive API
            const formData = new FormData();
            formData.append('transcript', JSON.stringify(messages, null, 2));
            formData.append('report', fullReport);
            formData.append('jobId', 'V2-TEST-ROLE');
            formData.append('sessionId', sessionId);
            formData.append('timestamp', timestamp);
            formData.append('candidateName', candidateName);
            formData.append('candidateEmail', 'v2-candidate@example.com');
            if (recordingPath) {
                formData.append('recordingPath', recordingPath);
            }

            console.log('[Assessment V2] Archiving session metadata...');
            const archiveRes = await fetch('/api/archive', {
                method: 'POST',
                body: formData,
            });

            if (archiveRes.ok) {
                setCompleted(true);
            } else {
                setCompleted(true);
            }
        } catch (err) {
            console.error("Archive failed", err);
            setCompleted(true);
        } finally {
            setFinishing(false);
        }
    };

    const handleCheckpoint = async (transcript: any[], fullReport: string) => {
        try {
            const formData = new FormData();
            formData.append('transcript', JSON.stringify(transcript, null, 2));
            formData.append('report', fullReport);
            formData.append('jobId', 'V2-TEST-ROLE');
            formData.append('sessionId', sessionId);
            formData.append('candidateName', candidateName);

            fetch('/api/archive', {
                method: 'POST',
                body: formData,
            }).catch(err => console.error("Checkpoint failed", err));
        } catch (err) {
            console.error("Checkpoint error", err);
        }
    };

    if (finishing) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-12 h-12 text-[#0095A9] animate-spin mb-6" />
                <p className="text-xl text-slate-500 font-bold animate-pulse">Archiving Session Data...</p>
                <p className="text-sm text-slate-400 mt-2">Uploading high-fidelity report and recording</p>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500 font-sans">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-8">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-[#003040] mb-6 tracking-tight">Assessment Complete</h1>
                <p className="text-xl text-slate-500 max-w-lg mx-auto mb-12 leading-relaxed">
                    Thank you, <span className="font-bold text-slate-800">{candidateName}</span>. Your interview has been submitted successfully to our secure recruitment platform.
                </p>
                <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-200 max-w-sm w-full">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Next Steps</p>
                    <p className="text-slate-600 font-medium">
                        Your assessment is now being reviewed. Check with your Recruitment Coordinator for feedback.
                    </p>
                </div>
                <p className="mt-12 text-xs text-slate-400">You may now safely close this window.</p>
            </div>
        );
    }


    if (permissionDenied || isTerminated) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500 font-sans">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-8">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-[#003040] mb-6 tracking-tight">
                    Session Terminated
                </h1>
                <p className="text-xl text-slate-500 max-w-lg mx-auto mb-12 leading-relaxed">
                    {permissionDenied
                        ? "Screen sharing permission was denied. Full monitor sharing is mandatory to ensure assessment integrity."
                        : "A security protocol violation was detected. Your session has been automatically terminated for evaluation integrity."
                    }
                </p>
                <div className="p-8 bg-red-50 rounded-[32px] border-2 border-red-100 max-w-md w-full shadow-lg shadow-red-500/5">
                    <p className="text-xs font-black text-red-600 uppercase tracking-[0.2em] mb-3">Action Required</p>
                    <p className="text-slate-700 font-bold mb-4">
                        Please contact your Recruitment Coordinator or Delivery Manager to discuss next steps.
                    </p>
                    <div className="pt-4 border-t border-red-200/50 flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Incident Logged: {new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-12 text-sm font-bold text-slate-400 hover:text-[#0095A9] transition-colors uppercase tracking-widest"
                >
                    Return to Welcome Screen
                </button>
            </div>
        );
    }

    if (!started) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
                {/* Background Decorations */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[#0095A9]"></div>
                <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-[#0095A9]/5 rounded-full blur-3xl"></div>

                <div className="max-w-2xl w-full relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">
                        EPAM Systems <span className="text-[#0095A9]">•</span> Technical Assessment v2
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black text-[#003040] mb-6 tracking-tight">
                        Welcome, <br />
                        <span className="text-[#0095A9]">{candidateName}</span>
                    </h1>

                    <p className="text-xl text-slate-500 font-light mb-12 max-w-lg mx-auto leading-relaxed">
                        You have been invited to take the next-gen technical assessment for the role of <span className="font-bold text-slate-800">{jobTitle}</span>.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-xl mx-auto">
                        {[
                            { label: 'Estimated Time', value: '~45 Mins' },
                            { label: 'Format', value: 'Video & Code' },
                            { label: 'Proctoring', value: 'High Integrity' }
                        ].map((item) => (
                            <div key={item.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{item.label}</p>
                                <p className="text-sm font-bold text-[#003040]">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleStart}
                        className="group relative inline-flex items-center gap-3 px-10 py-5 bg-[#0095A9] text-white rounded-full text-lg font-bold shadow-[0_20px_40px_rgba(0,149,169,0.3)] hover:shadow-[0_30px_60px_rgba(0,149,169,0.4)] hover:-translate-y-1 transition-all duration-300"
                    >
                        Start Assessment
                        <Play className="w-5 h-5 fill-current" />
                    </button>

                    <p className="mt-8 text-xs text-slate-400 max-w-md mx-auto">
                        By starting, you agree to the assessment protocol which includes full screen monitoring and session recording.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <AssessmentShield
                sessionId={sessionId}
                onViolation={(type, details) => {
                    console.warn(`[V2 Security] Violation: ${type} - ${details}`);
                    // Mirror V1 logic: Trigger background checkpoint on violation
                    handleCheckpoint([], `\n> [!CAUTION]\n> **Security Violation Detected**: ${type}\n> Details: ${details}\n> Timestamp: ${new Date().toISOString()}\n`);
                }}
                onTerminate={() => {
                    setIsTerminated(true);
                }}
                onRestartSharing={() => {
                    if (interviewRef.current) {
                        interviewRef.current.restartSharing();
                    }
                }}
            >
                <InterviewSessionV2
                    ref={interviewRef}
                    jobId="V2-TEST-ROLE"
                    candidateName={candidateName}
                    isTerminated={isTerminated}
                    onPermissionDenied={() => setPermissionDenied(true)}
                    onFinish={handleFinish}
                    onCheckpoint={handleCheckpoint}
                />
            </AssessmentShield>
        </div>
    );
}
