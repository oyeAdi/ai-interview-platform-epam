'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck, Globe, Building2, User, Plus, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isCustomClient, setIsCustomClient] = useState(false);
    const [customClientName, setCustomClientName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        // Auto-redirect if already logged in
        if (supabase) {
            supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
                if (user) {
                    router.push('/home');
                }
            });
        }
    }, [router]);

    const handleEnter = () => {
        setIsModalOpen(true);
        setSelectedClient(null);
        setIsCustomClient(false);
        setCustomClientName('');
        setError('');
        setPassword('');
    };

    const handleClientPick = (client: string) => {
        setSelectedClient(client);
        setError('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!supabase) {
            setError('System Error: Supabase client not initialized');
            setLoading(false);
            return;
        }

        const { data, error } = isSignUp
            ? await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { client_role: selectedClient }
                }
            })
            : await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            if (isSignUp && !data.session) {
                setError('Account created! Please check email for verification (or check console if testing).');
                setLoading(false);
            } else {
                // LOGIN VALIDATION: Enforce strict client role check
                if (!isSignUp && data.user) {
                    const storedRole = data.user.user_metadata?.client_role;

                    // Specific check: If user has a role and it doesn't match the selected client
                    if (storedRole && storedRole !== selectedClient) {
                        // Allow 'Systems' (Admin) to access other portals? 
                        // For now, let's assume strict separation as requested. 
                        // Or maybe 'Systems' is super admin.
                        if (storedRole !== 'Systems') {
                            setError(`Access Denied: This account is registered to ${storedRole}. Please switch organizations.`);
                            await supabase.auth.signOut();
                            setLoading(false);
                            return;
                        }
                    }
                }

                // If Sign Up & Session exists (or Auto Confirm enabled), register profile in DB
                if (isSignUp && data.user) {
                    try {
                        await fetch('/api/auth/register-profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: data.user.id,
                                email: email,
                                client_role: selectedClient
                            })
                        });
                    } catch (err) {
                        console.error("Profile registration failed", err);
                        // Continue anyway, as auth worked. user might be missing from public table but auth is fine.
                    }
                }

                // Success - Redirect with client context
                router.push(`/home?client=${selectedClient}`);
            }
        }

    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#0095A9]/30 flex flex-col">
            {/* Header */}
            <header className="px-8 h-20 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#0095A9] rounded-lg flex items-center justify-center shadow-lg shadow-[#0095A9]/20">
                        <Sparkles className="text-white" size={16} />
                    </div>
                    <span className="font-black text-xl tracking-tighter text-[#003040]">EPAM Systems</span>
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={handleEnter}
                        className="px-6 py-2.5 bg-[#003040] text-white text-xs font-black uppercase tracking-widest rounded-full hover:bg-[#0095A9] transition-all shadow-lg shadow-[#003040]/20 flex items-center gap-2"
                    >
                        Login / Signup <ArrowRight size={14} />
                    </button>
                </div>
            </header>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

                <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-100 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="w-2 h-2 rounded-full bg-[#0095A9] animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Next Gen Recruiting</span>
                    </div>

                    <h1 className="text-7xl font-black text-[#003040] tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        Delivering the Top 1% <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0095A9] to-emerald-400">to the world's leading brands.</span>
                    </h1>

                    <p className="text-xl text-slate-500 font-medium mb-12 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                        EPAM's autonomous interview engine validates technical excellence at scale,
                        ensuring our clients receive only the most qualified, battle-tested engineering talent.
                    </p>

                    <div className="flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                        <button
                            onClick={handleEnter}
                            className="px-10 py-5 bg-[#0095A9] text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-[#003040] hover:scale-105 transition-all shadow-xl shadow-[#0095A9]/30 flex items-center gap-3 group"
                        >
                            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                            Start Interview Engine
                        </button>
                        <button className="px-10 py-5 bg-white text-slate-600 font-black text-sm uppercase tracking-widest rounded-2xl border-2 border-slate-100 hover:border-[#0095A9] hover:text-[#0095A9] transition-all flex items-center gap-3">
                            View Demo
                        </button>
                    </div>
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#003040]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-10 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300 relative border border-white/10">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        {!selectedClient ? (
                            <>
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-[#0095A9]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Building2 className="text-[#0095A9]" size={32} />
                                    </div>
                                    <h2 className="text-2xl font-black text-[#003040] mb-2">Select Organization</h2>
                                    <p className="text-slate-500 font-medium text-sm">Choose your client context to proceed</p>
                                </div>

                                {!isCustomClient ? (
                                    <div className="space-y-3">
                                        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                            <ClientOption
                                                icon={<Globe size={20} />}
                                                title="Global Systems"
                                                desc="Internal technical screenings"
                                                onClick={() => handleClientPick('Systems')}
                                            />
                                            <ClientOption
                                                icon={<div className="font-black text-xs">UBER</div>}
                                                title="Uber"
                                                desc="Driver & Rider App Engineering"
                                                onClick={() => handleClientPick('Uber')}
                                            />
                                            <ClientOption
                                                icon={<div className="font-black text-xs">NOW</div>}
                                                title="ServiceNow"
                                                desc="Enterprise Cloud Platform"
                                                onClick={() => handleClientPick('ServiceNow')}
                                            />
                                        </div>

                                        <div className="pt-2 border-t border-slate-100">
                                            <button
                                                onClick={() => setIsCustomClient(true)}
                                                className="w-full py-3 text-xs font-bold text-slate-500 hover:text-[#0095A9] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 group"
                                            >
                                                <Plus size={14} className="group-hover:scale-110 transition-transform" />
                                                Join Other Organization
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-300">
                                        <div>
                                            <button
                                                onClick={() => setIsCustomClient(false)}
                                                className="mb-4 text-[10px] font-bold text-slate-400 hover:text-[#003040] uppercase tracking-widest flex items-center gap-1 transition-colors"
                                            >
                                                <ArrowLeft size={12} /> Back to List
                                            </button>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Organization Name</label>
                                            <input
                                                type="text"
                                                autoFocus
                                                value={customClientName}
                                                onChange={e => setCustomClientName(e.target.value)}
                                                placeholder="e.g. Google, Amazon, Startup Inc..."
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0095A9]/20 focus:border-[#0095A9] transition-all"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && customClientName.trim()) {
                                                        handleClientPick(customClientName.trim());
                                                    }
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (customClientName.trim()) {
                                                    handleClientPick(customClientName.trim());
                                                }
                                            }}
                                            disabled={!customClientName.trim()}
                                            className="w-full py-4 bg-[#003040] text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#0095A9] transition-all shadow-lg shadow-[#003040]/10 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            Continue <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-[#0095A9]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                        <User className="text-[#0095A9]" size={32} />
                                    </div>
                                    <h2 className="text-2xl font-black text-[#003040] mb-2">
                                        {isSignUp ? `Join ${selectedClient}` : `Login to ${selectedClient}`}
                                    </h2>
                                    <button
                                        onClick={() => setSelectedClient(null)}
                                        className="text-xs font-bold text-slate-400 hover:text-[#0095A9] mt-2 underline decoration-dashed transition-colors"
                                    >
                                        Change Organization
                                    </button>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="Email Address"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0095A9]/20 focus:border-[#0095A9] transition-all"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Password"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0095A9]/20 focus:border-[#0095A9] transition-all"
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-xs font-bold text-rose-600 animate-in fade-in slide-in-from-top-2">
                                            <ShieldCheck size={14} className="shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-4 bg-[#003040] text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#0095A9] transition-all shadow-lg shadow-[#003040]/10 flex items-center justify-center gap-2 group disabled:opacity-50"
                                    >
                                        {loading ? 'Processing...' : (
                                            isSignUp
                                                ? <>Create Account <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></>
                                                : <>Login & Access Portal <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></>
                                        )}
                                    </button>

                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setIsSignUp(!isSignUp)}
                                            className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-[#0095A9] transition-colors"
                                        >
                                            {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                        <div className="mt-8 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Secured by EPAM Systems
                            </p>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}

function ClientOption({ icon, title, desc, onClick }: { icon: any, title: string, desc: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="w-full p-4 rounded-xl border-2 border-slate-100 hover:border-[#0095A9] hover:bg-[#0095A9]/5 transition-all group flex items-center gap-4 text-left"
        >
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 group-hover:text-[#0095A9] group-hover:border-[#0095A9]/30 transition-colors">
                {icon}
            </div>
            <div>
                <h3 className="font-black text-slate-700 group-hover:text-[#0095A9] transition-colors">{title}</h3>
                <p className="text-xs text-slate-400 font-medium">{desc}</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-slate-300 group-hover:text-[#0095A9] group-hover:translate-x-1 transition-all" />
        </button>
    );
}
