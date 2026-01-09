import React, { useState } from 'react';
import { RoundDefinition, RoundType } from '@/data/round_presets';
import { Trash2, Plus, Sparkles, GripVertical, X, Save, RefreshCw } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentFlow: RoundDefinition[];
    onSaveFlow: (newFlow: RoundDefinition[]) => void;
}

export default function FlowConfigurationModal({ isOpen, onClose, currentFlow, onSaveFlow }: Props) {
    const [flow, setFlow] = useState<RoundDefinition[]>(currentFlow);
    const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiQuery, setAiQuery] = useState('');

    if (!isOpen) return null;

    const handleAddRound = () => {
        const newRound: RoundDefinition = {
            id: `CUSTOM_${Date.now()}`,
            title: 'New Round',
            type: 'CHAT',
            systemPromptContext: 'Ask general interview questions.'
        };
        setFlow([...flow, newRound]);
        setEditingRoundId(newRound.id);
    };

    const handleRemoveRound = (id: string) => {
        setFlow(flow.filter(r => r.id !== id));
        if (editingRoundId === id) setEditingRoundId(null);
    };

    const updateRound = (id: string, updates: Partial<RoundDefinition>) => {
        setFlow(flow.map(r => r.id === id ? { ...r, ...updates } : r));
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
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-[#003040] tracking-tight">Configure Interview Flow</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                            Customize rounds & AI instructions
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Round List */}
                    <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/30">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {flow.map((round, idx) => (
                                <div
                                    key={round.id}
                                    onClick={() => setEditingRoundId(round.id)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all group relative ${editingRoundId === round.id
                                        ? 'bg-white border-[#0095A9] shadow-md'
                                        : 'bg-white border-transparent hover:border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-slate-700 truncate">{round.title}</h4>
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
                                        <div className="p-8 flex-1 overflow-y-auto">
                                            <div className="space-y-6">
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

                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Interviewer Instructions</label>
                                                        <span className="text-[10px] font-medium text-slate-400">Strictly defines the AI's behavior</span>
                                                    </div>
                                                    <textarea
                                                        value={round.systemPromptContext}
                                                        onChange={(e) => updateRound(round.id, { systemPromptContext: e.target.value })}
                                                        className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 leading-relaxed focus:outline-none focus:border-[#0095A9] transition-colors resize-none mb-4"
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

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSaveFlow(flow);
                            onClose();
                        }}
                        className="px-8 py-3 bg-[#003040] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#003040]/20 hover:bg-[#003040]/90 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Save size={16} />
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
