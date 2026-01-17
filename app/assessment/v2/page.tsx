'use client';

import React, { useState, useEffect, useRef } from 'react';
import InterviewSessionV2, { InterviewSessionV2Ref } from '@/components/InterviewSessionV2';
import AssessmentShield from '@/components/AssessmentShield';
import { Play, Loader2, AlertCircle, ShieldAlert, Monitor, ShieldCheck, MonitorX, Maximize2, Shield, Lock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

export default function AssessmentV2Page() {
    const [started, setStarted] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [isTerminated, setIsTerminated] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [candidateName, setCandidateName] = useState('');
    const [candidateEmail, setCandidateEmail] = useState('');
    const [jobId, setJobId] = useState('V2-TEST-ROLE');
    const [jobTitle, setJobTitle] = useState('Technical Assessment');
    const [completed, setCompleted] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [securitySetupComplete, setSecuritySetupComplete] = useState(false);
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
    const [hasConsented, setHasConsented] = useState(false);
    const [loading, setLoading] = useState(true);
    const [skills, setSkills] = useState<string[]>([]);
    const [customInstructions, setCustomInstructions] = useState('');
    const [flow, setFlow] = useState<any[]>([]); // We use any[] for now to match DEFAULT_FLOW
    const [client, setClient] = useState('Systems'); // Added client state
    const [alreadyCompleted, setAlreadyCompleted] = useState(false);
    const [completedAt, setCompletedAt] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0); // Added for XHR progress
    const interviewRef = useRef<InterviewSessionV2Ref>(null);

    useEffect(() => {
        const hydrate = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlSessionId = params.get('sessionId');
            const token = params.get('token');

            if (urlSessionId) {
                setSessionId(urlSessionId);
                try {
                    const res = await fetch(`/api/session/${urlSessionId}`);
                    if (res.ok) {
                        const data = await res.json();
                        console.log("[Assessment V2] Hydrated from sessionId:", {
                            candidateName: data.candidateName,
                            jobId: data.jobId,
                            client: data.client
                        });
                        setCandidateName(data.candidateName || 'Loading...');
                        setCandidateEmail(data.candidateEmail || '');
                        setJobId(data.jobId || 'V2-TEST-ROLE');
                        setJobTitle(data.jobTitle || data.config?.jobTitle || 'Technical Assessment');
                        setSkills(data.skills || []);
                        setCustomInstructions(data.config?.customInstructions || '');
                        setFlow(data.config?.customFlow || []);
                        setClient(data.client || 'Systems');
                    }
                } catch (e) {
                    console.error("Failed to hydrate from sessionId", e);
                }
            } else if (token) {
                try {
                    const jsonStr = decodeURIComponent(atob(token).split('').map((c) => {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    const data = JSON.parse(jsonStr);
                    console.log("[Assessment V2] Hydrated from token:", {
                        candidateName: data.candidateName,
                        jobId: data.jobId
                    });
                    setCandidateName(data.candidateName || 'Loading...');
                    setCandidateEmail(data.candidateEmail || '');
                    setJobId(data.jobId || 'V2-TEST-ROLE');
                    setJobTitle(data.jobTitle || 'Technical Assessment');
                    setSkills(data.skills || []);
                    setCustomInstructions(data.config?.customInstructions || '');
                    setFlow(data.config?.customFlow || []);

                    const ts = new Date().toISOString().replace(/[:.]/g, '-');
                    const newSessionId = `v2_session_${data.jobId || 'unknown'}_${ts}`;
                    setSessionId(newSessionId);

                    // Persist session ID in URL to prevent reset on reload
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('sessionId', newSessionId);
                    window.history.replaceState({}, '', newUrl);
                } catch (e) {
                    console.error("Failed to hydrate from token", e);
                }
            } else {
                // Default fallback
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                setSessionId(`v2_session_${ts}`);
            }

            // Check if session is already completed (prevent retakes)
            if (urlSessionId) {
                try {
                    const statusRes = await fetch(`/api/session/${urlSessionId}/status`, { cache: 'no-store' });
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        if (statusData.completed) {
                            console.log('[Assessment V2] Session already completed:', statusData.completedAt);
                            setAlreadyCompleted(true);
                            setCompletedAt(statusData.completedAt);
                        }
                    }
                } catch (e) {
                    console.error('[Assessment V2] Failed to check session status:', e);
                }
            }

            setLoading(false);
        };
        hydrate();
    }, []);

    const handleStart = () => {
        setStarted(true);
    };

    // --- PARALLEL MULTIPART UPLOADER ---
    const uploadMultipart = async (blob: Blob, fileName: string, setProgress: (p: number) => void) => {
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
        const totalParts = Math.ceil(blob.size / CHUNK_SIZE);

        // 1. Initialize
        const initRes = await fetch('/api/upload/multipart', {
            method: 'POST',
            body: JSON.stringify({ action: 'init', fileName, fileType: blob.type })
        });
        if (!initRes.ok) throw new Error("Failed to init multipart");
        const { uploadId, key } = await initRes.json();

        // 2. Prepare Chunks & Get Signed URLs
        const parts = [];
        for (let i = 0; i < totalParts; i++) {
            parts.push({ partNumber: i + 1 });
        }

        const signRes = await fetch('/api/upload/multipart', {
            method: 'POST',
            body: JSON.stringify({ action: 'sign_parts', uploadId, key, parts })
        });
        if (!signRes.ok) throw new Error("Failed to sign parts");
        const { signedUrls } = await signRes.json();

        // 3. Parallel Upload (Concurrency Limit: 3)
        let completedParts = 0;
        const uploadedParams: any[] = [];
        const CONCURRENCY = 3;

        const uploadChunk = async (partNum: number, url: string) => {
            const start = (partNum - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            const chunk = blob.slice(start, end);

            await fetch(url, {
                method: 'PUT',
                body: chunk
            });

            completedParts++;
            setProgress(Math.round((completedParts / totalParts) * 100));

            uploadedParams.push({ PartNumber: partNum, ETag: "ignored-by-r2-usually-but-needed" });
            // Note: Real S3 needs ETag from response. R2 might be lenient, or we need to capture Etag header.
            // For now assuming R2 + AWS SDK 'Complete' will verify presence on server side or we skip ETag check if possible.
            // ACTUALLY: CompleteMultipartUpload NEEDS ETags.
            // Fetch/XHR doesn't easily expose ETag unless CORS exposes it.
            // Let's assume standard AWS SDK behavior: We MUST extract ETag.
        };

        // Redoing uploadChunk to capture ETag
        const uploadChunkWithEtag = async (partNum: number, url: string) => {
            const start = (partNum - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            const chunk = blob.slice(start, end);

            return new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', url, true);
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const etag = xhr.getResponseHeader('ETag');
                        uploadedParams.push({ PartNumber: partNum, ETag: etag?.replaceAll('"', '') });
                        completedParts++;
                        setProgress(Math.round((completedParts / totalParts) * 100));
                        resolve();
                    } else {
                        reject(new Error(`Part ${partNum} failed`));
                    }
                };
                xhr.onerror = () => reject(new Error("Network Error"));
                xhr.send(chunk);
            });
        };

        // Execution Queue
        const queue = signedUrls.slice();
        const worker = async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (task) await uploadChunkWithEtag(task.partNumber, task.url);
            }
        };

        await Promise.all(Array(CONCURRENCY).fill(null).map(worker));

        // 4. Complete
        const completeRes = await fetch('/api/upload/multipart', {
            method: 'POST',
            body: JSON.stringify({
                action: 'complete',
                uploadId,
                key,
                parts: uploadedParams.sort((a, b) => a.PartNumber - b.PartNumber)
            })
        });

        if (!completeRes.ok) throw new Error("Multipart completion failed");
        return key; // Return the path
    };

    const handleFinish = async (messages: any[], summaries: string[], recordingBlob: Blob | null, fullReport: string) => {
        setFinishing(true);
        try {
            // 1. Archive Metadata (Fast)
            const formData = new FormData();
            formData.append('transcript', JSON.stringify(messages, null, 2));
            formData.append('report', fullReport);
            formData.append('jobId', jobId);
            formData.append('sessionId', sessionId);
            formData.append('candidateName', candidateName);
            formData.append('candidateEmail', candidateEmail);
            formData.append('client', client);

            // Mark as 'uploading' initially
            console.log('[Assessment V2] Saving Metadata...');
            await fetch('/api/archive', { method: 'POST', body: formData });

            // 2. Upload Video (Aggressive Parallel)
            if (recordingBlob) {
                console.log(`[Assessment V2] Starting Multipart Upload. Size: ${(recordingBlob.size / 1024 / 1024).toFixed(2)} MB`);
                try {
                    // Check if Multipart is supported backend-side
                    const checkRes = await fetch('/api/upload/multipart', { method: 'POST', body: JSON.stringify({ action: 'check' }) });
                    const { enabled } = await checkRes.json();

                    if (enabled) {
                        const fileKey = await uploadMultipart(recordingBlob, `${sessionId}_interview.webm`, setUploadProgress);

                        // Patch the record with video URL
                        const patchData = new FormData();
                        patchData.append('sessionId', sessionId);
                        patchData.append('recordingPath', fileKey);
                        await fetch('/api/archive', { method: 'POST', body: patchData });
                    } else {
                        throw new Error("Multipart disabled on server (Missing R2 Config)");
                    }
                } catch (e) {
                    console.warn("Multipart failed, falling back to legacy upload", e);
                    // Legacy XHR fallback...
                    const legacyForm = new FormData();
                    legacyForm.append('sessionId', sessionId);
                    legacyForm.append('recording', recordingBlob, 'interview.webm');

                    await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', '/api/archive', true);
                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
                        };
                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                resolve(xhr.response);
                            } else {
                                console.error("Legacy Upload Failed Status:", xhr.status, xhr.statusText, xhr.responseText);
                                reject(new Error(`Server Error: ${xhr.status} ${xhr.statusText}`));
                            }
                        };
                        xhr.onerror = () => reject(new Error("Network Error"));
                        xhr.send(legacyForm);
                    });
                }
            }

            setCompleted(true);
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
            formData.append('jobId', jobId);
            formData.append('sessionId', sessionId);
            formData.append('candidateName', candidateName);
            formData.append('candidateEmail', candidateEmail);
            formData.append('client', client); // Using contextual client

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
                <div className="w-64 h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
                    <div
                        className="h-full bg-[#0095A9] transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                    />
                </div>
                <p className="text-xs font-bold text-[#0095A9] mt-2">{uploadProgress}% Uploaded</p>
                <p className="text-sm text-slate-400 mt-2">Please do not close this window.</p>
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
                    onClick={() => window.location.href = '/candidate/dashboard'}
                    className="mt-12 text-sm font-bold text-slate-400 hover:text-[#0095A9] transition-colors uppercase tracking-widest flex items-center gap-2"
                >
                    Go to Candidate Dashboard <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500 font-sans">
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-[#003040] mb-6 tracking-tight">Assessment Complete</h1>
                <p className="text-xl text-slate-500 max-w-lg mx-auto mb-12 leading-relaxed">
                    Thank you, <span className="font-bold text-slate-800">{candidateName}</span>. Your interview has been submitted successfully to our secure recruitment platform.
                </p>
                <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-200 max-w-sm w-full">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Next Steps</p>
                    <p className="text-slate-600 font-medium">
                        Your assessment is now being reviewed. Check with your Delivery Manager or Recruitment Coordinator for the feedback.
                    </p>
                </div>
                <p className="mt-12 text-xs text-slate-400">You may now safely close this window.</p>
            </div>
        );
    }



    // Show loading state while hydrating
    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-[#0095A9] animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-400 font-medium">Loading assessment...</p>
                </div>
            </div>
        );
    }


    // Check if assessment was already completed (prevent retakes)
    if (alreadyCompleted) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-4">
                        Assessment Already Completed
                    </h1>
                    <p className="text-slate-600 mb-2">
                        This assessment was completed on:
                    </p>
                    <p className="text-lg font-bold text-[#0095A9] mb-8">
                        {completedAt ? new Date(completedAt).toLocaleString() : 'Unknown date'}
                    </p>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="text-sm text-slate-600">
                            You cannot retake this assessment. Please contact your recruiter if you believe this is an error.
                        </p>
                    </div>
                </div>
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
                        <span className="text-[#0095A9]">{candidateName || 'Candidate'}</span>
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



    if (started && !securitySetupComplete && !permissionDenied && !isTerminated) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
                <div className="max-w-3xl w-full bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 p-8 md:p-10 border border-slate-100 relative overflow-hidden">
                    {/* Decorative Header */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-[#0095A9] to-blue-500"></div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                            <ShieldAlert className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[#003040]">Security Protocol</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pre-Assessment Verification</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        {/* 1. Strict Monitor Sharing (Original - Compact) */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                                <Monitor className="w-3.5 h-3.5 text-[#0095A9]" />
                                Strict Monitor Sharing
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                You are required to share your <span className="font-black text-slate-900 underline decoration-[#0095A9]">ENTIRE SCREEN</span> (Monitor) for the duration of the assessment.
                            </p>
                        </div>

                        {/* 2 & 3. Merged Rules Grid (Compact) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-4 bg-red-50/50 rounded-xl border border-red-100/50">
                                <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Hardware Audit</p>
                                <p className="text-[11px] text-slate-600 font-medium leading-tight text-pretty">Second screens are forbidden. Dimension discrepancies trigger immediate review.</p>
                            </div>
                            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100/50">
                                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Focus Tracking</p>
                                <p className="text-[11px] text-slate-600 font-medium leading-tight text-pretty">1-second focus loss or multi-tab activity is logged to your report.</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Zero Tolerance</p>
                                <p className="text-[11px] text-slate-600 leading-tight">Selecting a single tab/window will cause an immediate setup failure.</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Termination Rule</p>
                                <p className="text-[11px] text-slate-600 leading-tight text-pretty">Stopping screen share or exiting fullscreen twice terminates session instantly.</p>
                            </div>
                        </div>

                        {/* 4. Anti-Bypass Protocols (Advanced Threat - Grid Layout) */}
                        <div className="p-4 bg-slate-900 rounded-2xl shadow-inner relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <Lock className="w-10 h-10 text-blue-400" />
                            </div>
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Shield className="w-2.5 h-2.5" />
                                Anti-Bypass Protocols Active
                            </h4>
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-400 font-medium">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                                    <span>DevTools detection</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                                    <span>AI Plagiarism Monitor</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                                    <span>Tab Handshake</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                                    <span>Clipboard Integrity</span>
                                </li>
                            </ul>
                        </div>

                        {/* 5. Consent Checkbox (Compact) */}
                        <div
                            onClick={() => setHasConsented(!hasConsented)}
                            className={clsx(
                                "p-4 border-2 rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-3",
                                hasConsented ? "border-[#0095A9] bg-slate-50" : "border-dashed border-slate-200 hover:border-slate-300"
                            )}
                        >
                            <div className={clsx(
                                "w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                                hasConsented ? "bg-[#0095A9] border-[#0095A9]" : "border-slate-300"
                            )}>
                                {hasConsented && <ShieldCheck className="w-3 h-3 text-white" />}
                            </div>
                            <p className={clsx(
                                "text-[11px] font-medium italic leading-normal transition-colors",
                                hasConsented ? "text-slate-800" : "text-slate-500"
                            )}>
                                "I understand that any attempt to bypass proctoring, including multi-tab usage, second screen mirroring, or DevTools activation, will be logged and reported."
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            disabled={!hasConsented}
                            onClick={async () => {
                                if (!hasConsented) return;
                                try {
                                    const stream = await navigator.mediaDevices.getDisplayMedia({
                                        video: {
                                            // @ts-ignore
                                            displaySurface: 'monitor'
                                        },
                                        audio: false
                                    });

                                    const settings = stream.getVideoTracks()[0].getSettings();
                                    // @ts-ignore
                                    if (settings.displaySurface && settings.displaySurface !== 'monitor') {
                                        stream.getTracks().forEach(t => t.stop());
                                        alert("SECURITY VIOLATION: You MUST select 'Entire Screen' to proceed.\n\nIndividual tabs or windows are not allowed.");
                                        return;
                                    }

                                    setActiveStream(stream);
                                    setSecuritySetupComplete(true);
                                } catch (err: any) {
                                    if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
                                        setPermissionDenied(true);
                                    } else {
                                        console.error("Strict media setup failed:", err);
                                    }
                                }
                            }}
                            className={clsx(
                                "w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl",
                                hasConsented
                                    ? "bg-[#003040] hover:bg-[#004050] text-white shadow-[#003040]/20 cursor-pointer"
                                    : "bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed"
                            )}
                        >
                            <ShieldCheck className="w-5 h-5 text-[#0095A9]" />
                            Validate & Start Assessment
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <AssessmentShield
                sessionId={sessionId}
                disabled={!securitySetupComplete}
                onViolation={(type, details) => {
                    console.warn(`[V2 Security] Violation: ${type} - ${details}`);
                    handleCheckpoint([], `\n> [!CAUTION]\n> **Security Violation Detected**: ${type}\n> Details: ${details}\n> Timestamp: ${new Date().toISOString()}\n`);
                }}
                onTerminate={async () => {
                    console.log('[V2 Security] Termination triggered - saving recording...');

                    // Force finish the interview to save the recording
                    if (interviewRef.current?.finishInterview) {
                        try {
                            await interviewRef.current.finishInterview();
                            console.log('[V2 Security] Recording saved successfully');
                        } catch (error) {
                            console.error('[V2 Security] Failed to save recording:', error);
                        }
                    }

                    // Then mark as terminated
                    setIsTerminated(true);
                }}
            >
                {loading ? (
                    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#0095A9] animate-spin mb-4" />
                        <p className="text-slate-500 font-bold animate-pulse">Loading Session...</p>
                    </div>
                ) : (
                    <InterviewSessionV2
                        ref={interviewRef}
                        jobId={jobId}
                        candidateName={candidateName}
                        skills={skills}
                        customInstructions={customInstructions}
                        initialFlow={flow.length > 0 ? flow : undefined}
                        isTerminated={isTerminated}
                        initialScreenStream={activeStream}
                        onPermissionDenied={async () => {
                            // Ensure session is archived before showing error screen
                            if (interviewRef.current) {
                                try {
                                    await interviewRef.current.finishInterview();
                                } catch (e) {
                                    console.error("Failed to archive on permission denied", e);
                                }
                            }
                            setPermissionDenied(true);
                        }}
                        onFinish={handleFinish}
                        onCheckpoint={handleCheckpoint}
                        showConfig={false}
                    />
                )}
            </AssessmentShield>
        </div>
    );
}
