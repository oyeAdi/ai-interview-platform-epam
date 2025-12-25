'use client';

import React, { useState, useEffect } from 'react';
import { Play, FileText, Calendar, User, Search, Monitor, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import GlobalHeader from '@/components/GlobalHeader';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

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
    const [activeTab, setActiveTab] = useState<'verdict' | 'video' | 'protocol'>('verdict');

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
        setActiveTab('verdict'); // Reset tab on session change

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

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <RefreshCw size={40} className="animate-spin text-[#0095A9]" />
            <div className="text-[#003040] font-black uppercase tracking-widest text-sm">Initializing EPAM Manager...</div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-white font-sans text-slate-900 selection:bg-[#0095A9]/30">
            <GlobalHeader />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar List */}
                <div className="w-80 bg-white border-r border-slate-100 flex flex-col">
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-[#0095A9] rounded-xl flex items-center justify-center shadow-lg shadow-[#0095A9]/20">
                                <Monitor className="text-white" size={20} />
                            </div>
                            <h1 className="text-xl font-black text-[#003040] tracking-tight">EPAM Manager</h1>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Interview History</p>
                            <span className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-400 border border-slate-100">{sessions.length}</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-100">
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => setSelectedSession(session)}
                                className={cn(
                                    "p-5 rounded-2xl cursor-pointer transition-all duration-300 group border-2",
                                    selectedSession?.id === session.id
                                        ? "bg-[#0095A9]/5 border-[#0095A9]/20 shadow-sm"
                                        : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                        selectedSession?.id === session.id ? "bg-[#0095A9] text-white" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {session.jobId}
                                    </span>
                                    <span className="text-[10px] text-slate-300 font-bold">{new Date(session.date).toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm mb-2 group-hover:text-[#0095A9] transition-colors">{session.candidateName}</h3>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                        <Monitor size={12} className="opacity-50" />
                                        <span>Cloud Session</span>
                                    </div>
                                    {session.hasFinalFeedback && (
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FBFDFF]">
                    {selectedSession ? (
                        <div className="flex-1 flex flex-col h-full">
                            {/* Hero Header */}
                            <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-start z-30">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-black text-[#003040] tracking-tight">
                                            {selectedSession.candidateName}
                                        </h2>
                                        <div className="mt-1 flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#0095A9] animate-pulse" />
                                            <span className="text-[10px] text-[#0095A9] font-black uppercase tracking-widest">{selectedSession.jobId}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400 font-bold uppercase tracking-widest">
                                        <span>{selectedSession.candidateEmail}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                        <span>REF: {selectedSession.folderName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {!finalFeedback ? (
                                        <button
                                            onClick={generateFinalFeedback}
                                            disabled={isFinalizing}
                                            className="px-8 py-3.5 bg-[#003040] hover:bg-[#003040]/90 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-[#003040]/20"
                                        >
                                            {isFinalizing ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                            {isFinalizing ? 'Analyzing Protocol...' : 'Synthesize Verdict'}
                                        </button>
                                    ) : (
                                        <div className={cn(
                                            "flex items-center gap-3 px-6 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all",
                                            finalFeedback.verdict.includes('Not Hired')
                                                ? "bg-rose-50 border-rose-100 text-rose-600"
                                                : "bg-emerald-50 border-emerald-100 text-emerald-600"
                                        )}>
                                            <CheckCircle2 size={18} />
                                            {finalFeedback.verdict}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TAB NAVIGATION */}
                            <div className="px-8 pt-6 pb-2 bg-white flex items-center gap-1 border-b border-slate-50">
                                <TabTrigger
                                    active={activeTab === 'verdict'}
                                    onClick={() => setActiveTab('verdict')}
                                    icon={<ShieldCheck size={16} />}
                                    label="Final Verdict"
                                />
                                <TabTrigger
                                    active={activeTab === 'video'}
                                    onClick={() => setActiveTab('video')}
                                    icon={<Monitor size={16} />}
                                    label="Session Video"
                                />
                                <TabTrigger
                                    active={activeTab === 'protocol'}
                                    onClick={() => setActiveTab('protocol')}
                                    icon={<FileText size={16} />}
                                    label="Full Protocol"
                                />
                            </div>

                            {/* TAB CONTENT PANELS */}
                            <div className="flex-1 overflow-hidden relative">
                                {/* TAB 1: VERDICT */}
                                <div className={cn(
                                    "absolute inset-0 p-8 overflow-y-auto transition-all duration-500 scrollbar-thin scrollbar-thumb-slate-100",
                                    activeTab === 'verdict' ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
                                )}>
                                    {finalFeedback ? (
                                        <div className="max-w-6xl mx-auto space-y-8 pb-12">
                                            {/* Assessment Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <VerdictMetricCard
                                                    title="Technical"
                                                    text={finalFeedback.technical}
                                                    icon={<Monitor className="text-[#0095A9]" size={20} />}
                                                />
                                                <VerdictMetricCard
                                                    title="Behavioral"
                                                    text={finalFeedback.behavioral}
                                                    icon={<User className="text-[#0095A9]" size={20} />}
                                                />
                                                <VerdictMetricCard
                                                    title="Communication"
                                                    text={finalFeedback.communication}
                                                    icon={<FileText className="text-[#0095A9]" size={20} />}
                                                />
                                            </div>

                                            {/* Overall Insight Card */}
                                            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#0095A9]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl transition-transform group-hover:scale-110 duration-1000" />
                                                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-[#0095A9] uppercase tracking-[0.3em] mb-6">Synthesis Summary</h4>
                                                        <p className="text-lg text-slate-700 font-medium leading-relaxed italic">
                                                            "{finalFeedback.overall_summary || finalFeedback.reason || "Formal evaluation pending. The system will process all discussion turns to produce a qualitative binary synthesis."}"
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-6">
                                                        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50">
                                                            <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <CheckCircle2 size={14} /> Key Strengths
                                                            </h5>
                                                            <ul className="space-y-3">
                                                                {finalFeedback.feedback.strengths.slice(0, 3).map((s: string, i: number) => (
                                                                    <li key={i} className="text-xs text-slate-600 font-semibold flex items-start gap-3">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                                                        {s}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100/50">
                                                            <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <AlertCircle size={14} /> Growth Areas
                                                            </h5>
                                                            <ul className="space-y-3">
                                                                {finalFeedback.feedback.improvements.slice(0, 3).map((s: string, i: number) => (
                                                                    <li key={i} className="text-xs text-slate-600 font-semibold flex items-start gap-3">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
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
                                        <div className="h-[70vh] flex flex-col items-center justify-center text-center p-12 max-w-lg mx-auto">
                                            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100">
                                                <ShieldCheck size={48} className="text-slate-200" />
                                            </div>
                                            <h3 className="text-2xl font-black text-[#003040] mb-3">Verdict Restricted</h3>
                                            <p className="text-slate-400 font-medium leading-relaxed">
                                                Synthesize the final verdict using the AI engine at the top to unlock the comprehensive evaluation for {selectedSession.candidateName}.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* TAB 2: VIDEO */}
                                <div className={cn(
                                    "absolute inset-0 p-8 flex flex-col transition-all duration-500",
                                    activeTab === 'video' ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                                )}>
                                    <div className="mb-6 flex items-center justify-between">
                                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Archived Session Playback</span>
                                        </div>
                                        <div className="px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100/50">
                                            <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest leading-none">HD Stream Active</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-black rounded-[2.5rem] overflow-hidden shadow-2xl relative border-[8px] border-white group">
                                        <video
                                            key={selectedSession.folderName}
                                            src={`/api/dm/video?folder=${selectedSession.folderName}`}
                                            controls
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="mt-8 px-4 flex justify-between items-center">
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Recorded via EPAM Real-time Interview Engine</p>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col text-right">
                                                <span className="text-[9px] text-slate-300 font-black uppercase">Duration</span>
                                                <span className="text-xs font-bold text-slate-500 tracking-tight">24m 12s</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[9px] text-slate-300 font-black uppercase">Quality</span>
                                                <span className="text-xs font-bold text-slate-500 tracking-tight">1080p WebStream</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* TAB 3: PROTOCOL */}
                                <div className={cn(
                                    "absolute inset-0 p-8 overflow-y-auto transition-all duration-500 scrollbar-thin scrollbar-thumb-slate-100",
                                    activeTab === 'protocol' ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-8 pointer-events-none"
                                )}>
                                    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] p-12 border border-slate-50 shadow-sm mb-12">
                                        {loadingReport ? (
                                            <div className="h-64 flex flex-col items-center justify-center text-slate-200">
                                                <RefreshCw size={32} className="animate-spin mb-4 text-[#0095A9]" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Retrieving Protocol...</span>
                                            </div>
                                        ) : (
                                            <div className="prose prose-slate max-w-none prose-h1:text-2xl prose-h1:font-black prose-h1:text-[#003040] prose-h2:text-xl prose-h2:font-bold prose-h2:text-[#003040] prose-h2:border-l-4 prose-h2:border-[#0095A9] prose-h2:pl-6 prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-[#0095A9] prose-strong:font-black">
                                                <ReactMarkdown>{fullReport}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-200 bg-white">
                            <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-10 border border-slate-50 shadow-inner">
                                <User size={64} className="opacity-10" />
                            </div>
                            <h2 className="text-2xl font-black text-[#003040] mb-3">Operator Terminal</h2>
                            <p className="text-slate-400 font-medium">Select a candidate session from the archive to begin review</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TabTrigger({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-8 py-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-widest rounded-t-2xl transition-all relative border-b-2",
                active
                    ? `bg-white text-[#003040] border-[#0095A9]`
                    : "bg-transparent text-slate-400 border-transparent hover:text-slate-600"
            )}
        >
            <span className={cn("transition-colors", active ? "text-[#0095A9]" : "text-slate-300")}>{icon}</span>
            {label}
        </button>
    );
}

function VerdictMetricCard({ title, text, icon }: { title: string, text: string, icon: any }) {
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
            <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-[#0095A9]/5 transition-colors">
                    {icon}
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 font-semibold line-clamp-4 group-hover:line-clamp-none transition-all duration-500">
                {text}
            </p>
        </div>
    );
}
