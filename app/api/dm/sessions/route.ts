import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: any) {
    if (!supabaseAdmin) {
        console.error("[Sessions API] Supabase Admin not initialized. Check your environment variables.");
        return NextResponse.json({ sessions: [], error: "Supabase not configured" });
    }

    try {
        // Extract client param
        const { searchParams } = new URL(req.url);
        const client = searchParams.get('client');

        let query = supabaseAdmin
            .from('assessment_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        // Server-side filtering: Skip filter if 'All' or 'Systems' (Global Admin)
        if (client && client !== 'All' && client !== 'Systems') {
            query = query.eq('client', client);
        }

        const { data: sessions, error } = await query;

        if (error) throw error;

        const formattedSessions = (sessions || []).map((session: any) => ({
            id: session.session_id,
            folderName: session.session_id,
            date: session.created_at,
            jobId: session.job_id,
            candidateName: session.candidate_name,
            candidateEmail: session.candidate_email,
            client: session.client || 'Uber',
            reportPreview: "Click to view full report...",
            hasFinalFeedback: session.has_feedback || false
        }));

        return NextResponse.json({ sessions: formattedSessions });
    } catch (error: any) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ sessions: [] });
    }
}
