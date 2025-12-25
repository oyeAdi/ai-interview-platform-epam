import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const folder = searchParams.get('folder');
        const type = searchParams.get('type') || 'report'; // 'report' or 'final'

        if (!folder) return NextResponse.json({ error: 'Folder is required' }, { status: 400 });

        const sessionDir = path.join(process.cwd(), 'data', 'sessions', folder);
        const filePath = path.join(sessionDir, type === 'final' ? 'final_feedback.json' : 'report.md');

        if (!fs.existsSync(filePath)) {
            if (type === 'final') return NextResponse.json(null);
            return new Response('Report not found', { status: 404 });
        }

        const content = fs.readFileSync(filePath, 'utf-8');

        if (type === 'final') {
            return NextResponse.json(JSON.parse(content));
        }

        return new Response(content, {
            headers: { 'Content-Type': 'text/markdown' }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
