import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { LLMRouter } from '@/lib/llm-router';

export async function POST(req: NextRequest) {
    if (!supabaseAdmin) {
        console.error('[Finalize API] Supabase Admin not initialized');
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    try {
        const { folder } = await req.json();
        if (!folder) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });

        const reportStoragePath = `sessions/${folder}/report.md`;
        const finalStoragePath = `sessions/${folder}/final_feedback.json`;

        // 1. Read Report from Supabase
        const { data: reportData, error: reportError } = await supabaseAdmin.storage
            .from('assessment-data')
            .download(reportStoragePath);

        if (reportError) {
            console.error('[Finalize API] Report download error:', reportError);
            return NextResponse.json({ error: 'Report not found in cloud storage' }, { status: 404 });
        }

        const reportContent = await reportData.text();

        // 2. Synthesis Logic (LLM)
        const systemPrompt = "You are a Senior Delivery Manager at EPAM. Provide a final structured assessment based on an interview report.";
        const userPrompt = `
            Analyze this interview report and provide a high-level summary for the Delivery Manager.
            
            IMPORTANT: The report contains a "FINAL WORKSPACE CAPTURE" section. You MUST evaluate the quality, scalability, and correctness of the actual code or system design provided by the candidate in that section.
            
            Focus on the following  area:
            1. Overall Technical: Summary of technical competence across all rounds, including a critique of their final code/design implementation.
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
                "overall_summary": "A 2-sentence executive summary of the candidate's performance...",
                "verdict": "Hired / Not Hired",
                "reason": "Brief reason..."
            }
        `;

        const { text } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);

        // Clean and Parse LLM Response
        let cleanJson = text;
        if (text.includes('```json')) {
            cleanJson = text.split('```json')[1].split('```')[0].trim();
        } else if (text.includes('```')) {
            cleanJson = text.split('```')[1].split('```')[0].trim();
        }

        const summary = JSON.parse(cleanJson);

        // 3. Save synthesis back to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('assessment-data')
            .upload(finalStoragePath, JSON.stringify(summary, null, 2), {
                contentType: 'application/json',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 4. Update Database to mark as finalized
        const { error: dbError } = await supabaseAdmin
            .from('assessment_sessions')
            .update({ has_feedback: true })
            .eq('session_id', folder);

        if (dbError) {
            console.warn('[Finalize API] Database update error:', dbError.message);
        }

        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('Finalize Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
