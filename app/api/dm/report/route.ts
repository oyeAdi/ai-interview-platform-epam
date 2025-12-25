import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const folder = searchParams.get('folder');
        const type = searchParams.get('type') || 'report'; // 'report' or 'final'

        if (!folder) return NextResponse.json({ error: 'Folder is required' }, { status: 400 });

        const fileName = type === 'final' ? 'final_feedback.json' : 'report.md';
        const storagePath = `sessions/${folder}/${fileName}`;

        const { data, error } = await supabaseAdmin.storage
            .from('assessment-data')
            .download(storagePath);

        if (error) {
            console.warn(`[Report API] File not found: ${storagePath}`);
            if (type === 'final') return NextResponse.json(null);
            return new Response('Report not found', { status: 404 });
        }

        const content = await data.text();

        if (type === 'final') {
            return NextResponse.json(JSON.parse(content));
        }

        return new Response(content, {
            headers: { 'Content-Type': 'text/markdown' }
        });
    } catch (error: any) {
        console.error("Report API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
