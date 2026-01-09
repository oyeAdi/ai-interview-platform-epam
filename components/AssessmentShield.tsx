'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Maximize2, AlertTriangle, MonitorX, ShieldCheck } from 'lucide-react';

interface AssessmentShieldProps {
    children: React.ReactNode;
    onViolation?: (type: string, details: string) => void;
    onTerminate?: () => void;
    onRestartSharing?: () => void;
    sessionId: string;
}

export default function AssessmentShield({ children, onViolation, onTerminate, onRestartSharing, sessionId }: AssessmentShieldProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFocused, setIsFocused] = useState(true);
    const [isMultiTab, setIsMultiTab] = useState(false);
    const [violationCount, setViolationCount] = useState(0);
    const [fullscreenStrikes, setFullscreenStrikes] = useState(0);
    const [focusStrikes, setFocusStrikes] = useState(0);
    const [shareStrikes, setShareStrikes] = useState(0);
    const [isSharing, setIsSharing] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const isReadyRef = useRef(false);
    const lastViolationRef = useRef<number>(0);

    // --- Violation Handler (Stable & Available) ---
    const handleViolation = useCallback((type: string, details: string) => {
        const now = Date.now();
        if (now - lastViolationRef.current < 1200) {
            console.log(`[Shield] Cooldown active. Ignoring violation: ${type}`);
            return;
        }
        lastViolationRef.current = now;

        console.log(`[Shield] Violation Accepted: ${type} - ${details}`);

        if (type === 'SHARE_LOSS') {
            setIsSharing(false);
            setShareStrikes(prev => prev + 1);
        }

        if (type === 'FOCUS_LOSS' || type === 'VISIBILITY_LOSS') {
            setIsFocused(false);
            setFocusStrikes(prev => prev + 1);
        }

        if (type === 'FULLSCREEN_EXIT') {
            setIsFullscreen(false);
            setFullscreenStrikes(prev => prev + 1);
        }

        setViolationCount(prev => prev + 1);
        if (onViolation) onViolation(type, details);
    }, [onViolation]);

    // Handle Termination via Effect to avoid "setState during render" issues
    useEffect(() => {
        if (shareStrikes >= 2 || focusStrikes >= 2 || fullscreenStrikes >= 2) {
            console.warn("[Shield] Strike threshold reached. Terminating session...");
            if (onTerminate) onTerminate();
        }
    }, [shareStrikes, focusStrikes, fullscreenStrikes, onTerminate]);

    // Expose globally for child components (InterviewSessionV2)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).reportShieldViolation = handleViolation;
        }
        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).reportShieldViolation;
            }
        };
    }, [handleViolation]);

    useEffect(() => {
        // Sync initial state
        setIsFullscreen(!!document.fullscreenElement);

        const readyTimer = setTimeout(() => {
            isReadyRef.current = true;
        }, 1500);

        // 1. Multi-Tab Detection
        const channel = new BroadcastChannel(`assessment_${sessionId}`);
        channel.onmessage = (event) => {
            if (event.data === 'ping') {
                channel.postMessage('pong');
                setIsMultiTab(true);
            } else if (event.data === 'pong') {
                setIsMultiTab(true);
            }
        };
        channel.postMessage('ping');

        // 2. Focus & Visibility
        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleViolation('VISIBILITY_LOSS', 'Candidate switched tabs or minimized browser');
            } else {
                setIsFocused(true); // Allow clearing warning when returning
            }
        };

        const handleBlur = () => {
            if (!isReadyRef.current) return;
            handleViolation('FOCUS_LOSS', 'Browser window lost focus');
        };

        const handleFocus = () => {
            setIsFocused(true);
        };

        // 3. Fullscreen Listeners
        const handleFullscreenChange = () => {
            const currentFullscreen = !!document.fullscreenElement;
            if (!isReadyRef.current) {
                setIsFullscreen(currentFullscreen);
                return;
            }

            if (!currentFullscreen) {
                handleViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode');
            } else {
                setIsFullscreen(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        const watchdog = setInterval(() => {
            setIsFullscreen(!!document.fullscreenElement);
        }, 3000);

        return () => {
            clearTimeout(readyTimer);
            clearInterval(watchdog);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            channel.close();
        };
    }, [sessionId, handleViolation, onTerminate]);

    const enterFullscreen = () => {
        if (containerRef.current?.requestFullscreen) {
            containerRef.current.requestFullscreen().catch(e => console.error("Fullscreen failed", e));
        }
    };

    return (
        <div ref={containerRef} className="fixed inset-0 w-full h-full bg-white overflow-hidden selection:bg-[#0095A9]/10">
            {/* Multi-Tab Conflict */}
            {isMultiTab && (
                <div className="fixed inset-0 z-[10000] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center text-white">
                    <div className="max-w-md">
                        <MonitorX className="w-16 h-16 text-red-500 mx-auto mb-6" />
                        <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">Security Conflict</h2>
                        <p className="text-slate-300 mb-8 leading-relaxed">
                            This interview is already open in another tab. Please close all other tabs and refresh this page to continue.
                        </p>
                    </div>
                </div>
            )}

            {/* Screen Sharing Stopped Overlay */}
            {!isSharing && !isMultiTab && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center text-white">
                    <div className="max-w-md">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <ShieldAlert className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">Sharing Required</h2>
                        <p className="text-slate-300 mb-8 leading-relaxed">
                            Full monitor sharing is mandatory for this assessment.
                            If you stopped sharing by mistake, please restart it now.
                        </p>

                        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl mb-8">
                            <p className="text-red-400 font-black uppercase tracking-widest text-[10px] mb-1">Strike {shareStrikes} of 2</p>
                            <p className="text-sm text-red-200">
                                {shareStrikes >= 2 ? 'Security threshold exceeded. Terminating session.' : 'One more interruption will result in automatic termination.'}
                            </p>
                        </div>

                        {shareStrikes < 2 && (
                            <button
                                onClick={() => {
                                    setIsSharing(true);
                                    if (onRestartSharing) onRestartSharing();
                                }}
                                className="px-10 py-5 bg-[#0095A9] text-white rounded-2xl font-bold shadow-2xl hover:bg-[#00ADC2] active:scale-95 transition-all flex items-center gap-3 mx-auto"
                            >
                                <ShieldCheck className="w-5 h-5" />
                                Restart Full Monitor Sharing
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Fullscreen Requirement */}
            {!isFullscreen && isSharing && !isMultiTab && (
                <div className="fixed inset-0 z-[9998] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center text-white">
                    <div className="max-w-md">
                        <Maximize2 className="w-16 h-16 text-[#0095A9] mx-auto mb-6" />
                        <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">Fullscreen Mode</h2>
                        <p className="text-slate-300 mb-8 leading-relaxed">
                            To protect assessment integrity, you must stay in fullscreen. Exiting fullscreen is logged as a security violation.
                        </p>

                        {fullscreenStrikes > 0 && (
                            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl mb-8">
                                <p className="text-red-400 font-black uppercase tracking-widest text-[10px] mb-1">Strike {fullscreenStrikes} of 2</p>
                                <p className="text-sm text-red-200">
                                    {fullscreenStrikes >= 2 ? 'Threshold exceeded.' : 'Further violations will terminate the session.'}
                                </p>
                            </div>
                        )}

                        {fullscreenStrikes < 2 && (
                            <button
                                onClick={enterFullscreen}
                                className="px-10 py-5 bg-[#0095A9] text-white rounded-2xl font-bold shadow-2xl hover:bg-[#00ADC2] transition-all"
                            >
                                Return to Fullscreen
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Focus Lost Overlay */}
            {!isFocused && isFullscreen && isSharing && !isMultiTab && (
                <div className="fixed inset-0 z-[9997] bg-slate-900/90 backdrop-blur-md flex items-center justify-center text-center text-white p-6">
                    <div className="bg-white p-12 rounded-[40px] shadow-2xl max-w-md">
                        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
                        <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight uppercase">Focus Lost</h3>
                        <p className="text-slate-500 mb-8 font-medium">
                            You moved away from the assessment window. This serves as a warning.
                        </p>

                        <div className="p-6 bg-red-50 border-2 border-red-100 rounded-3xl mb-8">
                            <p className="text-red-600 font-black uppercase tracking-widest text-[10px] mb-2">Strike {focusStrikes} of 2</p>
                            <p className="text-slate-600 text-sm font-semibold">
                                {focusStrikes >= 2 ? 'Terminating...' : 'Return to the dashboard to avoid termination.'}
                            </p>
                        </div>

                        <button
                            onClick={() => setIsFocused(true)}
                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all uppercase tracking-widest text-sm"
                        >
                            Return to Interview
                        </button>
                    </div>
                </div>
            )}

            <div className="w-full h-full">
                {children}
            </div>
        </div>
    );
}
