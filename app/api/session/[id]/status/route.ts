import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { data, error } = await supabase
            .from('assessment_sessions')
            .select('*')
            .eq('session_id', id)
            .single();

        if (error || !data) {
            console.error('[Session Status API] Lookup failed:', error);
            return NextResponse.json({
                exists: false,
                completed: false,
                debugError: error,
                params: id,
                envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
            });
        }

        return NextResponse.json({
            exists: true,
            completed: !!data.completed_at,
            completedAt: data.completed_at,
            createdAt: data.created_at
        });
    } catch (error) {
        console.error('[Session Status API] Error:', error);
        return NextResponse.json({
            exists: false,
            completed: false
        });
    }
}
