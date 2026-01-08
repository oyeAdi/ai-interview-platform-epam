import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    try {
        const { sessionId, folderName, secretKey } = await req.json();

        // 1. Verify Secret Key
        // Allow env var override, default to 'admin-secret'
        const VALID_KEY = process.env.DM_DELETE_SECRET || 'admin-secret';

        if (secretKey !== VALID_KEY) {
            return NextResponse.json({ error: 'Invalid Secret Key' }, { status: 403 });
        }

        if (!sessionId || !folderName) {
            return NextResponse.json({ error: 'Missing session ID or folder name' }, { status: 400 });
        }

        console.log(`[Delete API] Deleting session ${sessionId} (Folder: ${folderName})`);

        // 2. Delete from Storage (Recursive-like)
        // Since Supabase Storage doesn't have a simple "delete folder" for all adapters,
        // we list files first then delete them.
        const { data: files, error: listError } = await supabaseAdmin
            .storage
            .from('assessment-data')
            .list(`sessions/${folderName}`);

        if (listError) {
            console.warn('[Delete API] Failed to list files', listError);
            // Continue to DB delete even if storage listing fails (might be empty)
        }

        if (files && files.length > 0) {
            const pathsToRemove = files.map((f: any) => `sessions/${folderName}/${f.name}`);
            const { error: removeError } = await supabaseAdmin
                .storage
                .from('assessment-data')
                .remove(pathsToRemove);

            if (removeError) {
                console.error('[Delete API] Failed to remove files', removeError);
                return NextResponse.json({ error: 'Failed to clean up storage' }, { status: 500 });
            }
        }

        // 3. Delete from Database
        const { error: dbError } = await supabaseAdmin
            .from('assessment_sessions')
            .delete()
            .eq('session_id', sessionId); // utilizing the unique session_id/folder_name

        if (dbError) {
            console.error('[Delete API] DB Delete Error', dbError);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
