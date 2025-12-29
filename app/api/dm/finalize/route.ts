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
        const transcriptStoragePath = `sessions/${folder}/transcript.json`;
        const finalStoragePath = `sessions/${folder}/final_feedback.json`;

        // 1. Read Report and Transcript from Supabase
        const [reportDataRes, transcriptDataRes] = await Promise.all([
            supabaseAdmin.storage.from('assessment-data').download(reportStoragePath),
            supabaseAdmin.storage.from('assessment-data').download(transcriptStoragePath)
        ]);

        if (reportDataRes.error) {
            console.error('[Finalize API] Report download error:', reportDataRes.error);
            return NextResponse.json({ error: 'Report not found in cloud storage' }, { status: 404 });
        }

        const reportContent = await reportDataRes.data.text();
        let transcriptContent = 'No transcript available.';
        let filteredCandidateReplies = 'No verbal candidate responses found.';

        if (!transcriptDataRes.error) {
            try {
                const fullTranscript = JSON.parse(await transcriptDataRes.data.text());
                // Filter for candidate (user) role only, starting after Round 0 (MCQ)
                // In our current flow, Round 0 is the first set of messages. 
                // However, detecting "Round 0" index in a flat message list is tricky.
                // We'll trust the LLM prompt to focus on everything except MCQ, but we'll provide ONLY candidate lines.
                const candidateMessages = Array.isArray(fullTranscript)
                    ? fullTranscript.filter((m: any) => m.role === 'user' && m.text && !m.text.includes('Start the interview'))
                    : [];

                if (candidateMessages.length > 0) {
                    filteredCandidateReplies = candidateMessages.map((m: any, i: number) => `Candidate Reply ${i + 1}: "${m.text}"`).join('\n\n');
                }
                transcriptContent = JSON.stringify(fullTranscript, null, 2);
            } catch (e) {
                console.warn('[Finalize API] Failed to parse transcript JSON, using raw text fallback.');
                transcriptContent = await transcriptDataRes.data.text();
            }
        }

        // 2. Synthesis Logic (LLM)
        const systemPrompt = "You are a Senior Delivery Manager at EPAM and an expert in AI-generated content detection. Provide a final structured assessment and evaluate the likelihood of AI usage based ONLY on the candidate's verbal replies.";
        const userPrompt = `
            Analyze this interview report and the CANDIDATE'S responses from the transcript to provide a high-level summary for the Delivery Manager.
            
            ### CRITICAL: PLAGIARISM / AI DETECTION
            Analyze the SPECIFIC CANDIDATE REPLIES below for patterns typical of AI (ChatGPT/Claude):
            - Perfectly structured lists and "hallmarks" of LLM writing style.
            - Overly formal, robotic, or repetitive transition phrases (e.g., "Certainly!", "In conclusion", "Moreover").
            - Perfect grammar and lack of natural conversational fillers/hesitations.
            - Highly generic but technically correct answers that lack specific personal experience or proprietary context.
            
            CANDIDATE REPLIES FOR ANALYSIS:
            ${filteredCandidateReplies}
            
            ### ACTUAL IMPLEMENTATION EVALUATION
            The report contains a "FINAL WORKSPACE CAPTURE" section. You MUST evaluate the quality and correctness of the actual code or system design provided.
            
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
                "plagiarism_check": {
                    "score": 0-100, // Confidence level that the candidate used AI (0=Human, 100=AI)
                    "verdict": "Likely Human / Suspicious / Likely AI",
                    "reasoning": "Brief explanation focused only on the candidate's replies."
                },
                "overall_summary": "A 2-sentence executive summary...",
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
