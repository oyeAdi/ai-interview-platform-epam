import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-admin';
import { supabaseAdmin } from '@/lib/supabase';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(req: NextRequest) {
    const provider = process.env.STORAGE_PROVIDER || 'FIREBASE';
    const sessionId = req.nextUrl.searchParams.get('folder'); // 'folder' param is actually sessionId
    console.log(`[Video API] Using provider: ${provider}, SessionId: ${sessionId}`);

    if (!sessionId) {
        return new NextResponse("Session ID required", { status: 400 });
    }

    try {
        // 1. Resolve actual file path from DB
        let filePath = `sessions/${sessionId}/recording.webm`; // Default Legacy Path

        // We use supabaseAdmin to bypass RLS for this system operation if needed, 
        // or just use supabase if public/service role allows.
        if (supabaseAdmin) {
            const { data: session } = await supabaseAdmin
                .from('assessment_sessions')
                .select('recording_url')
                .eq('id', sessionId)
                .single();

            if (session?.recording_url) {
                // If it's a full URL, we might need to extract Key, but 
                // typically we store Relative Path or Key in this column for newer sessions.
                // If it stores "sessions/xyz.webm" -> perfect.
                // If it stores "https://..." -> we need to handle that.
                // As per 'archive' route logic: it stores "sessions/${sessionId}_interview.webm" (key).
                // Or "sessions/${sessionId}/recording.webm".
                // So we can blindly use it if it looks like a path.
                if (!session.recording_url.startsWith('http')) {
                    filePath = session.recording_url;
                }
            }
        }

        console.log(`[Video API] Resolved Path: ${filePath}`);

        if (provider === 'R2') {
            console.log(`[Video API] Generating R2 presigned URL for key: ${filePath}`);
            const command = new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: filePath, // Use resolved key
            });
            const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
            return NextResponse.redirect(signedUrl);
        } else if (provider === 'SUPABASE') {
            if (!supabaseAdmin) throw new Error("Supabase Admin not initialized");
            const { data, error } = await supabaseAdmin.storage
                .from('recordings')
                .createSignedUrl(filePath, 3600);
            if (error || !data) throw new Error(`Supabase error: ${error?.message || 'File not found'}`);
            return NextResponse.redirect(data.signedUrl);
        } else {
            // Default to Firebase
            if (!bucket) throw new Error("Firebase bucket not initialized");
            const file = bucket.file(filePath);
            const [exists] = await file.exists();
            if (!exists) throw new Error(`Video not found at ${filePath}`);
            const [signedUrl] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 3600 * 1000,
            });
            return NextResponse.redirect(signedUrl);
        }
    } catch (err: any) {
        console.error("[Video API] Error:", err.message, err.stack);
        const isBillingError = err.message?.toLowerCase().includes('billing') || err.message?.toLowerCase().includes('disabled');
        const status = isBillingError ? 402 : 500;
        return new NextResponse(`Storage Error: ${err.message}${isBillingError ? '. Please check your Firebase billing status.' : ''}`, { status });
    }
}
