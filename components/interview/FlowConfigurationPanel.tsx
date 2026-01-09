import React, { useState, useEffect, useRef } from 'react';
import { RoundDefinition, RoundType } from '@/data/round_presets';
import { Trash2, Plus, Sparkles, GripVertical, RefreshCw, Clock, Hash } from 'lucide-react';

interface Props {
    flow: RoundDefinition[];
    onChange: (newFlow: RoundDefinition[]) => void;
}

export default function FlowConfigurationPanel({ flow, onChange }: Props) {
    const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // Auto-select first round if none selected
    useEffect(() => {
        if (!editingRoundId && flow.length > 0) {
            setEditingRoundId(flow[0].id);
        }
    }, [flow, editingRoundId]);

    const handleAddRound = () => {
        const newRound: RoundDefinition = {
            id: `CUSTOM_${Date.now()}`,
            title: 'New Round',
            type: 'CHAT',
            systemPromptContext: 'Ask general interview questions.',
            timeLimit: 300, // 5 mins default
            questionCount: 3
        };
        onChange([...flow, newRound]);
        setEditingRoundId(newRound.id);
    };

    const handleRemoveRound = (id: string) => {
        onChange(flow.filter(r => r.id !== id));
        if (editingRoundId === id) setEditingRoundId(null);
    };

    const updateRound = (id: string, updates: Partial<RoundDefinition>) => {
        onChange(flow.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragItem.current = position;
        e.dataTransfer.effectAllowed = "move";
        // Ghost image styling usually handled by browser, but we can set opacity
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragOverItem.current = position;
    };

    const handleDrop = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const copyListItems = [...flow];
        const dragItemContent = copyListItems[dragItem.current];
        copyListItems.splice(dragItem.current, 1);
        copyListItems.splice(dragOverItem.current, 0, dragItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        onChange(copyListItems);
    };

    const handleAIAssist = async (roundId: string) => {
        if (!aiQuery.trim()) return;
        setLoadingAI(true);
        try {
            const round = flow.find(r => r.id === roundId);
            const res = await fetch('/api/interview/config-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: aiQuery, type: round?.type })
            });
            const data = await res.json();
            if (data.systemPromptContext) {
                updateRound(roundId, {
                    title: data.title || round?.title,
                    systemPromptContext: data.systemPromptContext
                });
                setAiQuery(''); // Reset query on success
            }
        } catch (e) {
            console.error(e);
            alert("Failed to generate instructions");
        } finally {
            setLoadingAI(false);
        }
    };

    return (
        <div className="flex flex-1 overflow-hidden border border-slate-200 rounded-3xl bg-white shadow-sm h-full">
            {/* Left: Round List */}
            <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-4 border-b border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Interview Structure</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Drag to reorder</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {flow.map((round, idx) => (
                        <div
                            key={round.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragEnter={(e) => handleDragEnter(e, idx)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => setEditingRoundId(round.id)}
                            className={`p-4 rounded-xl border-2 cursor-grab active:cursor-grabbing transition-all group relative animate-in fade-in slide-in-from-left-4 duration-300 ${editingRoundId === round.id
                                ? 'bg-white border-[#0095A9] shadow-md'
                                : 'bg-white border-transparent hover:border-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <GripVertical className="text-slate-300" size={16} />

                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${editingRoundId === round.id ? 'bg-[#0095A9] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-bold truncate ${editingRoundId === round.id ? 'text-[#0095A9]' : 'text-slate-700'}`}>{round.title}</h4>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{round.type}</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveRound(round.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleAddRound}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:border-[#0095A9] hover:text-[#0095A9] hover:bg-[#0095A9]/5 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Add Round
                    </button>
                </div>
            </div>

            {/* Right: Round Editor */}
            <div className="flex-1 flex flex-col bg-white">
                {editingRoundId ? (
                    (() => {
                        const round = flow.find(r => r.id === editingRoundId);
                        if (!round) return null;
                        return (
                            <div className="flex-1 flex flex-col h-full overflow-hidden">
                                <div className="p-5 flex-1 overflow-y-auto">
                                    <div className="space-y-4">
                                        {/* Title & Type */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Round Title</label>
                                                <input
                                                    value={round.title}
                                                    onChange={(e) => updateRound(round.id, { title: e.target.value })}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-[#0095A9] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Round Type</label>
                                                <select
                                                    value={round.type}
                                                    onChange={(e) => updateRound(round.id, { type: e.target.value as RoundType })}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-[#0095A9] transition-colors"
                                                >
                                                    <option value="QUIZ">Rapid Fire Quiz</option>
                                                    <option value="CHAT">Conceptual Chat</option>
                                                    <option value="CODING">Live Coding</option>
                                                    <option value="SYSTEM_DESIGN">System Design / Whiteboard</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Time & Questions */}
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <div>
                                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                    <Clock size={12} /> Time Limit (Minutes)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={round.timeLimit ? Math.floor(round.timeLimit / 60) : 5}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        updateRound(round.id, { timeLimit: val * 60 });
                                                    }}
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-[#0095A9] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                    <Hash size={12} /> Max Questions
                                                </label>
                                                <input
                                                    type="number"
                                                    value={round.questionCount || 0}
                                                    onChange={(e) => updateRound(round.id, { questionCount: parseInt(e.target.value) || 0 })}
                                                    placeholder="Use 0 for dynamic/auto"
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-[#0095A9] transition-colors"
                                                />
                                            </div>
                                        </div>

                                        {/* Instructions */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Interviewer Instructions</label>
                                                <span className="text-[10px] font-medium text-slate-400">Strictly defines the AI&apos;s behavior</span>
                                            </div>
                                            <textarea
                                                value={round.systemPromptContext}
                                                onChange={(e) => updateRound(round.id, { systemPromptContext: e.target.value })}
                                                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 leading-relaxed focus:outline-none focus:border-[#0095A9] transition-colors resize-none mb-4 font-mono"
                                                placeholder="e.g., Act as a Senior DevOps Engineer. Focus on Kubernetes and Docker..."
                                            />

                                            {/* AI Assist Box */}
                                            <div className="bg-[#0095A9]/5 border border-[#0095A9]/20 p-4 rounded-xl">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Sparkles size={14} className="text-[#0095A9]" />
                                                    <span className="text-xs font-black text-[#0095A9] uppercase tracking-wider">AI Config Assistant</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        value={aiQuery}
                                                        onChange={(e) => setAiQuery(e.target.value)}
                                                        placeholder="e.g., 'Create a difficult Java Concurrency round'"
                                                        className="flex-1 p-2 bg-white border border-[#0095A9]/20 rounded-lg text-xs font-medium focus:outline-none focus:border-[#0095A9]"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAIAssist(round.id)}
                                                    />
                                                    <button
                                                        onClick={() => handleAIAssist(round.id)}
                                                        disabled={loadingAI || !aiQuery}
                                                        className="px-4 py-2 bg-[#0095A9] text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#007EA7] disabled:opacity-50 transition-colors flex items-center gap-2"
                                                    >
                                                        {loadingAI ? <RefreshCw size={12} className="animate-spin" /> : 'Generate'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <GripVertical size={48} className="mb-4 opacity-50" />
                        <p className="text-sm font-bold">Select a round to configure</p>
                    </div>
                )}
            </div>
        </div>
    );
}
