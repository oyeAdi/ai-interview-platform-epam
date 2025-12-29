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

        // 3. Report Upgrade Logic (Reconstruct triplets for legacy reports)
        // If the report is in the old format (doesn't have triplets), attempt to rebuild it
        if (!reportContent.includes('### 🗨️') && !transcriptDataRes.error) {
            try {
                console.log('[Finalize API] Starting bucket-based report upgrade...');
                const fullTranscript = JSON.parse(await transcriptDataRes.data.text());

                // 1. Extract Notes into Buckets
                const noteBuckets: Record<string, string[]> = {
                    'Mcq': [],
                    'Conceptual': [],
                    'Coding': [],
                    'System Design': []
                };

                // Pattern: ### [Round] - Note:\s*[Content]
                // Stop before: next ### OR next [Round] - Note: OR FINAL
                const noteRegex = /(Mcq|Conceptual|Coding|System [Dd]esign) - Note:\s*([\s\S]*?)(?=\n(?:Mcq|Conceptual|Coding|System [Dd]esign) - Note:|\n###|\nFINAL|$)/g;
                let match;
                while ((match = noteRegex.exec(reportContent)) !== null) {
                    const type = match[1];
                    const content = match[2].trim();
                    if (noteBuckets[type]) {
                        noteBuckets[type].push(content);
                    }
                }

                // 2. Extract Transcript into Buckets
                const transcriptBuckets: Record<string, { q: string, r: string }[]> = {
                    'Mcq': [],
                    'Conceptual': [],
                    'Coding': [],
                    'System Design': []
                };

                let currentBucket = 'Mcq'; // Start with MCQ
                let lastQuestion = "Opening question";

                for (const msg of fullTranscript) {
                    if (msg.role === 'model') {
                        // Detect round transitions in AI speech
                        const text = msg.text.toLowerCase();
                        if (text.includes('conceptual discussion') || text.includes('shift gears into a more conceptual')) currentBucket = 'Conceptual';
                        else if (text.includes('coding assessment') || text.includes('practical coding')) currentBucket = 'Coding';
                        else if (text.includes('system design discussion') || text.includes('move into a system design')) currentBucket = 'System Design';

                        lastQuestion = msg.text;
                    } else if (msg.role === 'user') {
                        const isTrigger = /start the interview/i.test(msg.text) || (msg.text.length < 20 && /start/i.test(msg.text));
                        if (!isTrigger) {
                            transcriptBuckets[currentBucket].push({ q: lastQuestion, r: msg.text });
                        }
                    }
                }

                const upgradedReport = ["# 📋 Interview Protocol (Upgraded)\n"];

                // 3. Mesh Buckets
                const order = ['Mcq', 'Conceptual', 'Coding', 'System Design'];
                let globalInteractionIdx = 1;

                for (const type of order) {
                    const tBucket = transcriptBuckets[type];
                    const nBucket = noteBuckets[type];
                    const count = Math.max(tBucket.length, nBucket.length);

                    if (count > 0) {
                        upgradedReport.push(`\n## 📝 ${type} Internal Review`);
                        for (let i = 0; i < count; i++) {
                            const interaction = tBucket[i];
                            const note = nBucket[i];

                            upgradedReport.push(`\n---\n### 🗨️ ${type} - Interaction ${globalInteractionIdx++}`);
                            upgradedReport.push(`**Interviewer (AI):**\n${interaction?.q || "Follow-up question"}`);
                            if (interaction?.r) upgradedReport.push(`\n**Candidate Reply:**\n> ${interaction.r}`);
                            if (note) upgradedReport.push(`\n#### 🔍 AI Evaluation\n${note}`);
                            upgradedReport.push("\n---");
                        }
                    }
                }

                // 4. Capture Final Workspaces (avoiding duplicates)
                const capturedWorkspaces = new Set<string>();
                const finalSections = reportContent.split(/(?=FINAL (?:CODING|SYSTEM_DESIGN) WORKSPACE CAPTURE)/);
                for (const section of finalSections) {
                    if (section.startsWith('FINAL')) {
                        const cleanSection = section.trim();
                        if (!capturedWorkspaces.has(cleanSection)) {
                            upgradedReport.push("\n\n" + cleanSection);
                            capturedWorkspaces.add(cleanSection);
                        }
                    }
                }

                const finalMarkdown = upgradedReport.join('\n');

                // Save upgraded report
                await supabaseAdmin.storage
                    .from('assessment-data')
                    .upload(reportStoragePath, finalMarkdown, {
                        contentType: 'text/markdown',
                        upsert: true
                    });

                console.log(`[Finalize API] Bucket upgrade complete. MCQ: ${noteBuckets['Mcq'].length}, Conceptual: ${noteBuckets['Conceptual'].length}`);
            } catch (upgradeErr) {
                console.warn('[Finalize API] Bucket upgrade failed:', upgradeErr);
            }
        }

        // 4. Save synthesis back to Supabase Storage
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
