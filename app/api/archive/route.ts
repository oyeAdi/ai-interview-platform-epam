import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const transcript = formData.get('transcript') as string;
        const report = formData.get('report') as string;
        const recording = formData.get('recording') as Blob;
        const jobId = formData.get('jobId') as string;
        const timestamp = formData.get('timestamp') as string || new Date().toISOString().replace(/[:.]/g, '-');

        const sessionFolderName = `session_${jobId}_${timestamp}`;
        const sessionDir = path.join(process.cwd(), 'data', 'sessions', sessionFolderName);

        // Ensure directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        // 1. Save Transcript
        if (transcript) {
            fs.writeFileSync(path.join(sessionDir, 'transcript.json'), transcript);
        }

        // 2. Save Report
        if (report) {
            fs.writeFileSync(path.join(sessionDir, 'report.md'), report);
        }

        // 3. Save Recording
        if (recording) {
            const buffer = Buffer.from(await recording.arrayBuffer());
            fs.writeFileSync(path.join(sessionDir, 'recording.webm'), buffer);
        }

        // 4. Save Metadata
        const candidateName = formData.get('candidateName') as string || 'Unknown Candidate';
        const candidateEmail = formData.get('candidateEmail') as string || '';

        const metadata = {
            id: sessionFolderName,
            jobId,
            date: new Date().toISOString(),
            candidateName,
            candidateEmail,
            timestamp
        };
        fs.writeFileSync(path.join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

        return NextResponse.json({
            success: true,
            folder: `data/sessions/${sessionFolderName}`
        });
    } catch (error: any) {
        console.error('Archive Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
