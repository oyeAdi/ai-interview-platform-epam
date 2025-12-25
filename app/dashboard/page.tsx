'use client';

import React, { useState, useEffect } from 'react';
import { Play, FileText, Calendar, User, Search, Monitor, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Session {
    id: string;
    folderName: string;
    date: string;
    jobId: string;
    candidateName: string;
    candidateEmail?: string;
    reportPreview: string;
    hasFinalFeedback?: boolean;
}

export default function Dashboard() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [fullReport, setFullReport] = useState<string>('');
    const [loadingReport, setLoadingReport] = useState(false);
    const [finalFeedback, setFinalFeedback] = useState<any>(null);
    const [isFinalizing, setIsFinalizing] = useState(false);

    useEffect(() => {
        fetch('/api/dm/sessions')
            .then(res => res.json())
            .then(data => {
                setSessions(data.sessions);
                if (data.sessions.length > 0) {
                    setSelectedSession(data.sessions[0]);
                }
                setLoading(false);
            })
            .catch(err => console.error("Failed to load sessions", err));
    }, []);

    useEffect(() => {
        if (!selectedSession) return;

        async function loadContent() {
            setLoadingReport(true);
            setFinalFeedback(null);
            try {
                // 1. Load Markdown Report
                const reportRes = await fetch(`/api/dm/report?folder=${selectedSession?.folderName}&type=report`);
                if (reportRes.ok) {
                    const text = await reportRes.text();
                    setFullReport(text);
                }

                // 2. Load Final Feedback if exists
                if (selectedSession?.hasFinalFeedback) {
                    const finalRes = await fetch(`/api/dm/report?folder=${selectedSession?.folderName}&type=final`);
                    if (finalRes.ok) {
                        const data = await finalRes.json();
                        setFinalFeedback(data);
                    }
                }
            } catch (e) {
                console.error("Error loading content", e);
            } finally {
                setLoadingReport(false);
            }
        }
        loadContent();
    }, [selectedSession]);

    const generateFinalFeedback = async () => {
        if (!selectedSession) return;
        setIsFinalizing(true);
        try {
            const res = await fetch('/api/dm/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: selectedSession.folderName })
            });

            if (res.ok) {
                const data = await res.json();
                setFinalFeedback(data);

                // Update local session state to mark it as finalized
                setSessions(prev => prev.map(s =>
                    s.id === selectedSession.id ? { ...s, hasFinalFeedback: true } : s
                ));
            }
        } catch (err) {
            console.error("Failed to finalize", err);
        } finally {
            setIsFinalizing(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-[#0095A9] font-bold">Loading Dashboard...</div>;

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            {/* Sidebar List */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-xl font-black text-[#003040] mb-2">EPAM Manager</h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Interview History</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className={`p-5 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${selectedSession?.id === session.id ? 'bg-[#0095A9]/5 border-l-4 border-l-[#0095A9]' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-[#0095A9] uppercase tracking-wider">{session.jobId}</span>
                                <span className="text-[10px] text-slate-400">{new Date(session.date).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm mb-1">{session.candidateName}</h3>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <Monitor size={10} />
                                    <span>Recording</span>
                                </div>
                                {session.hasFinalFeedback && (
                                    <span className="text-[8px] font-black text-emerald-500 uppercase flex items-center gap-0.5">
                                        <CheckCircle2 size={10} /> Finalized
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {selectedSession ? (
                    <div className="flex-1 flex flex-col h-full">
                        {/* Header */}
                        <div className="p-5 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                            <div>
                                <h2 className="text-2xl font-black text-[#003040] flex items-center gap-3">
                                    {selectedSession.candidateName}
                                    <span className="text-base font-normal text-slate-400">|</span>
                                    <span className="text-lg text-[#0095A9] font-bold">{selectedSession.jobId}</span>
                                </h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {selectedSession.candidateEmail} &bull; ID: {selectedSession.folderName}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {!finalFeedback && (
                                    <button
                                        onClick={generateFinalFeedback}
                                        disabled={isFinalizing}
                                        className="px-6 py-2.5 bg-[#003040] hover:bg-[#003040]/90 text-white text-xs font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {isFinalizing ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                        {isFinalizing ? 'Synthesizing...' : 'Generate Final Feedback'}
                                    </button>
                                )}
                                {finalFeedback && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-black text-emerald-600 uppercase tracking-wider">
                                        <CheckCircle2 size={16} />
                                        Locked: {finalFeedback.verdict}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content Split */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Video & Summary Card */}
                            <div className="w-[45%] bg-slate-100 flex flex-col border-r border-slate-200">
                                <div className="bg-black aspect-video relative group flex items-center justify-center">
                                    <video
                                        key={selectedSession.folderName}
                                        src={`/api/dm/video?folder=${selectedSession.folderName}`}
                                        controls
                                        className="w-full h-full"
                                    />
                                </div>

                                {/* Final Verdict Card */}
                                <div className="flex-1 p-6 overflow-y-auto">
                                    {finalFeedback ? (
                                        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            <div className="p-4 bg-gradient-to-r from-[#003040] to-[#0095A9] text-white">
                                                <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Final Delivery Verdict</h3>
                                                <div className="flex justify-between items-end">
                                                    <span className="text-xl font-black">{finalFeedback.verdict}</span>
                                                    <span className="text-[10px] font-bold opacity-70">AI-Synthesized</span>
                                                </div>
                                            </div>

                                            <div className="p-5 space-y-6">
                                                <div className="grid grid-cols-1 gap-4">
                                                    <SummaryItem icon={<Monitor className="text-[#0095A9]" size={16} />} title="Technical" text={finalFeedback.technical} />
                                                    <SummaryItem icon={<User className="text-[#0095A9]" size={16} />} title="Behavioral" text={finalFeedback.behavioral} />
                                                    <SummaryItem icon={<FileText className="text-[#0095A9]" size={16} />} title="Communication" text={finalFeedback.communication} />
                                                </div>

                                                <div className="pt-4 border-t border-slate-100">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Overall Feedback</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-3 bg-emerald-50 rounded-xl">
                                                            <div className="text-[10px] font-bold text-emerald-600 mb-2 uppercase tracking-tight">Strengths</div>
                                                            <ul className="text-[11px] text-slate-600 space-y-1">
                                                                {finalFeedback.feedback.strengths.slice(0, 3).map((s: string, i: number) => (
                                                                    <li key={i} className="flex items-start gap-1.5 line-clamp-2">
                                                                        <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                                                                        {s}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="p-3 bg-amber-50 rounded-xl">
                                                            <div className="text-[10px] font-bold text-amber-600 mb-2 uppercase tracking-tight">Improvements</div>
                                                            <ul className="text-[11px] text-slate-600 space-y-1">
                                                                {finalFeedback.feedback.improvements.slice(0, 3).map((s: string, i: number) => (
                                                                    <li key={i} className="flex items-start gap-1.5 line-clamp-2">
                                                                        <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                                                        {s}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl opacity-50">
                                            <ShieldCheck size={48} className="text-slate-300 mb-4" />
                                            <h3 className="font-bold text-slate-400 mb-2">Awaiting Final Verdict</h3>
                                            <p className="text-xs text-slate-400 max-w-[200px]">Review the full report on the right, then generate the final summary.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Full Report */}
                            <div className="flex-1 bg-white h-full overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-200">
                                {loadingReport ? (
                                    <div className="flex items-center justify-center h-full text-slate-400">
                                        <RefreshCw size={24} className="animate-spin text-[#0095A9] mb-4" />
                                    </div>
                                ) : (
                                    <div className="prose prose-sm max-w-none prose-slate">
                                        <div className="mb-6 p-4 bg-[#0095A9]/5 border border-[#0095A9]/20 rounded-xl">
                                            <h3 className="text-[#0095A9] font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <FileText size={14} /> Full Interview Report
                                            </h3>
                                            <p className="text-xs text-slate-600 italic">
                                                Raw evaluative data and notes captured during the session rounds.
                                            </p>
                                        </div>
                                        <ReactMarkdown
                                            components={{
                                                h1: ({ node, ...props }) => <h1 className="text-xl font-black text-[#003040] border-b pb-2 mb-4" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-[#003040] mt-6 mb-3" {...props} />,
                                                li: ({ node, ...props }) => <li className="text-slate-700 my-1 font-medium" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="text-[#0095A9] font-bold" {...props} />
                                            }}
                                        >
                                            {fullReport}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                        <User size={64} className="mb-4 opacity-20" />
                        <h2 className="text-xl font-bold">Select a session</h2>
                        <p className="text-sm">Choose a candidate from the left to view reports</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryItem({ icon, title, text }: { icon: any, title: string, text: string }) {
    return (
        <div className="flex gap-3">
            <div className="mt-1 p-1.5 bg-slate-50 rounded-lg shrink-0 h-fit">
                {icon}
            </div>
            <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#003040] mb-0.5">{title}</h4>
                <p className="text-[11px] leading-relaxed text-slate-600 font-medium line-clamp-3">{text}</p>
            </div>
        </div>
    );
}
