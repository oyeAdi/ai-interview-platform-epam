import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const folder = req.nextUrl.searchParams.get('folder');
    if (!folder) {
        return new NextResponse("Folder required", { status: 400 });
    }

    try {
        // Firebase path: sessions/{folder}/recording.webm
        const file = bucket.file(`sessions/${folder}/recording.webm`);

        // Check if file exists in Firebase
        const [exists] = await file.exists();
        if (!exists) {
            console.warn(`[Video API] Recording not found in Firebase: sessions/${folder}/recording.webm`);
            return new NextResponse("Video not found in cloud storage", { status: 404 });
        }

        // Generate a signed URL (valid for 1 hour)
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 3600 * 1000,
        });

        // Redirect to the signed URL
        return NextResponse.redirect(signedUrl);
    } catch (err: any) {
        console.error("Firebase Video API error:", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
