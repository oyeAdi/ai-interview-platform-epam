import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { bucket } from '@/lib/firebase-admin';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { PutObjectCommand } from "@aws-sdk/client-s3";

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

        console.log('[Archive API] Session ID:', sessionId);
        console.log('[Archive API] Recording blob received:', !!recording);
        if (recording) {
            console.log('[Archive API] Recording size:', recording.size, 'bytes');
            console.log('[Archive API] Recording type:', recording.type);
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

        // 3. Queue Recording Upload
        if (!recordingUrl && recording) {
            const provider = process.env.STORAGE_PROVIDER || 'FIREBASE';
            const fileName = `sessions/${sessionId}/recording.webm`;
            const buffer = Buffer.from(await recording.arrayBuffer());

            console.log('[Archive API] Uploading recording to', provider);
            console.log('[Archive API] Recording buffer size:', buffer.length);

            if (provider === 'R2') {
                console.log('[Archive API] Uploading to R2:', fileName);
                tasks.push(
                    r2Client.send(new PutObjectCommand({
                        Bucket: R2_BUCKET_NAME,
                        Key: fileName,
                        Body: buffer,
                        ContentType: 'video/webm',
                    })).then(() => {
                        console.log('[Archive API] R2 upload successful');
                        return { success: true };
                    }).catch((err: any) => {
                        console.error('[Archive API] R2 upload failed:', err);
                        throw err;
                    })
                );
            } else if (provider === 'SUPABASE') {
                tasks.push(
                    supabaseAdmin.storage
                        .from('recordings')
                        .upload(fileName, buffer, { contentType: 'video/webm', upsert: true })
                );
            } else if (bucket) {
                tasks.push((async () => {
                    const file = bucket.file(fileName);
                    await file.save(buffer, { metadata: { contentType: 'video/webm' }, resumable: false });
                    return { success: true };
                })());
            }
            recordingUrl = fileName;
        } else {
            console.log('[Archive API] Skipping recording upload. recordingUrl:', recordingUrl, 'recording:', !!recording);
        }

        const client = formData.get('client') as string || 'Systems';

        // 4. Queue Database Upsert
        const { error: dbError } = await supabaseAdmin
            .from('assessment_sessions')
            .upsert({
                session_id: sessionId,
                job_id: jobId,
                candidate_name: candidateName,
                candidate_email: candidateEmail,
                transcript_url: transcriptPath,
                report_url: reportPath,
                recording_url: recordingUrl || (recording ? `sessions/${sessionId}/recording.webm` : ''),
                client: client,
                completed_at: new Date().toISOString(), // CRITICAL: Mark as completed for retake prevention
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'session_id'
            });

        if (dbError) {
            console.error('[Archive API] Database upsert failed:', dbError);
            throw dbError;
        }

        // Execute all remaining parallel tasks (uploads)
        console.log(`[Archive API] Executing ${tasks.length} upload tasks in parallel for session: ${sessionId}`);
        const uploadResults = await Promise.all(tasks);

        // Check for errors in the upload results
        for (const res of uploadResults) {
            if (res && typeof res === 'object' && res.error) {
                console.error('[Archive API] Upload task failed:', res.error);
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
