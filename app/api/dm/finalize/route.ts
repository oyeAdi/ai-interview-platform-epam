import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { LLMRouter } from '@/lib/llm-router';

export async function POST(req: NextRequest) {
    try {
        const { folder } = await req.json();
        if (!folder) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });

        const sessionDir = path.join(process.cwd(), 'data', 'sessions', folder);
        const reportPath = path.join(sessionDir, 'report.md');
        const finalPath = path.join(sessionDir, 'final_feedback.json');

        if (!fs.existsSync(reportPath)) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const reportContent = fs.readFileSync(reportPath, 'utf-8');

        // Synthesis Logic
        const systemPrompt = "You are a Senior Delivery Manager at EPAM. Provide a final structured assessment based on an interview report.";
        const userPrompt = `
            Analyze this interview report and provide a high-level summary for the Delivery Manager.
            Focus on the following 4 areas:
            1. Overall Technical: Summary of technical competence across all rounds.
            2. Overall Behavioral: Soft skills, attitude, and fit.
            3. Overall Communication: Clarity, articulation, and interaction style.
            4. Overall Feedback: Summarized Strengths and Areas of Improvement.

            Report Content:
            ${reportContent}

            IMPORTANT: Respond ONLY in strict JSON format:
            {
                "technical": "Summary...",
                "behavioral": "Summary...",
                "communication": "Summary...",
                "feedback": {
                    "strengths": ["...", "..."],
                    "improvements": ["...", "..."]
                },
                "verdict": "Hired / Not Hired",
                "reason": "Brief reason..."
            }
        `;

        const { text } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);

        // Clean and Parse
        let cleanJson = text;
        if (text.includes('```json')) {
            cleanJson = text.split('```json')[1].split('```')[0].trim();
        } else if (text.includes('```')) {
            cleanJson = text.split('```')[1].split('```')[0].trim();
        }

        const summary = JSON.parse(cleanJson);

        // Save to file
        fs.writeFileSync(finalPath, JSON.stringify(summary, null, 2));

        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('Finalize Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
