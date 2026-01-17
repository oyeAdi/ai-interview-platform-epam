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

        // Server-side filtering: Skip filter ONLY if 'All' is selected
        if (client && client !== 'All') {
            query = query.eq('client', client);
        }

        const { data: sessions, error } = await query;

        if (error) throw error;

        // Collect all jobIds to fetch titles
        const jobIds = [...new Set((sessions || []).map((s: any) => s.job_id).filter(Boolean))];

        // Fetch job titles map
        let jobTitleMap: Record<string, string> = {};
        if (jobIds.length > 0) {
            const { data: jobs } = await supabaseAdmin
                .from('job_roles')
                .select('job_id, job_title')
                .in('job_id', jobIds);

            if (jobs) {
                jobTitleMap = jobs.reduce((acc: any, job: any) => {
                    acc[job.job_id] = job.job_title;
                    return acc;
                }, {});
            }
        }

        const formattedSessions = (sessions || []).map((session: any) => ({
            id: session.session_id,
            folderName: session.session_id,
            date: session.created_at,
            jobId: session.job_id,
            jobTitle: jobTitleMap[session.job_id] || session.job_title || session.config?.jobTitle || session.job_id, // Hierarchy: Role DB -> Session DB -> Config -> Raw ID
            candidateName: session.candidate_name,
            candidateEmail: session.candidate_email,
            client: session.client || 'Systems',
            reportPreview: "Click to view full report...",
            hasFinalFeedback: session.has_feedback || false,
            recordingUrl: session.recording_url
        }));

        return NextResponse.json({ sessions: formattedSessions });
    } catch (error: any) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ sessions: [] });
    }
}
