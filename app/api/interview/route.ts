import { NextRequest, NextResponse } from 'next/server';
import interviewData from '@/data/interview_config.json';

export async function POST(req: NextRequest) {
    try {
        // Read body once at the top
        const body = await req.json();
        const { messages, selectedJobId, type, summaries, round = 1, code, currentQuestion } = body;

        const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA3Ahw6Vu4V5FdLMMEdhuR1VTMDrQsjBTM";

        const selectedJob = interviewData.uber_roles.find((r) => r.id === selectedJobId);
        if (!selectedJob) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // 1. Instant Synthesis for Final Report
        if (type === 'feedback') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
            const synthesisPrompt = `
                You are a Senior Technical Recruiter at EPAM.
                Review these candidate micro-evaluation notes and provide a final verdict (Hired/Not Hired) and a quick overall summary.
                
                Round-by-Round Notes:
                ${summaries?.join('\n\n')}
                
                Format (Markdown):
                ## Final Verdict
                (Hired/Not Hired) - Reason
                ## Overall Summary
                (2 sentences)
            `;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
                    generationConfig: { maxOutputTokens: 512, temperature: 0.2 }
                })
            });
            const data = await res.json();
            return NextResponse.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Summary assembly complete.' });
        }

        // 2. Dynamic Code/Design Validation
        if (type === 'validate') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

            const validationPrompt = `
                You are a high-performance terminal diagnostic engine. Analyze the following candidate submission.
                
                Phase: ${round}
                Goal: Provide a concise, professional technical critique for a terminal output.
                Context: ${currentQuestion}
                Submission: ${code}
                
                RULES:
                1. Respond ONLY as a terminal (prefixed with '> ').
                2. Be technically accurate. If Code, check for complexity and edge cases. If System Design, check for scalability and SPOFs.
                3. End with "COMPILATION SUCCESSFUL" or "ARCHITECTURE VALIDATED".
            `;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: validationPrompt }] }],
                    generationConfig: { maxOutputTokens: 512, temperature: 0.1 }
                })
            });
            const data = await res.json();
            let validationText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!validationText) {
                return NextResponse.json({ text: "> Internal Diagnostics Error.\n> AI Engine returned null. Please re-run check." });
            }

            // Cleanup any markdown blocks if the AI tried to be smart
            validationText = validationText.replace(/```[a-z]*|```/gi, '').trim();
            return NextResponse.json({ text: validationText });
        }

        // 3. Chat Mode with High-Density Micro-Evaluations
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const roundNum = typeof round === 'string'
            ? (round === 'CONCEPTUAL' ? 1 : round === 'CODING' ? 2 : 3)
            : round;

        const roundPrompts = [
            `ROUND 1: CONCEPTUAL Q&A. Focus on high-level architecture and theory.`,
            `ROUND 2: PROBLEM SOLVING & CODING. Provide a medium-difficulty coding problem related to ${selectedJob.title}.`,
            `ROUND 3: SYSTEM DESIGN. Focus on scalability for Uber-scale systems.`
        ];

        const systemPrompt = `
          You are an EPAM Technical Interviewer for Uber. 
          Phase: ${roundPrompts[roundNum - 1]}
          Current Context (The Question/Task): ${currentQuestion || 'Setting context now.'}
          JD: ${selectedJob.title}, Level: ${selectedJob.level}.

          IMPORTANT: You must respond in a strict JSON format:
          {
            "text": "Conversational follow-up or next technical question",
            "candidateNote": "[Question Context] - [Assessment]. Specify gaps in complexity, edge cases, or architectural depth. Skip if this is a transition/start."
          }

          RULES:
          1. Be technically rigorous.
          2. The 'candidateNote' must be high-density (e.g., 'Identified O(N) but missed null-checks' or 'Architecture handles 10k RPS but has SPOF in DB').
          3. If the candidate hasn't answered yet (start of round), 'candidateNote' MUST be an empty string.
        `;

        const contents = messages.map((m: any) => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: typeof m.text === 'string' ? m.text : JSON.stringify(m.text) }]
        }));

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                system_instruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    maxOutputTokens: 2048,
                    temperature: 0.2
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            return NextResponse.json({
                text: "The technical engine encountered an error. Let's try to proceed. Can you tell me more about your experience?",
                candidateNote: ""
            });
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiResponse) {
            return NextResponse.json({
                text: "I didn't quite catch that. Could you please elaborate?",
                candidateNote: ""
            });
        }

        try {
            const parsed = JSON.parse(aiResponse);
            return NextResponse.json({
                text: parsed.text || aiResponse,
                candidateNote: parsed.candidateNote || ""
            });
        } catch (e) {
            return NextResponse.json({ text: aiResponse, candidateNote: "" });
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
