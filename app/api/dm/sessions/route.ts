import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const sessionsDir = path.join(process.cwd(), 'data', 'sessions');

        if (!fs.existsSync(sessionsDir)) {
            return NextResponse.json({ sessions: [] });
        }

        const folders = fs.readdirSync(sessionsDir).filter(f => {
            const fullPath = path.join(sessionsDir, f);
            return fs.statSync(fullPath).isDirectory();
        });

        const sessions = folders.map(folder => {
            const folderPath = path.join(sessionsDir, folder);

            // Default Fallbacks
            const parts = folder.split('_');
            let candidateName = "Unknown Candidate";
            let candidateEmail = "";
            let jobTitle = parts.length >= 2 ? parts[1] : "Unknown Role";
            let timestampStr = parts.slice(2).join('_'); // Fallback timestamp

            // 1. Metadata extraction
            const metadataPath = path.join(folderPath, 'metadata.json');
            if (fs.existsSync(metadataPath)) {
                try {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
                    candidateName = metadata.candidateName || candidateName;
                    candidateEmail = metadata.candidateEmail || candidateEmail;
                    jobTitle = metadata.jobId || jobTitle;
                    if (metadata.date) timestampStr = metadata.date;
                } catch (e) {
                    console.error("Failed to parse metadata for", folder);
                }
            }

            // 2. Report Preview
            const reportPath = path.join(folderPath, 'report.md');
            let reportPreview = "";
            if (fs.existsSync(reportPath)) {
                reportPreview = fs.readFileSync(reportPath, 'utf-8').slice(0, 200) + "...";
            }

            // 3. Final Feedback Status
            const hasFinalFeedback = fs.existsSync(path.join(folderPath, 'final_feedback.json'));

            return {
                id: folder,
                folderName: folder,
                date: timestampStr,
                jobId: jobTitle,
                candidateName,
                candidateEmail,
                reportPreview,
                hasFinalFeedback
            };
        });

        // Sort by date desc
        sessions.sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({ sessions });
    } catch (error: any) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ sessions: [] });
    }
}
