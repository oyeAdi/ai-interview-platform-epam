import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const { data: sessions, error } = await supabaseAdmin
            .from('assessment_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedSessions = (sessions || []).map((session: any) => ({
            id: session.session_id,
            folderName: session.session_id,
            date: session.created_at,
            jobId: session.job_id,
            candidateName: session.candidate_name,
            candidateEmail: session.candidate_email,
            reportPreview: "Click to view full report...",
            hasFinalFeedback: session.has_feedback || false
        }));

        return NextResponse.json({ sessions: formattedSessions });
    } catch (error: any) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ sessions: [] });
    }
}
