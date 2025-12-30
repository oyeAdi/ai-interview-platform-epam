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
            \${filteredCandidateReplies}
            
            ### ACTUAL IMPLEMENTATION EVALUATION
            The report contains a "FINAL WORKSPACE CAPTURE" section. You MUST evaluate the quality and correctness of the actual code or system design provided.
            
            Report Content:
            \${reportContent}

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
                    "score": 0-100,
                    "verdict": "Likely Human / Suspicious / Likely AI",
                    "reasoning": "Brief explanation focused only on the candidate's replies."
                },
                "overall_summary": "A 2-sentence executive summary...",
                "verdict": "Hired / Not Hired",
                "reason": "Brief reason..."
            }
        `;

        const { text } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);

        let cleanJson = text;
        if (text.includes('```json')) {
            cleanJson = text.split('```json')[1].split('```')[0].trim();
        } else if (text.includes('```')) {
            cleanJson = text.split('```')[1].split('```')[0].trim();
        }

        const summary = JSON.parse(cleanJson);

        // 3. Modular Reporting - Prepare to split
        let protocolToSplit = reportContent;

        // 4. Report Upgrade Logic (If legacy)
        if (!reportContent.includes('### 🗨️') && !transcriptDataRes.error) {
            try {
                console.log('[Finalize API] Starting bucket-based report upgrade...');
                const fullTranscript = JSON.parse(await transcriptDataRes.data.text());

                const noteBuckets: Record<string, string[]> = {
                    'Mcq': [],
                    'Conceptual': [],
                    'Coding': [],
                    'System Design': []
                };

                const noteRegex = /(Mcq|Conceptual|Coding|System [Dd]esign) - Note:\\s*([\\s\\S]*?)(?=\\n(?:Mcq|Conceptual|Coding|System [Dd]esign) - Note:|\\n###|\\nFINAL|$)/g;
                let match;
                while ((match = noteRegex.exec(reportContent)) !== null) {
                    const type = match[1];
                    const content = match[2].trim();
                    if (noteBuckets[type]) noteBuckets[type].push(content);
                }

                const transcriptBuckets: Record<string, { q: string, r: string }[]> = {
                    'Mcq': [],
                    'Conceptual': [],
                    'Coding': [],
                    'System Design': []
                };

                let currentBucket = 'Mcq';
                let lastQuestion = "Opening question";

                for (const msg of fullTranscript) {
                    if (msg.role === 'model') {
                        const lowText = msg.text.toLowerCase();
                        if (lowText.includes('conceptual discussion') || lowText.includes('shift gears into a more conceptual')) currentBucket = 'Conceptual';
                        else if (lowText.includes('coding assessment') || lowText.includes('practical coding')) currentBucket = 'Coding';
                        else if (lowText.includes('system design discussion') || lowText.includes('move into a system design')) currentBucket = 'System Design';
                        lastQuestion = msg.text;
                    } else if (msg.role === 'user') {
                        const isTrigger = /start the interview/i.test(msg.text) || (msg.text.length < 20 && /start/i.test(msg.text));
                        if (!isTrigger) transcriptBuckets[currentBucket].push({ q: lastQuestion, r: msg.text });
                    }
                }

                const upgradedReport = ["# 📋 Interview Protocol (Upgraded)\n"];
                const order = ['Mcq', 'Conceptual', 'Coding', 'System Design'];
                for (let roundIdx = 0; roundIdx < order.length; roundIdx++) {
                    const type = order[roundIdx];
                    const tBucket = transcriptBuckets[type];
                    const nBucket = noteBuckets[type];
                    const count = Math.max(tBucket.length, nBucket.length);

                    if (count > 0) {
                        upgradedReport.push(`\n## Round ${roundIdx}: ${type}`);
                        for (let i = 0; i < count; i++) {
                            const interaction = tBucket[i];
                            const note = nBucket[i];
                            upgradedReport.push(`- **Interviewer (AI):** ${interaction?.q || "Follow-up question"}`);
                            if (interaction?.r) upgradedReport.push(`- **Candidate Reply:** ${interaction.r}`);
                            if (note) {
                                const formattedNote = note.split('\n').map(l => `  ${l}`).join('\n');
                                upgradedReport.push(`- **AI Evaluation:** \n${formattedNote}`);
                            }
                            upgradedReport.push("");
                        }
                    }
                }

                const finalSections = reportContent.split(/(?=FINAL (?:CODING|SYSTEM_DESIGN) WORKSPACE CAPTURE)/);
                for (const section of finalSections) {
                    if (section.startsWith('FINAL')) upgradedReport.push("\n\n" + section.trim());
                }

                protocolToSplit = upgradedReport.join('\n');

                // Save upgraded consolidated report
                await supabaseAdmin.storage
                    .from('assessment-data')
                    .upload(reportStoragePath, protocolToSplit, {
                        contentType: 'text/markdown',
                        upsert: true
                    });
            } catch (err) {
                console.warn('[Finalize API] Upgrade failed', err);
            }
        }

        // 5. Modular Reporting: Split protocol into individual round files
        const rounds = protocolToSplit.split(/(?=\n## Round \d+:)/);
        for (let i = 0; i < rounds.length; i++) {
            const roundContent = rounds[i].trim();
            if (roundContent) {
                const roundMatch = roundContent.match(/## Round (\d+):/);
                const roundNum = roundMatch ? roundMatch[1] : i;
                const roundFileName = `sessions/${folder}/protocol_round_${roundNum}.md`;

                await supabaseAdmin.storage
                    .from('assessment-data')
                    .upload(roundFileName, roundContent, {
                        contentType: 'text/markdown',
                        upsert: true
                    });
            }
        }

        // 6. Generate Executive Summary Markdown
        const executiveSummaryMd = `
# 📈 Executive Summary: ${summary.overall_summary}

## 🎯 Verdict Panel
**STATUS:** ${summary.verdict === 'Hired' ? '✅ HIRED' : '❌ NOT HIRED'}
**REASON:** ${summary.reason}

---

## 🛡️ Integrity & Plagiarism Check
**Score:** ${summary.plagiarism_check.score}/100
**Verdict:** ${summary.plagiarism_check.verdict}
**Reasoning:** ${summary.plagiarism_check.reasoning}

---

## 📊 Evaluation Breakdown
- **Technical Skills:** ${summary.technical}
- **Behavioral Fit:** ${summary.behavioral}
- **Communication:** ${summary.communication}

### 🌟 Strengths
${summary.feedback.strengths.map((s: string) => `- ${s}`).join('\n')}

### 🚀 Areas for Improvement
${summary.feedback.improvements.map((i: string) => `- ${i}`).join('\n')}

---
*Generated by EPAM AI Diagnostic Engine*
`.trim();

        const execSummaryPath = `sessions/${folder}/executive_summary.md`;
        await supabaseAdmin.storage
            .from('assessment-data')
            .upload(execSummaryPath, executiveSummaryMd, {
                contentType: 'text/markdown',
                upsert: true
            });

        // 7. Save LLM synthesis JSON
        await supabaseAdmin.storage
            .from('assessment-data')
            .upload(finalStoragePath, JSON.stringify(summary, null, 2), {
                contentType: 'application/json',
                upsert: true
            });

        // 8. Update Session Record
        await supabaseAdmin
            .from('assessment_sessions')
            .update({ has_feedback: true })
            .eq('session_id', folder);

        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('Finalize Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
