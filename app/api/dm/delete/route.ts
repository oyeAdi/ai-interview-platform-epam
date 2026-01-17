import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { bucket } from '@/lib/firebase-admin';

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

        // 2. Delete from Storage (Multi-provider)
        const fileName = `sessions/${folderName}/recording.webm`;
        const storageTasks = [];

        // A. Supabase Storage (Data files: transcript, report)
        const { data: files } = await supabaseAdmin.storage.from('assessment-data').list(`sessions/${folderName}`);
        if (files && files.length > 0) {
            const pathsToRemove = files.map((f: any) => `sessions/${folderName}/${f.name}`);
            storageTasks.push(supabaseAdmin.storage.from('assessment-data').remove(pathsToRemove));
        }

        // B. Cloudflare R2 (Recordings)
        storageTasks.push(
            r2Client.send(new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileName,
            })).catch(err => console.warn('[Delete API] R2 delete failed (might not exist):', err.message))
        );

        // C. Firebase Storage (Legacy Recordings)
        if (bucket) {
            storageTasks.push(
                bucket.file(fileName).delete()
                    .catch((err: any) => console.warn('[Delete API] Firebase delete failed (might not exist):', err.message))
            );
        }

        // D. Supabase Storage (Recordings - if any)
        storageTasks.push(
            supabaseAdmin.storage.from('recordings').remove([fileName])
                .catch((err: any) => console.warn('[Delete API] Supabase recordings delete failed:', err.message))
        );

        await Promise.allSettled(storageTasks);

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
