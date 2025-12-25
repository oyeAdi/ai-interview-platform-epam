import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    if (!bucket) {
        console.error('[Upload URL API] Firebase bucket not initialized');
        return NextResponse.json({ error: 'Cloud storage not configured' }, { status: 500 });
    }

    try {
        const { fileName, contentType } = await req.json();

        if (!fileName || !contentType) {
            return NextResponse.json({ error: 'fileName and contentType are required' }, { status: 400 });
        }

        console.log(`[Upload URL API] Generating signed URL for: ${fileName} (${contentType})`);

        const file = bucket.file(fileName);

        // Generate a v4 signed URL for writing
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType: contentType,
        });

        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('[Upload URL API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
