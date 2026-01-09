import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { jobId, candidateName, candidateEmail, client, config, skills } = body;
        const sessionId = uuidv4();

        // Save to Supabase
        const { error } = await supabaseAdmin
            .from('assessment_sessions')
            .insert({
                session_id: sessionId,
                job_id: jobId,
                candidate_name: candidateName,
                candidate_email: candidateEmail,
                client: client || 'Systems',
                config: {
                    ...config,
                    skills: skills // Store skills inside config for consistency
                }
            });

        if (error) throw error;

        return NextResponse.json({ sessionId });
    } catch (error: any) {
        console.error("Failed to create session in DB:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
