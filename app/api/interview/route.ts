import { NextRequest, NextResponse } from 'next/server';
import interviewData from '@/data/interview_config.json';
import { LLMRouter } from '@/lib/llm-router';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // Read body once at the top
        const body = await req.json();
        const { messages, selectedJobId, type, summaries, round = 1, code, currentQuestion, customSkills } = body;

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
        }

        const selectedJob = interviewData.uber_roles.find((r) => r.id === selectedJobId);
        if (!selectedJob) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // 1. Generate Initial Skills for "Configure Interview"
        if (type === 'generate-skills') {
            const systemPrompt = "You are an expert Technical Recruiter. Your job is to extract key technical skills from job descriptions.";
            const userPrompt = `
                Analyze this Job Description:
                Title: ${selectedJob.title}
                Level: ${selectedJob.level}
                Description: ${selectedJob.description}
                Must Haves: ${selectedJob.must_have.join(', ')}

                Generate a list of 5-7 key technical skills or competencies to evaluate in an interview.
                Format: Returning ONLY a JSON array of strings. Example: ["React", "System Design", "Go"].
            `;

            let rawText = "[]";
            let debugError = null;
            let providerUsed = "none";

            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);
                console.log(`DEBUG: Skills generated via ${provider}`);
                providerUsed = provider;
                rawText = text || "[]";
            } catch (err: any) {
                console.error("Failed to generate skills via Router", err);
                debugError = err.message;
            }

            // Cleanup markdown if present
            rawText = rawText.replace(/```json|```/gi, '').trim();

            let skills = [];
            try {
                skills = JSON.parse(rawText);
                console.log("DEBUG: Generated Skills from AI:", skills);
            } catch (e) {
                console.error("Failed to parse skills JSON", rawText);
                skills = [];
            }

            // Return debug info if skills are empty
            if (skills.length === 0) {
                return NextResponse.json({
                    skills,
                    debug: {
                        rawText,
                        error: debugError,
                        provider: providerUsed
                    }
                });
            }

            return NextResponse.json({ skills });
        }

        // 2. Instant Synthesis for Final Report
        if (type === 'feedback') {
            const systemPrompt = "You are a Senior Technical Recruiter at EPAM. Provide a final hiring verdict based on technical notes.";
            const userPrompt = `
                Review these candidate micro-evaluation notes and provide a comprehensive final report.
                
                Round-by-Round Notes:
                ${summaries?.join('\n\n')}
                
                Format (Markdown):
                ## Technical Evaluation
                (Detailed assessment of technical skills, coding ability, and problem-solving)

                ## Behavioral Assessment
                (Assessment of soft skills, attitude, and cultural fit based on interactions)

                ## Communication
                (Clarity of thought, articulation, and interaction style)

                ## Feedback
                ### Strengths
                - (Bulleted list)
                ### Areas of Improvement
                - (Bulleted list)

                ## Final Verdict
                (Hired/Not Hired) - Brief Reason
            `;

            let report = "Summary generation failed.";
            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);
                console.log(`DEBUG: Feedback generated via ${provider}`);
                report = text || report;
            } catch (err) {
                console.error("Failed to generate feedback via Router", err);
            }
            return NextResponse.json({ text: report });
        }

        // 2. Dynamic Code/Design Validation
        if (type === 'validate') {
            const isSystemDesign = round === 'SYSTEM_DESIGN' || round === 3;

            const systemPrompt = isSystemDesign
                ? `You are a Principal Software Architect and System Validator.
                   RULES:
                   1. Respond ONLY in strict JSON format.
                   2. Analyze the design for scalability, reliability, and feasibility.
                   3. NO CODE SOLUTIONS. ONLY ARCHITECTURAL FEEDBACK.`
                : `You are a High-Performance Terminal Compiler & Diagnostic Engine.
                   RULES:
                   1. Respond ONLY in strict JSON format.
                   2. Be technically accurate.
                   3. NO CODE SOLUTIONS. ONLY COMPILER/RUNTIME FEEDBACK.`;

            const userPrompt = `
                Analyze the following candidate submission.
                Phase: ${isSystemDesign ? 'SYSTEM DESIGN' : 'CODING'}
                Context: ${currentQuestion}
                Submission: ${code}

                Task:
                1. "terminal_output": A concise, ${isSystemDesign ? 'architectural' : 'terminal-like'} status message (e.g., "Compiling...", "Verifying Schema...", "SUCCESS", "ERROR: O(n^2) detected").
                2. "detailed_analysis": A deep-dive technical breakdown in Markdown (Strengths, Weaknesses, Edge Cases). This is for the internal report.

                STRICT JSON FORMAT:
                {
                    "terminal_output": "> [Status Code] ...",
                    "detailed_analysis": "## Analysis..."
                }
            `;

            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);
                console.log(`DEBUG: Validation generated via ${provider}`);

                let cleanJson = text.replace(/```json|```/gi, '').trim();
                const parsed = JSON.parse(cleanJson);

                return NextResponse.json({
                    text: parsed.terminal_output || "> System validated.",
                    detailed_analysis: parsed.detailed_analysis || ""
                });

            } catch (err) {
                console.error("Failed to validate via Router", err);
                return NextResponse.json({
                    text: "> Internal Diagnostics Error.\n> AI Engine returned invalid format.",
                    detailed_analysis: ""
                });
            }
        }

        // 3. Chat Mode with High-Density Micro-Evaluations using LLMRouter

        const roundNum = typeof round === 'string'
            ? (round === 'CONCEPTUAL' ? 1 : round === 'CODING' ? 2 : 3)
            : round;

        const roundPrompts = [
            `ROUND 1: CONCEPTUAL Q&A. Focus on core CS concepts (e.g., HashMaps, Concurrency) and language internals. \n   - Prioritize skills: ${customSkills?.join(', ') || 'General'}.\n   - Rule: Max 2-3 follow-up questions per topic, then move on.`,
            `ROUND 2: CODING CHALLENGE. LeetCode Style.\n   - Task: Provide a Medium-Hard algorithm problem.\n   - Format required in response text:\n     **Title**\n     **Description**\n     **Example 1**\n     **Constraints**\n   - CRITICAL: You MUST provide a 'codeSnippet' field in the JSON with the starting boilerplate (e.g., class Solution).`,
            `ROUND 3: SYSTEM DESIGN. Ask for a High-Level Design (HLD) of a complex system (e.g., Scalable URL Shortener). DO NOT ask for code. Focus on components, databases, APIs, and scalability.`
        ];

        // Extract custom skills for context
        console.log("DEBUG: Received customSkills:", customSkills);

        const skillsContext = customSkills && customSkills.length > 0
            ? `PRIORITY SKILLS TO ASSESS: ${customSkills.join(', ')}.`
            : '';

        const systemPrompt = `
          You are an EPAM Technical Interviewer for Uber. 
          Phase: ${roundPrompts[roundNum - 1]}
          Current Context (The Question/Task): ${currentQuestion || 'Setting context now.'}
          JD: ${selectedJob.title}, Level: ${selectedJob.level}.
          ${skillsContext}

          IMPORTANT: You must respond in a strict JSON format:
          {
            "text": "The interview question or response formatted in Markdown",
            "candidateNote": "[Question Context] - [Assessment]. Specify gaps. Skip if start.",
            "codeSnippet": "class Solution { ... } // ONLY for Round 2 startup. String."
          }

          RULES:
          1. Be technically rigorous.
          2. The 'candidateNote' must be high-density.
          3. If the candidate hasn't answered yet (start of round), 'candidateNote' MUST be an empty string.
          4. IF ROUND 2: Force the user to solve the specific algorithm problem provided.
          5. IF ROUND 3: DO NOT ask for code implementation.
        `;

        // Combine messages into a single user prompt for the Router (simplified for HF/Google compatibility)
        const lastUserMessage = messages[messages.length - 1].text;
        const history = messages.slice(0, -1).map((m: any) => `${m.role}: ${m.text}`).join('\n');

        const fullUserPrompt = `
        conversation_history:
        ${history}
        
        candidate_latest_response:
        "${lastUserMessage}"
        
        Respond in JSON.
        `;

        let aiResponse;
        try {
            const { text, provider } = await LLMRouter.generate(systemPrompt, fullUserPrompt);
            console.log(`DEBUG: Response generated via ${provider}`);
            aiResponse = text;
        } catch (err: any) {
            console.error("LLM Router Failed:", err);
            return NextResponse.json({
                text: "The technical engine encountered a critical error. Let's start over.",
                candidateNote: ""
            });
        }

        if (!aiResponse) {
            return NextResponse.json({
                text: "I didn't quite catch that. Could you please elaborate?",
                candidateNote: ""
            });
        }

        // Strict JSON Clean-up
        let cleanJson = aiResponse;
        cleanJson = cleanJson.replace(/```json/gi, '').replace(/```/g, '').trim();

        try {
            const parsed = JSON.parse(cleanJson);
            return NextResponse.json({
                text: parsed.text || aiResponse,
                candidateNote: parsed.candidateNote || "",
                codeSnippet: parsed.codeSnippet || ""
            });
        } catch (e) {
            console.error("Failed to parse chat JSON:", cleanJson);
            // Fallback: If parsing fails, try to extract text property via regex if possible, 
            // or just return the raw text if it looks like a normal message.
            return NextResponse.json({ text: cleanJson, candidateNote: "" });
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
