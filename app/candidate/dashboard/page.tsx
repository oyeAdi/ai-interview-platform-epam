'use client';

import React from 'react';
import { LayoutDashboard, CheckCircle2, Clock, Calendar, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';

export default function CandidateDashboard() {
    // Mock data for demonstration - in a real app this would come from an API based on auth
    const recentActivity = [
        {
            id: '1',
            role: 'Senior Software Engineer',
            company: 'EPAM Systems',
            date: '01/17/2026',
            status: 'Terminated',
            score: 'N/A'
        },
        {
            id: '2',
            role: 'System Architect',
            company: 'Google',
            date: '10/12/2025',
            status: 'Completed',
            score: '8.5/10'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#0095A9] rounded-lg flex items-center justify-center text-white font-bold">
                            EP
                        </div>
                        <span className="font-bold text-slate-800 tracking-tight">Candidate Portal</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-right hidden sm:block">
                            <p className="font-bold text-slate-800">Shreya Raj</p>
                            <p className="text-xs text-slate-500">shreya.raj@example.com</p>
                        </div>
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                            SR
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Completed</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800">1</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                                <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pending</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800">0</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Terminated</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800">1</p>
                    </div>
                </div>

                {/* Activity List */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-800">Assessment History</h2>
                        <button className="text-sm font-bold text-[#0095A9] hover:text-[#007a8a] flex items-center gap-1">
                            View All <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {recentActivity.map((activity) => (
                            <div key={activity.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activity.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                                        activity.status === 'Terminated' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {activity.status === 'Completed' ? <CheckCircle2 className="w-6 h-6" /> :
                                            activity.status === 'Terminated' ? <ShieldAlert className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 group-hover:text-[#0095A9] transition-colors">{activity.role}</h3>
                                        <p className="text-sm text-slate-500 font-medium">{activity.company}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
                                        <p className="text-sm font-bold text-slate-700">{activity.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${activity.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                            activity.status === 'Terminated' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                            {activity.status}
                                        </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#0095A9] group-hover:text-white transition-all">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
