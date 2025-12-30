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

        let sessionId = formData.get('sessionId') as string;
        if (!sessionId) {
            sessionId = `session_${jobId}_${timestamp}`;
        }

        // Pre-determine URLs (since they are deterministic based on sessionId)
        const transcriptPath = `sessions/${sessionId}/transcript.json`;
        const reportPath = `sessions/${sessionId}/report.md`;
        let recordingUrl = formData.get('recordingPath') as string || '';

        const tasks: Promise<any>[] = [];

        // 1. Queue Transcript Upload
        if (transcript) {
            tasks.push(
                supabaseAdmin.storage
                    .from('assessment-data')
                    .upload(transcriptPath, transcript, {
                        contentType: 'application/json',
                        upsert: true
                    })
            );
        }

        // 2. Queue Report Upload
        if (report) {
            tasks.push(
                supabaseAdmin.storage
                    .from('assessment-data')
                    .upload(reportPath, report, {
                        contentType: 'text/markdown',
                        upsert: true
                    })
            );
        }

        // 3. Queue Recording Upload (to Firebase)
        if (!recordingUrl && recording && bucket) {
            const firebaseTask = (async () => {
                const file = bucket.file(`sessions/${sessionId}/recording.webm`);
                const buffer = Buffer.from(await recording.arrayBuffer());
                await file.save(buffer, {
                    metadata: { contentType: 'video/webm' },
                    resumable: false
                });
                return file.name;
            })();
            tasks.push(firebaseTask.then(name => { recordingUrl = name; }));
        }

        // 4. Queue Database Upsert
        // We can run this in parallel because we already know what the URLs WILL be
        const dbTask = supabaseAdmin
            .from('assessment_sessions')
            .upsert({
                session_id: sessionId,
                job_id: jobId,
                candidate_name: candidateName,
                candidate_email: candidateEmail,
                transcript_url: transcriptPath,
                report_url: reportPath,
                recording_url: recordingUrl || (recording ? `sessions/${sessionId}/recording.webm` : ''),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'session_id'
            });

        tasks.push(dbTask);

        // Execute all tasks in parallel
        console.log(`[Archive API] Executing ${tasks.length} tasks in parallel for session: ${sessionId}`);
        const results = await Promise.all(tasks);

        // Check for errors in the results
        for (const res of results) {
            if (res && typeof res === 'object' && res.error) {
                console.error('[Archive API] Task failed:', res.error);
                throw res.error;
            }
        }

        return NextResponse.json({
            success: true,
            sessionId
        });
    } catch (error: any) {
        console.error('Archive Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
