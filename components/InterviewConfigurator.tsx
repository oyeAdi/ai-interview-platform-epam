import React, { useState, useEffect } from 'react';
import { JobDescription } from '@/types';
import { X, Plus, ChevronRight, Loader2, Sparkles, ListChecks, MessageSquare, Code, Layout, ShieldCheck, Play, Copy, ArrowRight, Check } from 'lucide-react';
import clsx from 'clsx';

interface InterviewConfiguratorProps {
    selectedJob: JobDescription;
    onStart: (confirmedSkills: string[]) => void;
    onBack: () => void;
}

export default function InterviewConfigurator({ selectedJob, onStart, onBack }: InterviewConfiguratorProps) {
    const [step, setStep] = useState<'SKILLS' | 'STYLE' | 'DETAILS' | 'LINK'>('SKILLS');
    const [skills, setSkills] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSkill, setNewSkill] = useState('');

    // Step 1.5: Style & Calibration
    const [customInstructions, setCustomInstructions] = useState('');
    const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [durations, setDurations] = useState({
        mcq: 2,
        conceptual: 5,
        coding: 7,
        systemDesign: 10
    });
    const [copied, setCopied] = useState(false);
    const [mcqConfig, setMcqConfig] = useState({
        enabled: true,
        maxQuestions: 7
    });
    const [conceptualConfig, setConceptualConfig] = useState({
        maxQuestions: 10
    });
    const [codingConfig, setCodingConfig] = useState({
        enabled: true,
        maxQuestions: 3,
        focusAreas: 'Algorithms, Data Structures'
    });
    const [systemDesignConfig, setSystemDesignConfig] = useState({
        enabled: true
    });

    // Step 2: Candidate Details
    const [candidateName, setCandidateName] = useState('');
    const [candidateEmail, setCandidateEmail] = useState('');

    // Step 3: Generated Link
    const [inviteLink, setInviteLink] = useState('');

    useEffect(() => {
        // Set defaults based on Category
        const cat = selectedJob.category?.toLowerCase() || '';
        const isSoftware = !cat || cat.includes('software') || cat.includes('engineering') || cat.includes('data') || cat.includes('tech');

        setCodingConfig(prev => ({ ...prev, enabled: isSoftware }));
        setSystemDesignConfig(prev => ({ ...prev, enabled: true })); // Usually keep strategy/design enabled for most senior roles? Or maybe just default true.

        const fetchSuggestedSkills = async () => {
            // ... existing logic ...
            try {
                const res = await fetch('/api/interview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'generate-skills',
                        selectedJobId: selectedJob.id
                    })
                });
                const data = await res.json();
                if (data.skills) {
                    setSkills(data.skills);
                }
            } catch (error) {
                console.error("Failed to generate skills", error);
                setSkills(selectedJob.must_have || []);
            } finally {
                setLoading(false);
            }
        };

        if (step === 'SKILLS' && skills.length === 0) {
            fetchSuggestedSkills();
        }
    }, [selectedJob, step]);

    const removeSkill = (skillToRemove: string) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const addSkill = () => {
        if (newSkill.trim() && !skills.includes(newSkill.trim())) {
            setSkills([...skills, newSkill.trim()]);
            setNewSkill('');
        }
    };

    const handleGenerateLink = () => {
        if (!candidateName || !candidateEmail) return;

        const sessionData = {
            jobId: selectedJob.id,
            jobTitle: selectedJob.title,
            candidateName,
            candidateEmail,
            skills,
            config: {
                customInstructions,
                durations,
                mcq: mcqConfig,
                conceptual: conceptualConfig,
                coding: codingConfig,
                systemDesign: systemDesignConfig
            }
        };

        // Use a Base64URL safe way to encode the session data
        const jsonStr = JSON.stringify(sessionData);
        const base64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        }));

        // Make it URL safe (Base64URL)
        const token = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const link = `${window.location.origin}/assessment/${token}`;
        setInviteLink(link);
        setStep('LINK');
    };

    // --- RENDER STEPS ---

    if (step === 'LINK') {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="max-w-2xl w-full text-center">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-[#003040] mb-4">Invite Generated!</h1>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Share this unique link with <span className="font-bold text-gray-900">{candidateName}</span> to start their assessment for <span className="font-bold text-gray-900">{selectedJob.title}</span>.
                    </p>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 mb-8 text-left">
                        <code className="flex-1 text-sm text-slate-600 truncate">{inviteLink}</code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(inviteLink);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className={clsx(
                                "px-4 py-2 font-bold text-xs rounded-lg transition-all uppercase tracking-widest flex items-center gap-2",
                                copied ? "bg-green-100 text-green-700 border border-green-200" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            )}
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    <button
                        onClick={onBack}
                        className="px-8 py-4 bg-[#0095A9] text-white font-bold rounded-2xl hover:bg-[#008496] transition-all shadow-lg shadow-[#0095A9]/20"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'DETAILS') {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="max-w-xl w-full">
                    <button onClick={() => setStep('STYLE')} className="mb-8 flex items-center text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors">
                        <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to Calibration
                    </button>

                    <div className="text-center mb-10">
                        <p className="text-[#0095A9] font-bold tracking-widest uppercase text-xs mb-3">Step 3 of 3</p>
                        <h1 className="text-4xl font-black text-[#003040] mb-4">Candidate Details</h1>
                        <p className="text-gray-500">
                            Who is taking this assessment?
                        </p>
                    </div>

                    <div className="space-y-6 bg-slate-50 p-8 rounded-3xl border border-slate-200">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
                            <input
                                type="text"
                                value={candidateName}
                                onChange={(e) => setCandidateName(e.target.value)}
                                placeholder="e.g. Shreya Raj"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0095A9] text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                            <input
                                type="email"
                                value={candidateEmail}
                                onChange={(e) => setCandidateEmail(e.target.value)}
                                placeholder="e.g. shreya.raj@epam.com"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0095A9] text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={handleGenerateLink}
                            disabled={!candidateName || !candidateEmail}
                            className="w-full py-4 bg-[#0095A9] hover:bg-[#008496] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#0095A9]/20 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                        >
                            Generate Invite Link
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'STYLE') {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="max-w-3xl w-full h-[90vh] flex flex-col">
                    <button onClick={() => setStep('SKILLS')} className="mb-4 flex items-center text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors">
                        <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to Skills
                    </button>

                    <div className="text-center mb-6">
                        <p className="text-[#0095A9] font-bold tracking-widest uppercase text-xs mb-2">Step 2 of 3</p>
                        <h1 className="text-3xl font-black text-[#003040] mb-2">Style & Calibration</h1>
                        <p className="text-gray-500 text-sm">
                            Configure the interview persona, round durations, and strictness.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                        {/* Global Instructions */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#0095A9]" />
                                    Global Instructions
                                </h3>
                                <button
                                    onClick={async () => {
                                        if (!customInstructions.trim()) return;
                                        setIsEnhancing(true);
                                        try {
                                            const res = await fetch('/api/interview', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    type: 'enhance-instruction',
                                                    selectedJobId: selectedJob.id,
                                                    customInstructions: customInstructions
                                                })
                                            });
                                            const data = await res.json();
                                            if (data.enhancedText) {
                                                setEnhancedPrompt(data.enhancedText);
                                                if (data.enhancedText === customInstructions) {
                                                    console.warn("AI returned identical instructions.");
                                                }
                                            } else if (data.error) {
                                                alert(`Enhancement failed: ${data.error}`);
                                            }
                                        } catch (e: any) {
                                            console.error(e);
                                            alert("Failed to connect to enhancement engine.");
                                        } finally {
                                            setIsEnhancing(false);
                                        }
                                    }}
                                    disabled={isEnhancing}
                                    className="text-[10px] font-bold text-[#0095A9] bg-[#0095A9]/10 px-3 py-1.5 rounded-full hover:bg-[#0095A9]/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Sparkles className="w-3 h-3" /> {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">Provide specific guidelines (e.g., "Be strict", "Ask about caching") and click Enhance to structure them.</p>

                            {/* Enhanced Prompt Preview - MOVED ABOVE TEXTAREA FOR VISIBILITY */}
                            {enhancedPrompt && (
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 mb-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-emerald-600" />
                                            <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Enhanced Strategy Prompt</h4>
                                        </div>
                                        <button onClick={() => setEnhancedPrompt(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                                    </div>
                                    <p className="text-xs text-slate-700 font-mono bg-white/80 p-3 rounded-lg border border-emerald-100/50 mb-3 whitespace-pre-wrap leading-relaxed">
                                        {enhancedPrompt}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setCustomInstructions(enhancedPrompt);
                                                setEnhancedPrompt(null);
                                            }}
                                            className="flex-1 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-all uppercase tracking-widest shadow-md shadow-emerald-200"
                                        >
                                            Apply Refinement
                                        </button>
                                        <button
                                            onClick={() => setEnhancedPrompt(null)}
                                            className="px-4 py-2 bg-white text-slate-500 text-[10px] font-black rounded-lg border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest"
                                        >
                                            Discard
                                        </button>
                                    </div>
                                </div>
                            )}

                            <textarea
                                value={customInstructions}
                                onChange={(e) => setCustomInstructions(e.target.value)}
                                placeholder={(() => {
                                    const cat = selectedJob.category?.toLowerCase() || '';
                                    if (cat.includes('marketing')) {
                                        return "Describe your intent roughly...&#10;e.g. 'Focus on SEO strategies, ask about recent Google algorithm updates, and evaluate campaign ROI analysis skills.'";
                                    }
                                    if (cat.includes('finance')) {
                                        return "Describe your intent roughly...&#10;e.g. 'Test knowledge of GAAP vs IFRS, ask about financial modeling for M&A, and check Excel proficiency.'";
                                    }
                                    if (cat.includes('hr') || cat.includes('human')) {
                                        return "Describe your intent roughly...&#10;e.g. 'Evaluate conflict resolution skills, ask about labor laws, and check recruitment strategy knowledge.'";
                                    }
                                    // Default / Software
                                    return `Describe your intent roughly for ${selectedJob.title}...&#10;e.g. 'Ask hard questions about ${selectedJob.must_have?.[0] || 'core skills'}, focus on real-world scenarios, and be strict about details.'`;
                                })()}
                                className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0095A9] text-sm text-slate-800 resize-none font-mono"
                            />
                        </div>

                        {/* Round Strategy Cards */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <ListChecks className="w-4 h-4 text-[#0095A9]" />
                                Round Configuration & Strategy
                            </h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* MCQ Round Card */}
                                {/* MCQ Round Card */}
                                <div className="p-6 rounded-2xl border bg-white border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ListChecks size={16} /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-700 text-sm">Round 1: Screening</h4>
                                                <p className="text-[10px] text-slate-400 font-medium">Format: Rapid Fire MCQ</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 animate-in fade-in">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time (Min)</label>
                                                <input type="number" value={durations.mcq} onChange={(e) => setDurations({ ...durations, mcq: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Questions</label>
                                                <input type="number" value={mcqConfig.maxQuestions} onChange={(e) => setMcqConfig({ ...mcqConfig, maxQuestions: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded-lg">
                                            "Validate basic knowledge. No follow-ups."
                                        </p>
                                    </div>
                                </div>

                                {/* Conceptual Round Card */}
                                <div className="p-6 rounded-2xl border bg-white border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><MessageSquare size={16} /></div>
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-sm">Round 2: Conceptual</h4>
                                            <p className="text-[10px] text-slate-400 font-medium">Format: Deep Dive Q&A</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time (Min)</label>
                                                <input type="number" value={durations.conceptual} onChange={(e) => setDurations({ ...durations, conceptual: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Questions</label>
                                                <input type="number" value={conceptualConfig.maxQuestions} onChange={(e) => setConceptualConfig({ ...conceptualConfig, maxQuestions: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded-lg">
                                            "Max 2-3 follow-ups per topic. Auto-switch topics."
                                        </p>
                                    </div>
                                </div>

                                {(() => {
                                    const cat = selectedJob.category?.toLowerCase() || '';
                                    const isSoftware = !cat || cat.includes('software') || cat.includes('engineering') || cat.includes('data') || cat.includes('tech');

                                    return (
                                        <>
                                            {/* Coding Round Card - ONLY for Software Roles */}
                                            {isSoftware && (
                                                <div className="p-6 rounded-2xl border bg-white border-slate-200 shadow-sm md:col-span-2">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <div className={`p-2 rounded-lgTransition-colors ${codingConfig.enabled ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'}`}><Code size={16} /></div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={codingConfig.enabled}
                                                                    onChange={e => setCodingConfig({ ...codingConfig, enabled: e.target.checked })}
                                                                    className="w-4 h-4 rounded border-gray-300 text-[#0095A9] focus:ring-[#0095A9]"
                                                                />
                                                                <h4 className={`font-bold text-sm ${codingConfig.enabled ? 'text-slate-700' : 'text-slate-400'}`}>Round 3: Practical / Coding</h4>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 font-medium">Format: LeetCode / SQL / Scripts</p>
                                                        </div>
                                                    </div>
                                                    <div className={`grid md:grid-cols-2 gap-4 transition-opacity ${codingConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                                        <div className="space-y-3">
                                                            <div className="flex gap-3">
                                                                <div className="flex-1">
                                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time (Min)</label>
                                                                    <input type="number" value={durations.coding} onChange={(e) => setDurations({ ...durations, coding: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Questions</label>
                                                                    <input type="number" value={codingConfig.maxQuestions} onChange={(e) => setCodingConfig({ ...codingConfig, maxQuestions: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Question Mix / Topics</label>
                                                            <input
                                                                type="text"
                                                                value={codingConfig.focusAreas}
                                                                onChange={(e) => setCodingConfig({ ...codingConfig, focusAreas: e.target.value })}
                                                                placeholder="e.g. 1. Algorithms, 2. SQL, 3. Scripts"
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9] placeholder:font-normal"
                                                            />
                                                            <p className="text-[10px] text-slate-400 mt-1 italic">
                                                                "Strict Compiler Persona. Multi-question flow."
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Design / Strategy Card */}
                                            <div className="p-6 rounded-2xl border bg-white border-slate-200 shadow-sm md:col-span-2">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className={`p-2 rounded-lg transition-colors ${systemDesignConfig.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}><Layout size={16} /></div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={systemDesignConfig.enabled}
                                                                onChange={e => setSystemDesignConfig({ ...systemDesignConfig, enabled: e.target.checked })}
                                                                className="w-4 h-4 rounded border-gray-300 text-[#0095A9] focus:ring-[#0095A9]"
                                                            />
                                                            <h4 className={`font-bold text-sm ${systemDesignConfig.enabled ? 'text-slate-700' : 'text-slate-400'}`}>
                                                                Round {isSoftware ? '4' : '3'}: {isSoftware ? 'Strategy / System Design' : 'Strategic Case Study'}
                                                            </h4>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            Format: {isSoftware ? 'Architecture Whiteboarding' : 'Scenario Analysis & Strategy'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={`space-y-3 transition-opacity ${systemDesignConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                                    <div className="w-1/3">
                                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time (Min)</label>
                                                        <input type="number" value={durations.systemDesign} onChange={(e) => setDurations({ ...durations, systemDesign: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-[#0095A9]" />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded-lg">
                                                        {isSoftware
                                                            ? "\"Structured Rubric: Requirements \u2192 Estimates \u2192 HLD \u2192 Deep Dive.\""
                                                            : "\"Structured Rubric: Situation \u2192 Strategy \u2192 Plan \u2192 Metrics.\""
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={() => setStep('DETAILS')}
                            className="px-8 py-4 bg-[#0095A9] text-white font-bold rounded-2xl hover:bg-[#008496] transition-all shadow-lg shadow-[#0095A9]/20"
                        >
                            Next: Candidate Details
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // DEFAULT: SKILLS STEP
    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-10">
                    <p className="text-[#0095A9] font-bold tracking-widest uppercase text-xs mb-3">Step 1 of 3</p>
                    <h1 className="text-4xl font-black text-[#003040] mb-4">Calibrate Interview</h1>
                    <p className="text-gray-500">
                        AI has analyzed <span className="font-bold text-gray-800">{selectedJob.title}</span>. Adjust focus areas below.
                    </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 mb-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#0095A9]" />
                            Target Competencies
                        </h3>
                        <span className="text-xs font-medium text-slate-400">{skills.length} skills selected</span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p className="text-xs font-medium">Analyzing Job Description...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-3">
                                {skills.map((skill) => (
                                    <div key={skill} className="group flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-[#0095A9] transition-colors">
                                        <span className="text-sm font-semibold text-slate-700">{skill}</span>
                                        <button
                                            onClick={() => removeSkill(skill)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-slate-50"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-200/60">
                                <input
                                    type="text"
                                    value={newSkill}
                                    onChange={(e) => setNewSkill(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                                    placeholder="Add a custom skill..."
                                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0095A9] text-sm"
                                />
                                <button
                                    onClick={addSkill}
                                    disabled={!newSkill.trim()}
                                    className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="px-8 py-4 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => setStep('STYLE')}
                        disabled={loading || skills.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-[#0095A9] hover:bg-[#008496] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#0095A9]/20 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                    >
                        Next: Style & Calibration
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
