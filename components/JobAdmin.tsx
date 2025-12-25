'use client';

import React, { useState } from 'react';
import { JobDescription } from '@/types';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface JobAdminProps {
    jobs: JobDescription[];
    onUpdate: () => void;
    onClose: () => void;
}

export default function JobAdmin({ jobs, onUpdate, onClose }: JobAdminProps) {
    const [editingJob, setEditingJob] = useState<Partial<JobDescription> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!editingJob?.title || !editingJob?.level) {
            alert('Title and Level are required');
            return;
        }

        setIsSaving(true);
        try {
            const isNew = !editingJob.id;
            const method = isNew ? 'POST' : 'PUT';

            const response = await fetch('/api/jobs', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingJob),
            });

            if (response.ok) {
                setEditingJob(null);
                onUpdate();
            } else {
                alert('Failed to save job');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving job');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this job?')) return;

        try {
            const response = await fetch('/api/jobs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (response.ok) {
                onUpdate();
            } else {
                alert('Failed to delete job');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting job');
        }
    };

    // Group jobs by category
    const categories = Array.from(new Set(jobs.map(j => j.category || 'Uncategorized')));
    const groupedJobs = categories.reduce((acc, cat) => {
        acc[cat] = jobs.filter(j => (j.category || 'Uncategorized') === cat);
        return acc;
    }, {} as Record<string, JobDescription[]>);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#003040] text-white">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Manage Job Descriptions</h2>
                        <p className="text-xs font-bold text-[#0095A9] uppercase tracking-widest mt-1">Admin Control Plane</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 flex gap-8">
                    {/* List */}
                    <div className="w-1/3 space-y-6 border-r border-gray-100 pr-8 overflow-y-auto max-h-[70vh]">
                        <button
                            onClick={() => setEditingJob({ title: '', level: 'SDE-1', category: 'Software Engineering', must_have: [], nice_to_have: [], description: '' })}
                            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-[#0095A9] hover:border-[#0095A9] hover:bg-[#0095A9]/5 transition-all font-bold text-sm"
                        >
                            <Plus size={18} /> Add New Job
                        </button>

                        {Object.entries(groupedJobs).map(([category, categoryJobs]) => (
                            <div key={category} className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">{category}</h3>
                                {categoryJobs.map(job => (
                                    <div
                                        key={job.id}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${editingJob?.id === job.id ? 'border-[#0095A9] bg-[#0095A9]/5' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}
                                        onClick={() => setEditingJob(job)}
                                    >
                                        <div className="text-[10px] font-bold text-[#0095A9] uppercase mb-1">{job.level}</div>
                                        <div className="font-bold text-sm truncate">{job.title}</div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Form */}
                    <div className="flex-1 overflow-y-auto max-h-[70vh] pr-2">
                        {editingJob ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Job Title</label>
                                        <input
                                            type="text"
                                            value={editingJob.title}
                                            onChange={e => setEditingJob({ ...editingJob, title: e.target.value })}
                                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0095A9]/20"
                                            placeholder="e.g. Backend Engineer"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Level</label>
                                        <input
                                            type="text"
                                            value={editingJob.level}
                                            onChange={e => setEditingJob({ ...editingJob, level: e.target.value })}
                                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0095A9]/20"
                                            placeholder="e.g. SDE-2, Manager, CFO"
                                        />
                                        <p className="text-[10px] text-gray-400">Can be anything (e.g. Intern, CFO, Lead)</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category / Industry</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list="category-suggestions"
                                            value={editingJob.category || ''}
                                            onChange={e => setEditingJob({ ...editingJob, category: e.target.value })}
                                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0095A9]/20"
                                            placeholder="e.g. Software Engineering, Marketing, Finance"
                                        />
                                        <datalist id="category-suggestions">
                                            {categories.map(cat => (
                                                <option key={cat} value={cat} />
                                            ))}
                                            <option value="Marketing" />
                                            <option value="Finance" />
                                            <option value="Human Resources" />
                                        </datalist>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</label>
                                    <textarea
                                        value={editingJob.description}
                                        onChange={e => setEditingJob({ ...editingJob, description: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 h-24 focus:ring-2 focus:ring-[#0095A9]/20"
                                        placeholder="Short summary of the role..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Must Have (Comma separated)</label>
                                    <input
                                        type="text"
                                        value={editingJob.must_have?.join(', ')}
                                        onChange={e => setEditingJob({ ...editingJob, must_have: e.target.value.split(',').map(s => s.trim()) })}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0095A9]/20"
                                        placeholder="Skill 1, Skill 2..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nice to Have (Comma separated)</label>
                                    <input
                                        type="text"
                                        value={editingJob.nice_to_have?.join(', ')}
                                        onChange={e => setEditingJob({ ...editingJob, nice_to_have: e.target.value.split(',').map(s => s.trim()) })}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0095A9]/20"
                                        placeholder="Skill 1, Skill 2..."
                                    />
                                </div>


                                <div className="flex justify-between items-center pt-8 border-t border-gray-100">
                                    {editingJob.id && (
                                        <button
                                            onClick={() => handleDelete(editingJob.id!)}
                                            className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all font-bold text-sm"
                                        >
                                            <Trash2 size={18} /> Delete Job
                                        </button>
                                    )}
                                    <div className="flex gap-4 ml-auto">
                                        <button
                                            onClick={() => setEditingJob(null)}
                                            className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="flex items-center gap-2 bg-[#0095A9] text-white px-8 py-2 rounded-xl font-bold hover:bg-[#003040] transition-all disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4">
                                <Briefcase size={64} strokeWidth={1} />
                                <p className="font-bold text-sm uppercase tracking-widest">Select a job to edit or add a new one</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Minimal Briefcase icon since I didn't import and might need it
function Briefcase({ size, strokeWidth }: { size: number, strokeWidth: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
    );
}
