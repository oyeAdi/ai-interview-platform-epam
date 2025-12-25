'use client';

import React, { useState, useEffect } from 'react';
import interviewData from '@/data/interview_config.json';
import InterviewSession from '@/components/InterviewSession';
import InterviewConfigurator from '@/components/InterviewConfigurator';
import JobAdmin from '@/components/JobAdmin'; // Restored
import { Message, JobDescription } from '@/types'; // Restored
import { ChevronRight, CheckCircle, Settings, AlertCircle, LayoutDashboard } from 'lucide-react'; // Restored
import ReactMarkdown from 'react-markdown'; // Restored

export default function Home() {
    const [jobs, setJobs] = useState<JobDescription[]>([]);
    const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [transcript, setTranscript] = useState<Message[]>([]);
    const [feedback, setFeedback] = useState<string>('');
    const [loadingFeedback, setLoadingFeedback] = useState(false);
    const [customSkills, setCustomSkills] = useState<string[]>([]);

    // Fetch jobs on mount and when admin updates
    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/jobs');
            const data = await res.json();
            setJobs(data);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            // Fallback to static data if API fails
            setJobs(interviewData.uber_roles);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const handleSelectJob = (job: JobDescription) => {
        setSelectedJob(job);
    };

    const handleStart = () => { // Restored for the main button
        if (selectedJob) {
            setIsConfiguring(true); // Changed to start config instead of session immediately
        }
    };

    const handleStartSession = (skills: string[]) => {
        setCustomSkills(skills);
        setIsConfiguring(false);
        setIsStarted(true);
    };

    const handleFinish = async (messages: Message[], summaries: string[], recordingBlob: Blob | null, fullReport: string) => {
        setIsFinished(true);
        setTranscript(messages);
        setIsStarted(false);
        setLoadingFeedback(true);

        try {
            let finalReport = fullReport;

            // Optional: If the report is empty (e.g. early finish), generate a quick verdict
            if (!finalReport || finalReport.length < 50) {
                const feedbackRes = await fetch('/api/interview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: messages,
                        summaries: summaries, // Use the structured summaries array
                        selectedJobId: selectedJob?.id,
                        type: 'feedback',
                    }),
                });
                const feedbackData = await feedbackRes.json();
                finalReport = feedbackData.text || fullReport;
            }

            setFeedback(finalReport);

            // 2. Archive everything to server (No browser downloads)
            const formData = new FormData();
            formData.append('transcript', JSON.stringify(messages, null, 2));
            formData.append('report', finalReport);
            if (recordingBlob) {
                formData.append('recording', recordingBlob, 'recording.webm');
            }
            formData.append('jobId', selectedJob?.id || 'unknown');
            formData.append('timestamp', new Date().toISOString().replace(/[:.]/g, '-'));

            await fetch('/api/archive', {
                method: 'POST',
                body: formData,
            });
        } catch (err) {
            console.error('Error in post-interview pipeline:', err);
            if (loadingFeedback) setFeedback(fullReport || 'Analysis completed. Session archived to local directory.');
        } finally {
            setLoadingFeedback(false);
        }
    };

    // Add a safety timeout effect to prevent stuck loading
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (loadingFeedback) {
            timer = setTimeout(() => {
                setLoadingFeedback(false);
                if (!feedback) {
                    setFeedback('The technical engine is finishing up. Your session has been safely archived for review.');
                }
            }, 30000); // 30 second safety buffer
        }
        return () => clearTimeout(timer);
    }, [loadingFeedback, feedback]);

    if (isFinished) {
        return (
            <div className="min-h-screen bg-transparent p-8 flex flex-col items-center justify-center animate-in fade-in duration-1000">
                <div className="max-w-4xl w-full h-[85vh] flex flex-col bg-white rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-[#003040] p-8 text-white text-center">
                        <h1 className="text-3xl font-bold mb-2">Interview Report</h1>
                        <p className="opacity-70 font-light tracking-wide italic">EPAM Assessment for {selectedJob?.title}</p>
                    </div>

                    <div className="p-10 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 bg-white">
                        {loadingFeedback ? (
                            <div className="flex flex-col items-center justify-center space-y-6 py-20 text-center animate-in fade-in duration-700">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0095A9]"></div>
                                    <div className="absolute inset-0 flex items-center justify-center font-bold text-[10px] text-[#0095A9]">EPAM</div>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-gray-800 mb-2">Analyzing Performance...</p>
                                    <p className="text-gray-400 text-sm font-medium animate-pulse">Running advanced technical evaluation nodes...</p>
                                </div>
                            </div>
                        ) : feedback === 'Feedback error' || !feedback ? (
                            <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center animate-in slide-in-from-top duration-500">
                                <div className="p-4 bg-red-50 rounded-full">
                                    <AlertCircle size={48} className="text-red-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Generation Timeout</h3>
                                <p className="text-sm text-gray-500 max-w-sm">The technical engine took too long to analyze the transcript. Your session has been safely archived for manual review.</p>
                            </div>
                        ) : (
                            <div className="prose prose-slate max-w-none animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                <div className="mb-8 p-6 bg-[#0095A9]/5 rounded-2xl border border-[#0095A9]/10">
                                    <div className="flex items-center gap-2 text-[#0095A9] font-bold text-[10px] uppercase tracking-widest mb-1">
                                        <CheckCircle size={12} /> Technical Summary
                                    </div>
                                    <p className="text-xs text-gray-500 italic">This AI-generated assessment is based on code quality, architectural depth, and communication. A full transcript is archived in your project's `data/sessions/` directory.</p>
                                </div>
                                <ReactMarkdown
                                    components={{
                                        h1: ({ node, ...props }) => <h1 className="text-2xl font-black text-[#003040] mb-6 border-b pb-2" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-[#003040] mt-8 mb-4" {...props} />,
                                        p: ({ node, ...props }) => <p className="text-gray-700 leading-relaxed mb-4 text-[14px]" {...props} />,
                                        li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed mb-1 text-[14px]" {...props} />,
                                        strong: ({ node, ...props }) => <strong className="text-[#0095A9] font-bold" {...props} />
                                    }}
                                >
                                    {feedback}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-[#0095A9] text-white rounded-md hover:bg-[#008496] transition-all font-bold shadow-md"
                        >
                            Start New Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isConfiguring && selectedJob) {
        return (
            <InterviewConfigurator
                selectedJob={selectedJob}
                onStart={handleStartSession}
                onBack={() => setIsConfiguring(false)}
            />
        );
    }

    if (isStarted && selectedJob) {
        return (
            <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-4">
                <InterviewSession selectedJobId={selectedJob.id} customSkills={customSkills} onFinish={handleFinish} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-black">
            {/* Admin Overlay */}
            {isAdminOpen && <JobAdmin jobs={jobs} onUpdate={fetchJobs} onClose={() => setIsAdminOpen(false)} />}

            {/* Hero Section */}
            <div className="border-b border-gray-100 bg-white sticky top-0 z-10 backdrop-blur-md bg-opacity-95 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="font-extrabold text-3xl tracking-tighter text-[#0095A9]">
                            EPAM
                        </div>
                        <div className="h-6 w-[1px] bg-gray-300"></div>
                        <div className="font-bold text-sm tracking-[0.2em] text-gray-400 uppercase">
                            Uber
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <a
                            href="/dashboard"
                            className="p-3 text-gray-400 hover:text-[#0095A9] hover:bg-gray-50 rounded-full transition-all"
                            title="DM Dashboard"
                        >
                            <LayoutDashboard size={20} />
                        </a>
                        <button
                            onClick={() => setIsAdminOpen(true)}
                            className="p-3 text-gray-400 hover:text-[#0095A9] hover:bg-gray-50 rounded-full transition-all"
                            title="Manage Jobs"
                        >
                            <Settings size={20} />
                        </button>
                        <div className="hidden md:block text-[10px] font-bold px-3 py-1.5 bg-gray-100 rounded-full tracking-widest text-gray-500 uppercase border border-gray-200">
                            Technical Screening
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 py-20">
                <div className="mb-20">
                    <h1 className="text-6xl md:text-7xl font-black mb-8 tracking-tighter leading-[0.9] text-[#003040]">
                        Hire with <br /><span className="text-[#0095A9]">Confidence.</span>
                    </h1>
                    <p className="text-2xl text-gray-500 max-w-2xl font-light leading-relaxed">
                        Assess contractor capabilities for <span className="font-bold text-black italic">Uber</span> via our automated EPAM-vetted technical screening engine.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {jobs.map((role) => (
                        <div
                            key={role.id}
                            onClick={() => setSelectedJob(role)}
                            className={`
                relative p-10 rounded-3xl border-2 cursor-pointer transition-all duration-500
                ${selectedJob?.id === role.id
                                    ? 'border-[#0095A9] bg-white shadow-[0_30px_60px_rgba(0,149,169,0.15)] -translate-y-2'
                                    : 'border-transparent bg-[#f9f9f9] hover:bg-white hover:border-gray-200 hover:shadow-xl'
                                }
              `}
                        >
                            <div className="flex justify-between items-start mb-8">
                                <span className={`inline-block px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full border ${selectedJob?.id === role.id ? 'border-[#0095A9] text-[#0095A9] bg-[#0095A9]/5' : 'border-gray-300 text-gray-400'}`}>
                                    {role.level}
                                </span>
                                {selectedJob?.id === role.id && <CheckCircle size={24} className="text-[#0095A9]" />}
                            </div>

                            <h3 className="text-2xl font-bold mb-4 tracking-tight leading-tight">
                                {role.title.split(' - ')[1] || role.title}
                            </h3>

                            <p className="text-sm text-gray-500 mb-10 leading-relaxed font-light">
                                {role.description}
                            </p>

                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Must Have</p>
                                    <div className="flex flex-wrap gap-2">
                                        {role.must_have.slice(0, 3).map((skill, i) => (
                                            <span key={i} className="text-[#003040] font-bold text-[10px]">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                                {role.nice_to_have && role.nice_to_have.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Nice to Have</p>
                                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 font-medium">
                                            {role.nice_to_have.slice(0, 3).join(' • ')}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    ))}
                </div>

                <div className="mt-20 flex justify-center">
                    <button
                        onClick={handleStart}
                        disabled={!selectedJob}
                        className={`
              group flex items-center gap-4 px-16 py-6 rounded-full text-xl font-black transition-all duration-500
              ${selectedJob
                                ? 'bg-[#0095A9] text-white shadow-[0_20px_40px_rgba(0,149,169,0.4)] hover:bg-[#003040] hover:-translate-y-1'
                                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            }
            `}
                    >
                        Start Assessment <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </main>
        </div>
    );
}
