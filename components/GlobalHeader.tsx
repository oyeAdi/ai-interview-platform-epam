'use client';

import Link from 'next/link';
import { LayoutDashboard, Settings } from 'lucide-react';

export default function GlobalHeader() {
    return (
        <div className="border-b border-gray-100 bg-white sticky top-0 z-50 backdrop-blur-md bg-opacity-95 shadow-sm">
            <div className="w-full px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                    <div className="font-extrabold text-2xl tracking-tighter text-[#0095A9]">
                        EPAM
                    </div>
                    <div className="h-5 w-[1px] bg-gray-300"></div>
                    <div className="font-bold text-xs tracking-[0.2em] text-gray-400 uppercase">
                        Uber
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="p-2 text-gray-400 hover:text-[#0095A9] hover:bg-gray-50 rounded-full transition-all"
                        title="Dashboard"
                    >
                        <LayoutDashboard size={18} />
                    </Link>
                    <button
                        className="p-2 text-gray-400 hover:text-[#0095A9] hover:bg-gray-50 rounded-full transition-all"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>
                    <div className="hidden md:block text-[9px] font-bold px-3 py-1 bg-gray-100 rounded-full tracking-widest text-gray-500 uppercase border border-gray-200">
                        Technical Screening
                    </div>
                </div>
            </div>
        </div>
    );
}
