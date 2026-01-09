'use client';

import Link from 'next/link';
import { LayoutDashboard, Settings, ChevronDown, Lock, LogOut, Users } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface GlobalHeaderProps {
    clientName?: string;
    setClientName?: (name: string) => void;
}

export default function GlobalHeader({ clientName: propClientName, setClientName: propSetClientName }: GlobalHeaderProps) {
    const [internalClientName, setInternalClientName] = useState('Systems');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    const clientName = propClientName || internalClientName;
    const setClientName = propSetClientName || setInternalClientName;

    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
            window.location.href = '/';
        }
    };

    useEffect(() => {
        async function checkUserRole() {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Check metadata first
                const role = user.user_metadata?.client_role || 'Systems';
                setUserRole(role);

                // If currently viewing 'Systems' but user is NOT Systems, force them to their role
                // And if props are handling clientName, we assume parent handles it too (Dashboard),
                // but this acts as UI guard.
                if (role !== 'Systems' && clientName === 'Systems') {
                    setClientName(role);
                }
            }
        }
        checkUserRole();
    }, [clientName]); // Dependency on clientName to ensure we re-enforce if it changes externally to something invalid

    const isGlobalAdmin = userRole === 'Systems';

    return (
        <div className="border-b border-gray-100 bg-white sticky top-0 z-50 backdrop-blur-md bg-opacity-95 shadow-sm">
            <div className="w-full px-6 h-16 flex items-center justify-between">
                <Link href="/home" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                    <div className="font-extrabold text-2xl tracking-tighter text-[#0095A9]">
                        EPAM
                    </div>
                    <div className="h-5 w-[1px] bg-gray-300"></div>
                    <div className="font-bold text-xs tracking-[0.2em] text-gray-400 uppercase">
                        {clientName}
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <Link
                        href={`/dashboard?client=${clientName}`}
                        className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-[#0095A9] hover:bg-gray-50 rounded-xl transition-all font-bold text-xs"
                        title="View Past Sessions"
                    >
                        <LayoutDashboard size={18} />
                        <span>Sessions</span>
                    </Link>

                    <button
                        onClick={() => alert("Candidate Management Module Coming Soon!")}
                        className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-[#0095A9] hover:bg-gray-50 rounded-xl transition-all font-bold text-xs"
                        title="Manage Candidates (Coming Soon)"
                    >
                        <Users size={18} />
                        <span>Candidates</span>
                    </button>

                    <div className="relative">
                        {isGlobalAdmin ? (
                            <>
                                <button
                                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                    className="hidden md:flex items-center gap-2 text-[9px] font-bold px-3 py-1 bg-gray-100 rounded-full tracking-widest text-gray-500 uppercase border border-gray-200 hover:bg-gray-200 transition-colors"
                                >
                                    {clientName === 'All' ? 'All Context' : clientName === 'Systems' ? 'Global Screen' : `${clientName} Context`}
                                    <ChevronDown size={12} />
                                </button>
                                {isClientDropdownOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        {['All', 'Systems', 'Uber', 'ServiceNow'].map((client) => (
                                            <button
                                                key={client}
                                                onClick={() => {
                                                    setClientName(client);
                                                    setIsClientDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-[#0095A9] uppercase tracking-wider transition-colors"
                                            >
                                                {client === 'All' ? 'All Positions' : client === 'Systems' ? 'Global Screen' : client}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            // Non-Global Admin View: Locked Badge
                            <div className="hidden md:flex items-center gap-2 text-[9px] font-bold px-3 py-1 bg-[#0095A9]/5 text-[#0095A9] rounded-full tracking-widest uppercase border border-[#0095A9]/20 cursor-default">
                                <Lock size={10} />
                                {clientName} Context
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-xs"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
