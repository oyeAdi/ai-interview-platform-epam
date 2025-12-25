import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { bucket } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    if (!supabaseAdmin) {
        console.error('[Archive API] Supabase Admin not initialized');
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const transcript = formData.get('transcript') as string;
        const report = formData.get('report') as string;
        const recording = formData.get('recording') as Blob;
        const jobId = formData.get('jobId') as string;
        const candidateName = formData.get('candidateName') as string || 'Unknown Candidate';
        const candidateEmail = formData.get('candidateEmail') as string || '';
        const timestamp = formData.get('timestamp') as string || new Date().toISOString().replace(/[:.]/g, '-');

        const sessionId = `session_${jobId}_${timestamp}`;

        // 1. Upload Transcript to Supabase
        let transcriptUrl = '';
        if (transcript) {
            const { data } = await supabaseAdmin.storage
                .from('assessment-data')
                .upload(`sessions/${sessionId}/transcript.json`, transcript, {
                    contentType: 'application/json',
                    upsert: true
                });
            if (data) transcriptUrl = data.path;
        }

        // 2. Upload Report to Supabase
        let reportUrl = '';
        if (report) {
            const { data } = await supabaseAdmin.storage
                .from('assessment-data')
                .upload(`sessions/${sessionId}/report.md`, report, {
                    contentType: 'text/markdown',
                    upsert: true
                });
            if (data) reportUrl = data.path;
        }

        // 3. Handle Recording (Either directly uploaded by client or as a Blob)
        let recordingUrl = formData.get('recordingPath') as string || '';
        if (!recordingUrl && recording) {
            if (!bucket) {
                console.error('[Archive] Firebase bucket not initialized. Video upload skipped.');
            } else {
                console.log(`[Archive] Uploading recording to Firebase: sessions/${sessionId}/recording.webm`);
                try {
                    const file = bucket.file(`sessions/${sessionId}/recording.webm`);
                    const buffer = Buffer.from(await recording.arrayBuffer());

                    await file.save(buffer, {
                        metadata: { contentType: 'video/webm' },
                        resumable: false
                    });

                    recordingUrl = file.name;
                    console.log('[Archive] Firebase upload successful (vía Admin SDK):', recordingUrl);
                } catch (fbError: any) {
                    console.error('[Archive] Firebase upload failed:', fbError.message);
                }
            }
        } else if (recordingUrl) {
            console.log('[Archive] Using client-uploaded recording path:', recordingUrl);
        }

        // 4. Save Metadata to Supabase DB
        const { error: dbError } = await supabaseAdmin
            .from('assessment_sessions')
            .upsert({
                session_id: sessionId,
                job_id: jobId,
                candidate_name: candidateName,
                candidate_email: candidateEmail,
                transcript_url: transcriptUrl,
                report_url: reportUrl,
                recording_url: recordingUrl, // This now points to Firebase
                created_at: new Date().toISOString()
            });

        if (dbError) throw dbError;

        return NextResponse.json({
            success: true,
            sessionId
        });
    } catch (error: any) {
        console.error('Archive Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
