import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JobDescription } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const client = searchParams.get('client');

        let query = supabaseAdmin
            .from('job_roles')
            .select('*')
            .order('created_at', { ascending: false });

        if (client && client !== 'All') {
            query = query.eq('client', client);
        }

        const { data, error } = await query;

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const newJob: JobDescription = await req.json();

        // Simple validation
        if (!newJob.id) newJob.id = Math.random().toString(36).substr(2, 9);
        const { client = 'Uber', ...jobData } = newJob; // Ensure client fallback

        const { data, error } = await supabaseAdmin
            .from('job_roles')
            .insert([{ ...jobData, client }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const updatedJob: JobDescription = await req.json();
        const { id, ...updates } = updatedJob;

        const { data, error } = await supabaseAdmin
            .from('job_roles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();

        const { error } = await supabaseAdmin
            .from('job_roles')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
