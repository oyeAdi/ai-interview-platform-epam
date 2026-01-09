'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Maximize2, AlertTriangle, MonitorX } from 'lucide-react';

interface AssessmentShieldProps {
    children: React.ReactNode;
    onViolation?: (type: string, details: string) => void;
    onTerminate?: () => void;
    sessionId: string;
}

export default function AssessmentShield({ children, onViolation, onTerminate, sessionId }: AssessmentShieldProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFocused, setIsFocused] = useState(true);
    const [isMultiTab, setIsMultiTab] = useState(false);
    const [violationCount, setViolationCount] = useState(0);
    const [fullscreenStrikes, setFullscreenStrikes] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 1. Multi-Tab Detection via BroadcastChannel
        const channel = new BroadcastChannel(`assessment_${sessionId}`);

        channel.onmessage = (event) => {
            if (event.data === 'ping') {
                channel.postMessage('pong');
                setIsMultiTab(true);
            } else if (event.data === 'pong') {
                setIsMultiTab(true);
            }
        };

        // Broadcast presence
        channel.postMessage('ping');

        // 2. Focus & Visibility Listeners
        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleViolation('VISIBILITY_LOSS', 'Tab switched or browser minimized');
                setIsFocused(false);
            } else {
                setIsFocused(true);
            }
        };

        const handleBlur = () => {
            handleViolation('FOCUS_LOSS', 'Browser window lost focus');
            setIsFocused(false);
        };

        const handleFocus = () => {
            setIsFocused(true);
        };

        // 3. Fullscreen Listeners
        const handleFullscreenChange = () => {
            const currentFullscreen = !!document.fullscreenElement;
            setIsFullscreen(currentFullscreen);

            if (!currentFullscreen && isFullscreen) {
                const nextStrikes = fullscreenStrikes + 1;
                setFullscreenStrikes(nextStrikes);
                handleViolation('FULLSCREEN_EXIT', `Strike ${nextStrikes} of 2`);

                if (nextStrikes >= 2) {
                    if (onTerminate) onTerminate();
                }
            }
        };

        const handleViolation = (type: string, details: string) => {
            setViolationCount(prev => prev + 1);
            if (onViolation) onViolation(type, details);
            console.warn(`[Shield] Violation Detected: ${type} - ${details}`);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            channel.close();
        };
    }, [sessionId, isFullscreen, fullscreenStrikes]);

    const enterFullscreen = () => {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => {
                console.error("Failed to enter fullscreen", err);
            });
        }
    };

    // --- Violation Overlays ---

    return (
        <div ref={containerRef} className="relative w-full h-screen bg-white">
            {/* Multi-Tab Block - Absolute Top Priority */}
            {isMultiTab && (
                <div className="fixed inset-0 z-[10000] bg-[#003040] flex items-center justify-center p-6 text-center text-white">
                    <div className="max-w-md animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                            <MonitorX className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-3xl font-black mb-4">Security Conflict</h2>
                        <p className="text-slate-300 mb-8 leading-relaxed">
                            This interview session is already open in another tab. To prevent cheating, only one active session is allowed.
                        </p>
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm font-semibold text-red-400">
                            Please close all other tabs of this assessment and refresh this page.
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Requirement Overlay */}
            {!isFullscreen && !isMultiTab && (
                <div className="fixed inset-0 z-[9998] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center text-white">
                    <div className="max-w-md">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                            <Maximize2 className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-3xl font-black mb-4">
                            {fullscreenStrikes === 0 ? 'Fullscreen Required' : 'Security Warning'}
                        </h2>
                        <div className="mb-8">
                            <p className="text-slate-300 leading-relaxed mb-4">
                                To maintain assessment integrity, this interview must be conducted in fullscreen mode.
                            </p>
                            {fullscreenStrikes > 0 ? (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                    <p className="text-red-400 font-bold uppercase tracking-widest text-xs mb-1">Strike 1 of 2</p>
                                    <p className="text-sm text-red-200">
                                        One more exit will results in **immediate termination** of your interview.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">
                                    Moving out of fullscreen is flagged as a security violation.
                                </p>
                            )}
                        </div>
                        <button
                            onClick={enterFullscreen}
                            className="px-8 py-4 bg-[#0095A9] text-white rounded-full font-bold shadow-2xl hover:bg-[#00ADC2] transition-all"
                        >
                            {fullscreenStrikes === 0 ? 'Enter Fullscreen Mode' : 'Return to Interview'}
                        </button>
                    </div>
                </div>
            )}

            {/* Focus Lost Overlay */}
            {!isFocused && isFullscreen && !isMultiTab && (
                <div className="absolute inset-0 z-[9997] bg-black/40 backdrop-blur-sm flex items-center justify-center text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm animate-in slide-in-from-bottom duration-300">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Focus Lost</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            You have moved away from the interview tab. This activity has been logged and reported to the system.
                        </p>
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                            Violation Count: {violationCount}
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full h-full overflow-hidden">
                {children}
            </div>
        </div>
    );
}
