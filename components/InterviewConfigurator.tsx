import React, { useState, useEffect } from 'react';
import { JobDescription } from '@/types';
import { X, Plus, ChevronRight, Loader2, Sparkles } from 'lucide-react';

interface InterviewConfiguratorProps {
    selectedJob: JobDescription;
    onStart: (confirmedSkills: string[]) => void;
    onBack: () => void;
}

export default function InterviewConfigurator({ selectedJob, onStart, onBack }: InterviewConfiguratorProps) {
    const [skills, setSkills] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSkill, setNewSkill] = useState('');

    useEffect(() => {
        const fetchSuggestedSkills = async () => {
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

        fetchSuggestedSkills();
    }, [selectedJob]);

    const removeSkill = (skillToRemove: string) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const addSkill = () => {
        if (newSkill.trim() && !skills.includes(newSkill.trim())) {
            setSkills([...skills, newSkill.trim()]);
            setNewSkill('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-10">
                    <p className="text-[#0095A9] font-bold tracking-widest uppercase text-xs mb-3">Configuration</p>
                    <h1 className="text-4xl font-black text-[#003040] mb-4">Calibrate Interview</h1>
                    <p className="text-gray-500">
                        AI has analyzed <span className="font-bold text-gray-800">{selectedJob.title}</span> and suggested these focus areas.
                        Adjust them to refine the assessment.
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
                        onClick={() => onStart(skills)}
                        disabled={loading || skills.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-[#0095A9] hover:bg-[#008496] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#0095A9]/20 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                    >
                        Start Assessment
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
