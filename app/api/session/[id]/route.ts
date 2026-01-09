import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    try {
        const { id } = await params;
        const { data, error } = await supabaseAdmin
            .from('assessment_sessions')
            .select('*')
            .eq('session_id', id)
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        // Format to match what frontend expects
        const response = {
            jobId: data.job_id,
            candidateName: data.candidate_name,
            candidateEmail: data.candidate_email,
            skills: data.config?.skills || [],
            config: data.config
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error("Failed to fetch session from DB:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
