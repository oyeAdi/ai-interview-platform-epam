'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { JobDescription } from '@/types';
import interviewData from '@/data/interview_config.json';
import InterviewSession from '@/components/InterviewSession';
import { Loader2, AlertCircle, Play, CheckCircle } from 'lucide-react';

interface SessionToken {
    jobId: string;
    jobTitle: string;
    candidateName: string;
    candidateEmail: string;
    skills: string[];
    config?: any;
}

export default function AssessmentLanding() {
    const params = useParams();
    const router = useRouter();
    const [tokenData, setTokenData] = useState<SessionToken | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [started, setStarted] = useState(false);
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        try {
            const token = params.token as string;
            if (token) {
                // Decode Base64
                const jsonStr = atob(decodeURIComponent(token));
                const data = JSON.parse(jsonStr);

                // Backwards compatibility
                if (!data.config) {
                    data.config = {
                        customInstructions: '',
                        durations: { mcq: 2, conceptual: 5, coding: 7, systemDesign: 10 },
                        mcq: { enabled: true, maxQuestions: 7 }
                    };
                }

                setTokenData(data);
            } else {
                setError("Invalid assessment link.");
            }
        } catch (e) {
            console.error("Token decode error", e);
            setError("Assessment link is corrupted or invalid.");
        } finally {
            setLoading(false);
        }
    }, [params]);

    const handleFinish = async (messages: any[], summaries: string[], recordingBlob: Blob | null, fullReport: string) => {
        setCompleted(true);
        // Fire and forget archive for candidate
        try {
            const formData = new FormData();
            formData.append('transcript', JSON.stringify(messages, null, 2));
            formData.append('report', fullReport);
            if (recordingBlob) {
                formData.append('recording', recordingBlob, 'recording.webm');
            }
            formData.append('jobId', tokenData?.jobId || 'unknown');
            formData.append('candidateName', tokenData?.candidateName || 'Unknown');
            formData.append('candidateEmail', tokenData?.candidateEmail || '');

            // Let's rely on standard archive.
            await fetch('/api/archive', {
                method: 'POST',
                body: formData,
            });
        } catch (err) {
            console.error("Archive failed", err);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#0095A9] animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h1>
                <p className="text-slate-500">{error}</p>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h1 className="text-4xl font-black text-[#003040] mb-4">Assessment Complete</h1>
                <p className="text-xl text-slate-500 max-w-lg mx-auto mb-8">
                    Thank you, <span className="font-bold text-slate-800">{tokenData?.candidateName}</span>. Your interview has been submitted successfully using our internal secure channels.
                </p>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 max-w-sm w-full">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Next Steps</p>
                    <p className="text-sm text-slate-600">
                        Check with your Delivery Manager for feedback.
                    </p>
                </div>
                <p className="mt-12 text-xs text-slate-400">You may now close this window.</p>
            </div>
        );
    }

    if (started && tokenData) {
        return (
            <div className="min-h-screen bg-[#F8FAFC]">
                <InterviewSession
                    selectedJobId={tokenData.jobId}
                    customSkills={tokenData.skills}
                    onFinish={handleFinish}
                    candidateName={tokenData.candidateName}
                    mode="CANDIDATE"
                    config={tokenData.config}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-2 bg-[#0095A9]"></div>
            <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-[#0095A9]/5 rounded-full blur-3xl"></div>

            <div className="max-w-2xl w-full relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">
                    EPAM Systems <span className="text-[#0095A9]">•</span> Technical Assessment
                </div>

                <h1 className="text-5xl md:text-6xl font-black text-[#003040] mb-6 tracking-tight">
                    Welcome, <br />
                    <span className="text-[#0095A9]">{tokenData?.candidateName}</span>
                </h1>

                <p className="text-xl text-slate-500 font-light mb-12 max-w-lg mx-auto leading-relaxed">
                    You have been invited to take a technical assessment for the role of <span className="font-bold text-slate-800">{tokenData?.jobTitle}</span>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-xl mx-auto">
                    {[
                        { label: 'Time Limit', value: '~45 Mins' },
                        { label: 'Format', value: 'Video & Code' },
                        { label: 'Verification', value: 'AI Proctored' }
                    ].map((item) => (
                        <div key={item.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{item.label}</p>
                            <p className="text-sm font-bold text-[#003040]">{item.value}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setStarted(true)}
                    className="group relative inline-flex items-center gap-3 px-10 py-5 bg-[#0095A9] text-white rounded-full text-lg font-bold shadow-[0_20px_40px_rgba(0,149,169,0.3)] hover:shadow-[0_30px_60px_rgba(0,149,169,0.4)] hover:-translate-y-1 transition-all duration-300"
                >
                    Start Assessment
                    <Play className="w-5 h-5 fill-current" />
                </button>

                <p className="mt-8 text-xs text-slate-400 max-w-md mx-auto">
                    By starting, you agree to have your audio, video, and screen recorded for evaluation purposes.
                </p>
            </div>
        </div>
    );
}
