import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { LLMRouter } from '@/lib/llm-router';

export const dynamic = 'force-dynamic';

// Helper function to detect role type from job data
const detectRoleTypeFromJob = (job: any): string => {
    const category = (job?.category || '').toLowerCase();
    const title = (job?.title || '').toLowerCase();
    const description = (job?.description || '').toLowerCase();

    if (category.includes('software') || category.includes('engineering') ||
        category.includes('developer') || title.includes('engineer') ||
        description.includes('backend') || description.includes('frontend') ||
        description.includes('fullstack')) {
        return 'TECHNICAL';
    }
    if (category.includes('business') || category.includes('sales') ||
        category.includes('marketing') || category.includes('finance') ||
        title.includes('analyst') || title.includes('manager')) {
        return 'BUSINESS';
    }
    if (category.includes('design') || category.includes('ux') ||
        category.includes('creative') || title.includes('designer')) {
        return 'CREATIVE';
    }
    if (category.includes('hr') || category.includes('human') ||
        category.includes('talent') || title.includes('recruiter')) {
        return 'HR';
    }
    if (category.includes('data') || category.includes('analytics') ||
        title.includes('data') || title.includes('analyst')) {
        return 'DATA';
    }
    if (category.includes('leadership') || category.includes('executive') ||
        title.includes('director') || title.includes('vp') ||
        title.includes('chief') || title.includes('head')) {
        return 'LEADERSHIP';
    }
    if (category.includes('operations') || category.includes('support') ||
        title.includes('operations') || title.includes('support')) {
        return 'OPERATIONAL';
    }
    return 'GENERAL';
};

// Helper to extract topics/questions from conversation history
const extractPreviousTopics = (messages: any[], roundNum: number): string[] => {
    const topics: string[] = [];

    messages.forEach((m: any) => {
        if (m.role === 'model' && m.text) {
            const text = m.text.trim();

            // Skip empty or very short messages
            if (text.length < 20) return;

            let topic = '';

            // Extract based on round type
            if (roundNum === 0) {
                // MCQ: Extract the actual question line (one with '?')
                const lines = text.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.includes('?') && !trimmed.startsWith('A)') && !trimmed.startsWith('B)') && !trimmed.startsWith('C)') && !trimmed.startsWith('D)')) {
                        topic = trimmed.replace(/^[\d\.\)\s]*/, '').split('?')[0] + '?';
                        break;
                    }
                }
                // Fallback to first line if no '?' found
                if (!topic) {
                    const firstLine = lines[0]?.trim() || text;
                    if (firstLine && !firstLine.startsWith('A)') && !firstLine.startsWith('B)')) {
                        topic = firstLine.replace(/^[\d\.\)\s]*/, '').split('?')[0] + '?';
                    }
                }
            } else if (roundNum === 1 || roundNum === 3) {
                // Conceptual/Design: Extract the main question
                const lines = text.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed &&
                        !trimmed.startsWith('[') &&
                        !trimmed.includes('SCORE:') &&
                        !trimmed.includes('TOPIC:') &&
                        !trimmed.includes('ANALYSIS:')) {
                        // Take first non-meta line as the question
                        topic = trimmed.split('?')[0] + '?';
                        break;
                    }
                }
            } else if (roundNum === 2) {
                // Coding/Case Study: Extract title or scenario
                const titleMatch = text.match(/(?:Title|Scenario):\s*(.*?)(?:\n|$)/i);
                if (titleMatch && titleMatch[1]) {
                    topic = titleMatch[1].trim();
                } else {
                    // Fallback: first line
                    const firstLine = text.split('\n')[0]?.trim();
                    if (firstLine && firstLine.length > 10) {
                        topic = firstLine;
                    }
                }
            }

            if (topic && topic.length > 10 && !topics.includes(topic.toLowerCase())) {
                topics.push(topic.toLowerCase());
            }
        }
    });

    return topics;
};

export async function POST(req: NextRequest) {
    let roleType = 'GENERAL';
    try {
        const body = await req.json();
        const {
            messages,
            selectedJobId,
            type,
            summaries,
            round = 1,
            code,
            currentQuestion,
            customSkills,
            customInstructions,
            codingFocusAreas,
            isNewRound,
            roundType, // V2 Dynamic Round Type
            roundContext, // V2 Dynamic Context
            previousRoundSummary, // Captured summary from frontend
            candidateName // Candidate Name
        } = body;

        if (!messages && type === 'chat') {
            return NextResponse.json({ error: 'Messages array is required for chat operations.' }, { status: 400 });
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
        }

        let selectedJob = null;
        if (selectedJobId) {
            const { data } = await supabaseAdmin.from('job_roles').select('*').eq('id', selectedJobId).single();
            selectedJob = data;
        }
        roleType = selectedJob ? detectRoleTypeFromJob(selectedJob) : 'GENERAL';

        // Define types that MUST have a job
        const jobRequiredTypes = ['generate-skills', 'chat', 'validate'];
        if (!selectedJob && jobRequiredTypes.includes(type)) {
            return NextResponse.json({ error: 'Job context is required for this operation.' }, { status: 404 });
        }

        // 1. Generate Initial Skills for "Configure Interview"
        if (type === 'generate-skills') {
            const systemPrompt = `You are an expert Recruiter and Hiring Specialist with expertise across all business domains.
            
            Your task is to extract key skills from job descriptions for any role type.
            
            CRITICAL GUIDELINES:
            1. Adapt skill extraction to the role type: ${roleType}
            2. Focus on measurable, interview-assessable skills
            3. Balance technical/hard skills with soft/business skills
            4. Consider the seniority level: ${selectedJob?.level || 'Not specified'}`;

            const userPrompt = `
                Analyze this Job Description and generate key skills for interview assessment:
                
                ROLE TYPE: ${roleType}
                Title: ${selectedJob?.title || 'Unknown Role'}
                Level: ${selectedJob?.level || 'Unknown Level'}
                Category: ${selectedJob?.category || 'Unknown'}
                Description: ${selectedJob?.description || 'N/A'}
                Must Haves: ${selectedJob?.must_have?.join(', ') || 'N/A'}
                
                Generate a list of 5-7 key skills or competencies to evaluate in an interview.
                
                SKILL GENERATION GUIDELINES BY ROLE TYPE:
                
                TECHNICAL ROLES:
                • Core programming languages/frameworks
                • System design/architecture principles
                • Algorithmic problem-solving
                • DevOps/Infrastructure knowledge
                • Testing methodologies
                
                BUSINESS ROLES:
                • Domain-specific knowledge
                • Analytical thinking
                • Stakeholder management
                • Business strategy
                • Data-driven decision making
                
                CREATIVE ROLES:
                • Design thinking
                • Technical tool proficiency
                • User/customer empathy
                • Visual communication
                • Creative problem-solving
                
                LEADERSHIP ROLES:
                • Strategic vision
                • Team development
                • Change management
                • Business acumen
                • Decision-making under pressure
                
                FORMAT: Returning ONLY a JSON array of strings. Example: ["React", "System Design", "Go"].
            `;

            let rawText = "[]";
            let debugError = null;
            let providerUsed = "none";

            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0);
                console.log(`DEBUG: Skills generated via ${provider} for ${roleType} role`);
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
                        provider: providerUsed,
                        roleType: roleType
                    }
                });
            }

            return NextResponse.json({
                skills,
                metadata: {
                    roleType,
                    level: selectedJob?.level || 'Unknown',
                    skillsCount: skills.length
                }
            });
        }

        // 1.5 Enhance Custom Instructions
        if (type === 'enhance-instruction') {
            console.log("LOG: [Enhance Instruction] Received instructions:", customInstructions);

            const systemPrompt = `You are an expert Recruiter and HR Specialist with experience across all business functions. 
            Your task is to structure hiring manager instructions for any role, department, or industry.
            
            CRITICAL GUIDELINES:
            1. Identify the role type from context (technical, business, creative, operational, leadership, etc.)
            2. Structure based on assessment components needed (skills, knowledge, behavior, case studies, etc.)
            3. Use appropriate terminology for the domain
            4. Maintain the manager's original intent while adding clarity
            5. For ambiguous cases, provide balanced assessment criteria`;

            const userPrompt = `
                HIRING MANAGER REQUEST: "${customInstructions}"
                
                Analyze this hiring request and rewrite it into structured interview configuration.
                
                OUTPUT FORMAT BY ROLE TYPE:
                
                TECHNICAL ROLES (Software, Data, Engineering):
                "For Technical Assessment: [Specify language/framework if mentioned]"
                "For System Design: [If architecture/scale mentioned]"
                "For Problem Solving: [Coding challenges or technical scenarios]"
                
                BUSINESS ROLES (Sales, Marketing, Finance, HR, Operations):
                "For Role-Specific Knowledge: [Domain expertise assessment]"
                "For Case Studies: [Business problem scenarios]"
                "For Behavioral Assessment: [Key competencies for the role]"
                
                CREATIVE ROLES (Design, Content, UX):
                "For Portfolio Review: [Specific creative skills to assess]"
                "For Creative Challenge: [Practical design/content exercise]"
                "For Collaboration Assessment: [Team/workflow evaluation]"
                
                LEADERSHIP ROLES (Management, Executive):
                "For Leadership Scenarios: [Management challenges]"
                "For Strategic Thinking: [Business strategy questions]"
                "For Team Assessment: [People leadership evaluation]"
                
                GENERAL ROLES OR UNSPECIFIED:
                "For Core Skills Assessment: [Primary skills to evaluate]"
                "For Situational Judgment: [Job-relevant scenarios]"
                "For Cultural Fit: [Team/organization alignment]"
                
                SPECIAL CASES:
                - For senior/principal roles: Add "For Expert-Level Depth: [Advanced topics]"
                - For junior/entry roles: Add "For Foundational Knowledge: [Basic concepts]"
                - For hybrid roles: Combine relevant sections from multiple categories
                
                ADAPTATION RULES:
                1. Extract specific technologies/tools if mentioned
                2. Identify soft skills requirements (communication, teamwork, etc.)
                3. Note any industry-specific requirements
                4. Flag critical must-have qualifications
                
                RETURN ONLY THE STRUCTURED CONFIGURATION. 
                No markdown, no quotes, no additional explanations.
                Use bullet points or numbered lines for clarity.
            `;

            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.3);
                console.log(`LOG: [Enhance Instruction] Success via ${provider}. Detected role type.`);

                // Clean up response while preserving structure
                const result = text.trim()
                    .replace(/^["']|["']$/g, '')
                    .replace(/```[\s\S]*?\n/g, '') // Remove code blocks
                    .replace(/^#+\s*/gm, '') // Remove markdown headers
                    .trim();

                return NextResponse.json({
                    enhancedText: result,
                    metadata: {
                        provider,
                        timestamp: new Date().toISOString(),
                        originalLength: customInstructions.length,
                        enhancedLength: result.length
                    }
                });
            } catch (err: any) {
                console.error("LOG: [Enhance Instruction] FAILED:", err.message);

                // Fallback: Provide a generic structure when enhancement fails
                const fallbackStructure = `For Core Skills Assessment: Evaluate based on provided requirements
For Situational Judgment: Role-specific scenarios
For Behavioral Questions: Competency-based assessment`;

                return NextResponse.json({
                    enhancedText: fallbackStructure,
                    error: err.message,
                    fallbackUsed: true
                });
            }
        }

        // 2. Feedback Generation
        if (type === 'feedback') {
            const systemPrompt = `You are a Senior Recruiter and Hiring Consultant specializing in comprehensive candidate assessment across all business domains.

            Your role is to analyze evaluation notes and provide a final hiring recommendation with detailed, evidence-based insights.
            
            CRITICAL GUIDELINES:
            1. Adapt assessment criteria to the role type: ${roleType}
            2. Base all assessments SOLELY on provided evaluation notes - no assumptions
            3. Use domain-appropriate terminology and evaluation metrics
            4. Provide specific, actionable feedback that hiring managers can use
            5. Flag data gaps transparently`;

            const userPrompt = `
                CANDIDATE EVALUATION ANALYSIS REQUEST
                
                ROLE TYPE: ${roleType}
                JOB TITLE: ${selectedJob?.title || 'Unknown'}
                SENIORITY LEVEL: ${selectedJob?.level || 'Not specified'}

                ### Example EVALUATION NOTES BY ROUND:
    
                **Round 0 (MCQ):** ${summaries?.[0] || 'No notes provided for MCQ round'}
    
                **Round 1 (Conceptual):** ${summaries?.[1] || 'No notes provided for Conceptual round'}
    
                **Round 2 (Coding/Case Study):** ${summaries?.[2] || 'No notes provided for Coding/Case Study round'}
    
                **Round 3 (Design/Strategy):** ${summaries?.[3] || 'Round naturally completed or merged with practical assessment.'}
                
                Round-by-Round Evaluation Notes:
                ${summaries?.filter((s: string) => s && s.trim().length > 0).join('\n\n') || 'No evaluation notes recorded.'}
                
                ROLE-SPECIFIC ASSESSMENT FRAMEWORKS:
                
                ${roleType === 'TECHNICAL' ? `
                TECHNICAL ROLES (Engineering, Data, IT):
                • Technical Competence (40% weight)
                • Problem-Solving (30% weight)
                • Communication (20% weight)
                • Collaboration (10% weight)` : ''}
                
                ${roleType === 'BUSINESS' ? `
                BUSINESS ROLES (Sales, Marketing, Finance):
                • Domain Expertise (35% weight)
                • Analytical Thinking (25% weight)
                • Communication (25% weight)
                • Business Acumen (15% weight)` : ''}
                
                ${roleType === 'CREATIVE' ? `
                CREATIVE ROLES (Design, Content, UX):
                • Creative Skills (40% weight)
                • User/Customer Focus (30% weight)
                • Collaboration (20% weight)
                • Technical Proficiency (10% weight)` : ''}
                
                ${roleType === 'LEADERSHIP' ? `
                LEADERSHIP ROLES (Management, Executive):
                • Strategic Vision (35% weight)
                • People Leadership (30% weight)
                • Decision Making (25% weight)
                • Business Results (10% weight)` : ''}
                
                ${roleType === 'OPERATIONAL' ? `
                OPERATIONAL ROLES (Support, Admin, Logistics):
                • Process Efficiency (40% weight)
                • Attention to Detail (30% weight)
                • Communication (20% weight)
                • Adaptability (10% weight)` : ''}
                
                ${['GENERAL', 'HR', 'DATA'].includes(roleType) ? `
                GENERAL/SPECIALIZED ROLES:
                • Core Competence (40% weight)
                • Role-Specific Skills (30% weight)
                • Communication (20% weight)
                • Adaptability (10% weight)` : ''}
                
                REQUIRED REPORT STRUCTURE:
                
                ## Executive Summary
                • Role Type: ${roleType}
                • Assessment Confidence: [High/Medium/Low based on data completeness]
                • Quick Recommendation: [Strong Hire/Hire/Borderline/No Hire/Insufficient Data]
                
                ## Detailed Assessment by Round
                
                ${Array.isArray(summaries) && summaries.length > 0 ?
                    summaries.map((_, index) => `### Round ${index + 1}\n[Evidence-based analysis]\n• Key Strengths Observed\n• Areas for Development\n• Data Quality: [Complete/Partial/Insufficient]`).join('\n\n')
                    : '### No round data available\nAssessment cannot be conducted without evaluation notes.'}
                
                ## Competency Matrix
                Create a table comparing candidate performance across key competencies.
                For each competency, provide:
                • Rating: [Exceptional/Strong/Moderate/Weak/Not Assessed]
                • Evidence: Specific examples from notes
                • Development Priority: [High/Medium/Low/Not Applicable]
                
                ## Risk Analysis
                ### Strengths (Value Drivers)
                • [List with impact explanation]
                
                ### Concerns & Mitigations
                • [List with risk level: High/Medium/Low]
                • [Suggested mitigation strategies]
                
                ## Comparative Assessment (if applicable)
                • How candidate compares to role requirements
                • How candidate compares to team/company standards
                • Market availability considerations
                
                ## Final Verdict & Next Steps
                
                ### Recommendation
                [STRONG HIRE / HIRE / BORDERLINE / NO HIRE / INCONCLUSIVE]
                
                ### Confidence Level: [90-100% / 75-89% / 50-74% / <50%]
                
                ### Primary Justification
                [2-3 sentence summary of key deciding factors]
                
                ### Recommended Actions
                1. [Immediate next step]
                2. [Follow-up actions if hired]
                3. [Development plan focus areas]
                
                ### Critical Considerations
                • [Any deal-breakers or exceptional factors]
                • [Onboarding requirements if hired]
                
                DATA INTEGRITY CHECK:
                • Missing Assessment Areas: [List rounds or competencies with insufficient data]
                • Evaluation Bias Indicators: [Note any potential biases in assessment]
                • Recommendation Confidence Impact: [How data gaps affect decision reliability]
                
                ---
                
                FORMATTING REQUIREMENTS:
                • Use clear headings and subheadings
                • Include bullet points for readability
                • Bold key terms and recommendations
                • Add section dividers for clarity
                • Ensure the report is scannable in 2 minutes
                
                CRITICAL: If a round has very limited data, provide a professional summary based on whatever interaction occurred. Do not use generic "Assessment Gap" warnings unless the round was literally blank.
                
                Return the complete structured report.`;

            let report = "## Report Generation Failed\nUnable to generate candidate assessment due to system error.";
            let metadata = {
                generationTime: new Date().toISOString(),
                roundsAnalyzed: summaries?.length || 0,
                roleType: roleType,
                jobTitle: selectedJob?.title || 'Unknown'
            };

            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.25);
                console.log(`DEBUG: Comprehensive feedback generated via ${provider}. Rounds processed: ${summaries?.length || 0}`);

                // Enhanced report with metadata header
                report = `# CANDIDATE ASSESSMENT REPORT\n*Generated: ${new Date().toLocaleString()}*\n*Role: ${roleType} - ${selectedJob?.title || 'Unknown'}*\n\n${text}`;

                // Add data completeness warning if insufficient data
                if (!summaries || summaries.length === 0) {
                    report += '\n\n---\n\n🚨 **CRITICAL WARNING**: This assessment was generated without any evaluation notes. The recommendation should be treated as a template only.';
                } else if (summaries.length < 3) {
                    report += '\n\n---\n\n⚠️ **PARTIAL DATA WARNING**: Assessment based on limited evaluation rounds. Consider additional interviews for confident decision-making.';
                }

            } catch (err) {
                console.error("Failed to generate comprehensive feedback:", err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                report = `## Assessment Report - Generation Failed\n\n### Error Details\n• Time: ${new Date().toLocaleString()}\n• Role: ${roleType}\n• Issue: ${errorMessage}\n\n### Recommended Action\nPlease regenerate the report or contact support if the issue persists.`;
            }

            return NextResponse.json({
                text: report,
                metadata: metadata,
                status: report.includes("Generation Failed") ? "error" : "success"
            });
        }

        // 3. Dynamic Code/Design Validation
        if (type === 'validate') {
            const isDesignRound = round === 'DESIGN' || round === 'STRATEGY' || round === 'SYSTEM_DESIGN' || round === 3;
            const isCodingRound = round === 'CODING' || round === 2;

            // Enhanced role type detection with context
            const detectValidationRoleType = () => {
                // First check custom instructions
                const text = (customInstructions || currentQuestion || '').toLowerCase();

                if (text.includes('system') || text.includes('architecture') ||
                    text.includes('scalability') || text.includes('api') ||
                    text.includes('database') || text.includes('microservices') ||
                    text.includes('backend') || text.includes('frontend')) {
                    return 'TECHNICAL_DESIGN';
                }
                if (text.includes('business') || text.includes('strategy') ||
                    text.includes('marketing') || text.includes('sales') ||
                    text.includes('operational') || text.includes('process') ||
                    text.includes('campaign') || text.includes('roi')) {
                    return 'BUSINESS_DESIGN';
                }
                if (text.includes('user') || text.includes('ux') || text.includes('ui') ||
                    text.includes('interface') || text.includes('wireframe') ||
                    text.includes('prototype') || text.includes('design system')) {
                    return 'UX_DESIGN';
                }
                if (text.includes('data') || text.includes('analytics') ||
                    text.includes('pipeline') || text.includes('warehouse') ||
                    text.includes('etl') || text.includes('model')) {
                    return 'DATA_DESIGN';
                }
                if (text.includes('leadership') || text.includes('management') ||
                    text.includes('team') || text.includes('stakeholder') ||
                    text.includes('strategy') || text.includes('vision')) {
                    return 'STRATEGY_DESIGN';
                }

                // Fallback to detected role type from job
                return `${roleType}_DESIGN`.toUpperCase();
            };

            const validationRoleType = detectValidationRoleType();
            const roleTypeForPrompt = roleType || 'GENERAL';

            let systemPrompt = '';
            let validationType = '';

            if (isDesignRound) {
                validationType = 'DESIGN_VALIDATION';

                const roleSpecificPrompts: Record<string, string> = {
                    TECHNICAL_DESIGN: `You are a Principal Software Architect and System Design Validator.
                        RULES:
                        1. Respond ONLY in strict JSON format.
                        2. Evaluate: Scalability, Reliability, Cost Optimization, Security, and Maintainability.
                        3. Consider: Tech stack appropriateness, data flow, API design, and failure handling.
                        4. NO CODE SOLUTIONS. Only architectural feedback and design patterns.
                        5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'Technical Role'}
                        ${customInstructions ? `\nDesign Requirements: ${customInstructions}` : ''}`,

                    BUSINESS_DESIGN: `You are a Senior Business Strategist and Process Architect.
                        RULES:
                        1. Respond ONLY in strict JSON format.
                        2. Evaluate: Business impact, ROI feasibility, stakeholder alignment, and risk management.
                        3. Consider: Market fit, competitive advantage, operational workflow, and measurement metrics.
                        4. NO VAGUE FEEDBACK. Be specific about business value and implementation risks.
                        5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'Business Role'}
                        ${customInstructions ? `\nBusiness Requirements: ${customInstructions}` : ''}`,

                    UX_DESIGN: `You are a Lead UX Architect and Design System Specialist.
                        RULES:
                        1. Respond ONLY in strict JSON format.
                        2. Evaluate: User journey, accessibility, information architecture, and design consistency.
                        3. Consider: Usability heuristics, prototyping fidelity, and user research alignment.
                        4. NO SUBJECTIVE OPINIONS. Base feedback on established UX principles.
                        5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'Design Role'}
                        ${customInstructions ? `\nUX Requirements: ${customInstructions}` : ''}`,

                    DATA_DESIGN: `You are a Chief Data Architect and Analytics Validator.
                        RULES:
                        1. Respond ONLY in strict JSON format.
                        2. Evaluate: Data modeling, pipeline efficiency, query optimization, and governance.
                        3. Consider: ETL processes, storage solutions, real-time vs batch processing, and data quality.
                        4. NO BASIC FEEDBACK. Focus on scalability and analytical capabilities.
                        5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'Data Role'}
                        ${customInstructions ? `\nData Requirements: ${customInstructions}` : ''}`,

                    STRATEGY_DESIGN: `You are an Executive Strategy Advisor and Leadership Coach.
                        RULES:
                        1. Respond ONLY in strict JSON format.
                        2. Evaluate: Strategic alignment, leadership impact, team dynamics, and change management.
                        3. Consider: Vision articulation, execution roadmap, stakeholder management, and success metrics.
                        4. NO GENERIC ADVICE. Provide actionable strategic insights.
                        5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'Leadership Role'}
                        ${customInstructions ? `\nStrategic Requirements: ${customInstructions}` : ''}`,

                    GENERAL_DESIGN: `You are a Senior Solution Architect and Design Thinking Expert.
                        RULES:
                        1. Respond ONLY in strict JSON format.
                        2. Evaluate: Problem-solving approach, innovation, practicality, and completeness.
                        3. Consider: Requirements coverage, alternative solutions, and implementation constraints.
                        4. PROVIDE STRUCTURED FEEDBACK. Use clear evaluation criteria.
                        5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'General Role'}
                        ${customInstructions ? `\nDesign Requirements: ${customInstructions}` : ''}`
                };

                systemPrompt = roleSpecificPrompts[validationRoleType] || roleSpecificPrompts.GENERAL_DESIGN;

            } else if (isCodingRound) {
                validationType = 'CODING_VALIDATION';
                systemPrompt = `You are a High-Performance Terminal Compiler & Diagnostic Engine.
                    RULES:
                    1. Respond ONLY in strict JSON format.
                    2. Be technically accurate and language/framework aware.
                    3. Evaluate: Code quality, efficiency, correctness, and best practices.
                    4. NO CODE SOLUTIONS. Only compiler/runtime feedback and improvements.
                    5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'Technical Role'}
                    ${customInstructions ? `\nCoding Requirements: ${customInstructions}` : ''}`;

            } else {
                // For MCQ or conceptual rounds
                validationType = 'CONCEPT_VALIDATION';
                systemPrompt = `You are a Senior ${roleTypeForPrompt} Validator.
                    RULES:
                    1. Respond ONLY in strict JSON format.
                    2. Evaluate: Conceptual understanding, accuracy, and depth of knowledge.
                    3. Consider: Real-world application, common misconceptions, and advanced concepts.
                    4. PROVIDE CORRECTIVE FEEDBACK. Highlight gaps and misunderstandings.
                    5. Role Context: ${roleTypeForPrompt} - ${selectedJob?.title || 'General Role'}
                    ${customInstructions ? `\nValidation Criteria: ${customInstructions}` : ''}`;
            }

            const userPrompt = `
                Analyze the following candidate submission for ${selectedJob?.title || 'the position'}.
                
                VALIDATION TYPE: ${validationType}
                ROLE CATEGORY: ${validationRoleType.replace('_', ' ')}
                CONTEXT: ${currentQuestion || 'No specific context provided'}
                CUSTOM REQUIREMENTS: ${customInstructions || 'None specified'}
                
                CANDIDATE SUBMISSION:
                ${code || 'No submission provided'}

                TASK: Generate a comprehensive validation report in strict JSON format.

                CRITICAL VALIDATION RULES FOR CODING:
                1. **EMPTY IMPLEMENTATION CHECK**: If the code contains only boilerplate (e.g., empty function bodies, TODO comments, pass statements, return 0/null), terminal_output MUST be "❌ Implementation incomplete"
                2. **SYNTAX ERROR CHECK**: If there are syntax errors, missing brackets, undefined variables, or compilation issues, terminal_output MUST be "❌ Compilation failed: [specific error]"
                3. **LOGIC CHECK**: Only if code is complete AND compiles, then evaluate logic correctness
                4. **SUCCESS CRITERIA**: terminal_output can only be "✅ Code compiled successfully" if:
                   - All functions/methods have actual implementation (not just TODO/return 0/return null)
                   - No syntax errors
                   - No undefined variables or missing imports
                   - Code structure is complete

                REQUIRED JSON STRUCTURE:
                {
                    "terminal_output": "MUST be one of: '❌ Implementation incomplete' | '❌ Compilation failed: [error]' | '❌ Logic error: [issue]' | '✅ Code compiled successfully'. For design: '✅ Design validated' or '⚠️ Architecture review needed'",
                    
                    "detailed_analysis": "A comprehensive markdown analysis with the following sections:\n1. ## Executive Summary\n2. ## Completeness Check (Is code fully implemented?)\n3. ## Syntax & Compilation Status\n4. ## Logic & Correctness Analysis\n5. ## Strengths & Highlights\n6. ## Critical Issues & Risks\n7. ## Recommendations for Improvement\n8. ## Overall Assessment Score (1-10)",
                    
                    "validation_metrics": {
                        "completeness": "0-100 (0 if only boilerplate, 100 if fully implemented)",
                        "correctness": "0-100 (0 if syntax errors, score logic if compiles)",
                        "innovation": "0-100",
                        "practicality": "0-100",
                        "overall_score": "0-10 (MUST be 0 if incomplete or has syntax errors)"
                    },
                    
                    "role_specific_feedback": "Targeted feedback for ${validationRoleType.replace('_', ' ')} role",
                    
                    "next_steps_recommendation": "Specific action items for hiring team"
                }

                IMPORTANT GUIDELINES:
                1. ONLY mark as incomplete if code is CLEARLY boilerplate (empty methods, TODO comments, placeholder returns)
                2. If a function has actual logic (loops, conditionals, string manipulation, etc.), it is NOT incomplete
                3. Detect common empty patterns: "TODO", "return 0;", "return null;", "pass", "throw new Error('Not implemented')"
                4. For design rounds, focus on architecture/strategy, not implementation details
                5. For coding rounds, FIRST check completeness, THEN check syntax, THEN evaluate logic
                6. Be constructive but HONEST - if code has real implementation, acknowledge it even if logic might be imperfect
                7. Use role-appropriate terminology and evaluation criteria
                8. CRITICAL: A complete implementation with potential logic issues is BETTER than marking it incomplete
            `;

            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.2);
                console.log(`DEBUG: ${validationType} generated via ${provider} for ${validationRoleType}`);

                let cleanJson = text;
                // Robust extraction: find the first { and the last }
                const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanJson = jsonMatch[0];
                }

                const parsed = JSON.parse(cleanJson);

                return NextResponse.json({
                    text: parsed.terminal_output || `> ${validationType} completed`,
                    detailed_analysis: parsed.detailed_analysis || "## No detailed analysis available",
                    metrics: parsed.validation_metrics || {
                        completeness: 0,
                        correctness: 0,
                        innovation: 0,
                        practicality: 0,
                        overall_score: 0
                    },
                    role_type: validationRoleType,
                    validation_type: validationType,
                    metadata: {
                        generated_at: new Date().toISOString(),
                        provider: provider,
                        submission_length: (code || '').length,
                        job_title: selectedJob?.title || 'Unknown'
                    }
                });

            } catch (err) {
                console.error(`Failed to validate via Router for ${validationRoleType}`, err);

                // Fallback responses based on role type
                const fallbackResponses: Record<string, { text: string, detailed_analysis: string }> = {
                    TECHNICAL_DESIGN: {
                        text: "> ⚠️ System Design Validation Error\n> Architecture review system unavailable",
                        detailed_analysis: "## Validation System Error\nTechnical design validation could not be completed due to system issues."
                    },
                    BUSINESS_DESIGN: {
                        text: "> ⚠️ Business Strategy Validation Error\n> Strategic analysis system unavailable",
                        detailed_analysis: "## Validation System Error\nBusiness design validation could not be completed due to system issues."
                    },
                    UX_DESIGN: {
                        text: "> ⚠️ UX Design Validation Error\n> Design review system unavailable",
                        detailed_analysis: "## Validation System Error\nUX design validation could not be completed due to system issues."
                    },
                    DATA_DESIGN: {
                        text: "> ⚠️ Data Architecture Validation Error\n> Data design review system unavailable",
                        detailed_analysis: "## Validation System Error\nData design validation could not be completed due to system issues."
                    },
                    default: {
                        text: "> ❌ Validation Error\n> AI Engine returned invalid format",
                        detailed_analysis: "## System Error\nUnable to generate validation report. Please try again."
                    }
                };

                const fallback = fallbackResponses[validationRoleType] || fallbackResponses.default;
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';

                return NextResponse.json({
                    ...fallback,
                    metrics: {
                        completeness: 0,
                        correctness: 0,
                        innovation: 0,
                        practicality: 0,
                        overall_score: 0
                    },
                    role_type: validationRoleType,
                    validation_type: validationType,
                    error: errorMessage,
                    fallback_used: true
                });
            }
        }

        // 4. Chat Mode - THE MAIN FIX IS HERE
        const roundNum = typeof round === 'string'
            ? (round === 'MCQ' ? 0 : round === 'CONCEPTUAL' ? 1 : round === 'CODING' ? 2 : 3)
            : round;

        // Construct summary context from previous rounds
        let summariesContext = Object.entries(summaries || {})
            .filter(([key, notes]) => (notes as string[]).length > 0 && key !== round)
            .map(([roundKey, notes]) => {
                const roundTitle = roundKey.charAt(0) + roundKey.slice(1).toLowerCase().replace('_', ' ');
                return `### PREVIOUS ROUND INSIGHTS: ${roundTitle}\n${(notes as string[]).slice(-5).join('\n')}`; // Keep last 5 notes per round for brevity
            })
            .join('\n\n');

        // Append the explicit previous round summary if provided (V2 context)
        if (previousRoundSummary) {
            summariesContext = `### PREVIOUS ROUND SUMMARY:\n${previousRoundSummary}\n\n${summariesContext}`;
        }

        // Context Trimming: If it's a new round, prune history to avoid "brain fog"
        let processedMessages = messages;
        if (isNewRound && messages.length > 3) {
            // Keep the very first message (start intent) and the last 2 (transition context)
            processedMessages = [messages[0], ...messages.slice(-2)];
        }

        // Extract previous topics/questions from conversation history (do this BEFORE trimming for full coverage)
        const previousTopics = extractPreviousTopics(messages, roundNum);
        console.log(`DEBUG: Previous topics for round ${roundNum}:`, previousTopics);

        // Custom Instructions Injection
        const globalInstruction = customInstructions
            ? `### CRITICAL: GLOBAL DM INSTRUCTIONS (HIGHEST PRIORITY)
               "${customInstructions}"
               \nRULE: You MUST follow these instructions above all others. If there is a conflict, these win.`
            : '';

        // V2 DYNAMIC ROUND CONTEXT - ABSOLUTE PRIORITY
        const dynamicRoundInstruction = roundContext
            ? `\n### ⚠️ CRITICAL: DYNAMIC ROUND INSTRUCTION (V2 CONFIG) - ABSOLUTE PRIORITY ⚠️
               "${roundContext}"
               
               STRICT ENFORCEMENT RULES:
               1. This instruction has ABSOLUTE PRIORITY over all other instructions
               2. You MUST act ONLY as this persona/instruction describes
               3. DO NOT ask questions outside the scope of this round type
               4. DO NOT mix behavioral, technical, or other question types unless explicitly stated in this instruction
               5. If this is a SYSTEM_DESIGN round, ask ONLY system design questions
               6. If this is a CODING round, ask ONLY coding/algorithm questions
               7. If this is a BEHAVIORAL round, ask ONLY behavioral questions
               
               VIOLATION CONSEQUENCES:
               - Asking off-topic questions is a CRITICAL ERROR
               - Stay strictly within the boundaries defined by this round context
               - When in doubt, refer back to this instruction`
            : '';

        // Role-specific adaptations
        const getRoleSpecificAdaptations = () => {
            switch (roleType) {
                case 'TECHNICAL':
                    return `
                    • Focus on technical depth, algorithmic thinking, and system architecture
                    • Coding problems should be algorithmically challenging
                    • Design questions should be scalable system design`;

                case 'BUSINESS':
                    return `
                    • Focus on business strategy, market analysis, and ROI calculations
                    • Case studies should be business problem-solving oriented
                    • Design questions should be business process or strategy design`;

                case 'CREATIVE':
                    return `
                    • Focus on design thinking, user empathy, and creative problem-solving
                    • Portfolio review and design critique emphasis
                    • Design questions should be UX/UI or creative strategy`;

                case 'LEADERSHIP':
                    return `
                    • Focus on strategic vision, team management, and decision-making
                    • Scenario-based leadership challenges
                    • Design questions should be organizational or strategic design`;

                default:
                    return `
                    • Focus on core competencies and role-specific knowledge
                    • Adapt questioning to the specific domain`;
            }
        };

        const ROUND_GUARDIANS = [
            // Round 0: MCQ - Universal for all roles
            `### ROUND 0 GUARDIAN: MCQ ENFORCER
             
             CRITICAL MCQ BEHAVIOR:
             - You are a question-asking machine in Round 0
             - EVERY response = ONE new MCQ question
             - Do NOT acknowledge answers (correct or incorrect)
             - Do NOT provide explanations or feedback
             - Do NOT say "ok", "sure", "let's continue", or any filler
             - Backend handles all scoring and feedback
             
             STRICT RULES:
             1. MANDATORY FORMAT: Your 'text' field must contain exactly 4 options (A, B, C, D)
             2. ROLE-ADAPTIVE: Questions must be relevant to ${roleType} role: ${selectedJob?.title || 'Unknown'}
             3. NO REPEATS: NEVER ask about topics already covered
             4. FORBIDDEN TOPICS: ${JSON.stringify(previousTopics).slice(0, 500)}... DO NOT ASK ABOUT THESE
             5. EVALUATE PREVIOUS: You MUST evaluate the candidate's last answer (A/B/C/D) in the 'candidateNote' field.
             6. IGNORE USER INPUT CONTENT: Whether they answer A, B, C, D, or anything else - just ask the next question but SCORE the last one correctly.
             
             RESPONSE FORMAT:
             {
               "text": "Your new MCQ question here\\n\\nA) Option 1\\nB) Option 2\\nC) Option 3\\nD) Option 4",
               "score": 0, // MUST BE 10 if last answer was correct, 0 if wrong
               "candidateNote": "[SCORE: X/10] | [TOPIC: Question Topic] | [ANALYSIS: Statement on why they were correct/incorrect]",
               "codeSnippet": ""
             }
             
             YOUR ONLY JOB: Generate the JSON above with a new, unique MCQ question in the 'text' field.`,

            // Round 1: Conceptual - Role-adaptive
            `### ROUND 1 GUARDIAN: CONCEPTUAL ENFORCER
             1. NO CODE/SCRIPTS: Do not ask the candidate to write code.
             2. NO MCQ: Do not provide A/B/C/D options.
             3. NO REPEATS: Do not ask about topics already discussed in this round.
             4. ROLE-ADAPTIVE DEPTH: For ${roleType} roles, focus on appropriate domain concepts
             5. DEPTH: Focus on mental models and 'How it works' rather than implementation details.
             6. FOLLOW-UP LIMIT: Ask a maximum of 2-3 follow-up questions per topic, then MOVE ON to a new topic.
             7. TOPIC TRANSITION: After 2-3 exchanges on one concept, explicitly transition to a different area.
             8. BREADTH OVER DEPTH: Cover multiple topics rather than drilling endlessly into one.`,

            // Round 2: Coding - Only for technical roles, case studies for others
            `### ROUND 2 GUARDIAN: PRACTICAL ENFORCER
             1. LOCAL IDE FLOW: The candidate is now using their local IDE.
             2. BOILERPLATE: You MUST still provide a Title, Description, Examples, Constraints, and starter code (in 'codeSnippet').
             3. CHAT SUBMISSION: Candidates will paste their code back into the chat.
             4. DRY RUN VALIDATION: When the candidate submits code in the chat, you MUST perform a line-by-line mental dry run.
             5. REPORTING: Inform the candidate of the execution results (e.g., "I've reviewed your code; it logic is sound and handles the constraints well" or "I noticed a potential syntax error in your loop").
             6. NEXT CHALLENGE TRIGGER: If the user says "NEXT CHALLENGE", you MUST provide a BRAND NEW ${roleType === 'TECHNICAL' ? 'coding problem' : 'case study'} with full format. DO NOT ask follow-up questions about the previous problem.`,

            // Round 3: Design/Strategy - Universal but role-adaptive
            `### ROUND 3 GUARDIAN: DESIGN/STRATEGY ENFORCER
             1. ARTIFACT SUBMISSION: The candidate solves this in their local environment/design tools and submits the description/logic in the chat.
             2. VALIDATION: Perform a thorough "Dry Run" of their architecture/strategy. Check for scalability, trade-offs, and requirement coverage.
             3. INTERACTION: Acknowledge their submitted artifact and dive deep into specific design decisions.`
        ];

        const roundPrompts = [
            // Round 0: MCQ - Universal
            `ROUND 0: RAPID FIRE MCQ.
             - Goal: Validate foundational knowledge for ${roleType} role.
             - Format: Ask ONE multiple choice question with 4 options (A, B, C, D).
             - CONTEXT: Role: ${selectedJob?.title || 'Unknown'}, Level: ${selectedJob?.level || 'Unknown'}
             - MANDATORY: YOU MUST PROVIDE OPTIONS A, B, C, D IN EVERY RESPONSE.
             - CRITICAL: You MUST remember what you've already asked. NEVER repeat questions.
             - TOPIC ROTATION: Rotate through different skill areas:
               ${roleType === 'TECHNICAL' ? '1. Algorithms & Data Structures\n2. System Design\n3. Programming Languages\n4. Software Engineering Principles\n5. Databases & Networking' :
                roleType === 'BUSINESS' ? '1. Business Strategy\n2. Market Analysis\n3. Financial Concepts\n4. Stakeholder Management\n5. Operational Excellence' :
                    roleType === 'CREATIVE' ? '1. Design Principles\n2. User Research\n3. Visual Design\n4. Design Tools\n5. Creative Strategy' :
                        '1. Role Fundamentals\n2. Industry Knowledge\n3. Best Practices\n4. Problem Solving\n5. Communication Skills'}
             - RULE: If the candidate provides an answer (A, B, C, or D) OR asks to "move on", "proceed", or "next question", MOVE TO A NEW, DIFFERENT QUESTION immediately.
             - INVALID INPUT RULE: If the candidate's last response is NOT 'A', 'B', 'C', or 'D' AND is NOT a request to proceed, REPEAT the current question with its options and ask for a valid choice.
             - NO ACKNOWLEDGMENTS: DO NOT say "ok", "next question", or "moving on". Start the message DIRECTLY with the new question.
             - STICKINESS: NEVER ask an open-ended question in this round. ALWAYS provide options.
             - INSTRUCTION: Validate the answer implicitly in 'candidateNote'. DO NOT discuss the previous answer in 'text'.
             - FLOW: [User Answer A-D / Proceed Intent] -> [NEW Different Question + Options] | [User Invalid] -> [Error + Same Question + Options].
             - SCORING: If the candidate's last answer was correct, SCORE MUST BE 10. If incorrect or skipped, SCORE MUST BE 0.
             ${customSkills && customSkills.length > 0 ? `- SKILL FOCUS: Questions MUST be about: ${customSkills.join(', ')}` : ''}`,

            // Round 1: Conceptual - Role-adaptive
            `ROUND 1: CONCEPTUAL DEEP DIVE.
             - Goal: Deep understanding of core competencies for ${roleType} role.
             - Persona: Expert Interviewer probing depth of knowledge.
             - Rule: MAXIMUM 2-3 follow-up questions per topic, then MUST move to new area.
             - CONTEXT: Focus on ${roleType}-specific concepts and principles.
             - CRITICAL: Remember what topics you've already covered. DO NOT repeat them.
             - PROGRESSION: Start broad, then go deep. Ask "why" and "how" questions.
             - NEGATIVE CONSTRAINT: DO NOT provide multiple choice options. DO NOT ask for code.
             - MANDATORY TRANSITION: After 2-3 exchanges on one concept, you MUST say "Let's shift to a different area" and switch topics.
             - BREADTH FIRST: Cover 4-5 different topics rather than exhausting one topic.
             - CORRECTION: Gently correct misconceptions, but focus on understanding their thought process.
             ${customSkills && customSkills.length > 0 ? `- MANDATORY SKILL FOCUS: All questions MUST relate to: ${customSkills.join(', ')}` : ''}`,

            // Round 2: Coding or Case Study based on role
            roleType === 'TECHNICAL'
                ? `ROUND 2: PRACTICAL CODING ASSESSMENT.
             - Persona: Technical Evaluator.
             - FLOW: Lead the candidate through personal IDE coding.
             - SUBMISSION: Candidate will paste code in chat. 
             - VALIDATION: You MUST check the submitted code for:
               1. Strict adherence to the provided boilerplate.
               2. Logical correctness (perform a line-by-line dry run).
               3. Time/Space efficiency and Edge cases.
             - FEEDBACK: Report the results of your dry run back to the candidate immediately.
             ${customSkills && customSkills.length > 0 ? `- MANDATORY: Problem and code MUST use: ${customSkills.join(', ')}` : ''}`
                : `ROUND 2: PRACTICAL CASE STUDY ASSESSMENT.
             - Goal: Evaluate analytical thinking.
             - SUBMISSION: Candidate will paste their strategy/artifacts in chat.
             - VALIDATION: Critique the analytical depth and assumptions. Engage in dialogue.`,

            // Round 3: Design/Strategy - Universal but role-adaptive
            `ROUND 3: ${roleType === 'TECHNICAL' ? 'SYSTEM ARCHITECTURE' : 'STRATEGIC THINKING'} ASSESSMENT.
             - Goal: Evaluate ${roleType === 'TECHNICAL' ? 'system design' : 'strategic problem-solving'} skills.
             - Persona: ${roleType === 'TECHNICAL' ? 'Principal Architect' : 'Senior Strategist'} assessing high-level thinking.
             - Format: Interactive design discussion starting with a clear problem statement.
             - PROBLEM: ${roleType === 'TECHNICAL' ? 'Present a scalable system design challenge (e.g., "Design Twitter", "Design Uber")' :
                'Present a complex business/strategic challenge (e.g., "How would you enter a new market?", "Optimize a business process")'}
             - CRITICAL: This is ONE design discussion, not multiple problems.
             - PROCESS: Guide through: Requirements → High-level Design → Components → Trade-offs → Scaling.
             - DEPTH: Go deep into 2-3 aspects rather than covering everything superficially.
             - INTERACTION: Ask clarifying questions, challenge assumptions, discuss alternatives.
             - TIME: This is a single extended discussion, not multiple quick questions.`
        ];

        // Extract custom skills for context
        console.log("DEBUG: Received customSkills:", customSkills);

        const skillsContext = customSkills && customSkills.length > 0
            ? `
### MANDATORY SKILL FOCUS (HIGHEST PRIORITY)
The hiring manager has specified these EXACT skills to assess: ${customSkills.join(', ')}

CRITICAL RULES:
- ALL questions in ALL rounds MUST focus on these skills
- Round 0 (MCQ): Questions must test knowledge of these specific technologies/skills
- Round 1 (Conceptual): Deep dive into concepts related to these skills
- Round 2 (Coding): Problems must use these specific languages/frameworks
- Round 3 (Design): System design must incorporate these technologies

DO NOT ask about skills outside this list unless absolutely necessary for context.`
            : '';

        // Disable explicit topic banning from current chat to allow depth (especially for System Design)
        // The messages history already prevents verbatim repetition.
        const conversationMemory = '';

        // Role-specific system prompt
        const systemPrompt = `
          ${dynamicRoundInstruction}
          ${globalInstruction}
          
          You are Alex, an EPAM ${roleType} Interviewer conducting a real interview with ${candidateName || 'the candidate'}.
          
          YOUR PERSONA:
          - Name: Alex
          - Team: EPAM Engineering Team (aligned with ${selectedJob?.title || 'the role'})
          - Tone: Professional, warm, and direct.
          
          CRITICAL OUTPUT RULE: NEVER use placeholders like "[Your Name]", "[Team Name]", or "[Insert Date]". ALWAYS invent a plausible detail or use the defaults provided above.
          
          ROLE TYPE: ${roleType}
          JOB TITLE: ${selectedJob?.title || 'Unknown Position'}
          SENIORITY: ${selectedJob?.level || 'Not Specified'}
          
          ${conversationMemory}
          
          current_phase_instruction: ${roundContext ? "STRICTLY FOLLOW DYNAMIC ROUND INSTRUCTION ABOVE." : (roundPrompts[roundNum] || roundPrompts[1])}
          
          INTERVIEW FLOW RULES:
          1. REAL INTERVIEW SIMULATION: Act like a human interviewer who remembers the current and PREVIOUS conversation.
          2. NO REPETITION: Never ask the same question or discuss the same topic twice (checking memory first).
          3. TOPIC MANAGEMENT: Start with basics. STRICTLY LIMIT follow-up questions to MAX 2-3 per topic. Move to the next skill requirement after that.
          4. NATURAL TRANSITIONS: Move between topics naturally. AVOID robotic phrases like "Let's switch gears" or "Okay, moving on". Instead, weave the next topic into the previous answer (e.g., "That approach to concurrency is interesting. How would that scale if...").
          5. ACTIVE LISTENING: Build on the candidate's responses.
          6. PERSONALITY: Be warm, professional, and conversational. Use the candidate's name. Acknowledge their insights before challenging them.
          
          ${skillsContext}
          
          ${isNewRound ? `
          ### NEW ROUND STARTING
          ${!previousRoundSummary ?
                    `- THIS IS THE START OF THE INTERVIEW.
             - Welcome ${candidateName || 'the candidate'} professionally.
             - DO NOT say "Let's shift focus" or "Switching gears" as there is nothing prior.
             - Start directly with the first question.`
                    :
                    `- This is a fresh round with new objectives.
             - Reset your mental context for this round type.`}
          - Start with an appropriate opening question/statement.
          - CRITICAL: DO NOT start with "Let's switch gears", "Let's shift our focus", or "Moving on". BE NATURAL. Instead, state the new topic directly (e.g., "Let's look at [topic] now").` : ''}

          ${summariesContext ? `
### READ-ONLY CONTEXT FROM PREVIOUS ROUNDS:
(Use this strictly for background knowledge. DO NOT REVISIT these topics effectively unless the CURRENT round explicitly requires connecting back to them.)
${summariesContext}
        ` : ''}

          ### REAL INTERVIEW BEHAVIOR:
          - Remember what has been discussed (use the summaries above as background context only)
          - Build upon previous answers ONLY if relevant to the CURRENT round type
          - Ask follow-up questions that show you're listening
          - Avoid robotic, repetitive questioning
          - Adapt to the candidate's level and responses
          
          ### INPUT VALIDATION & QUALITY CONTROL (CRITICAL):
          1. **GIBBERISH DETECTION**: If the candidate provides non-sensical input (e.g., "asdasd", "bla bla", random chars), DO NOT accept it.
             - WRONG: "Thanks for that. Moving on..."
             - CORRECT: "I didn't quite catch that. Could you please repeat?" or "I'm not sure I follow. Can you clarify?"
          2. **IGNORE ATTEMPTS**: If the candidate ignores the question, DO NOT proceed. Press them gently again.
          3. **NO BLIND AFFIRMATION**: NEVER say "That's a great answer" or "Helpful overview" if the input was garbage. Only validate valid technical content.
          4. **LENGTH CHECK**: If the answer is one word (e.g., "Yes", "No") for a complex question, ask for elaboration ("Could you expand on why?").
          
          ### INSTRUCTION PRIORITY RULE:
          1. HIGHEST PRIORITY: V2 Dynamic Round Instruction (Top of Prompt)
          2. The current round's objective overrides any previous context. If this is System Design, DO NOT ask Coding or Conceptual questions even if mentioned in summaries.
          3. HIGHEST PRIORITY: V2 Dynamic Round Instruction (if present)
          4. SECOND PRIORITY: Global DM Instructions
          5. THIRD PRIORITY: Standard round behavior

          ${roundType === 'CODING' ? `
          ### !!! STRICT CODING MODE ACTIVE !!!
          - YOU ARE NOW A CODE COMPILER/EVALUATOR.
          - DO NOT ask behavioral questions (e.g., "Tell me about a time...", "Mentorship experience").
          - DO NOT make small talk.
          - YOUR ONLY GOAL: Present a CODING PROBLEM (LeetCode Style) immediately if one is not active.
          - IF this is the start of the round: "Here is your coding challenge: [Title]..."
          - IGNORE previous round context about "Leadership" or "Mentorship".
          ` : ''}

          RESPONSE FORMAT (JSON):
          {
            "text": "Your spoken question or response to the candidate.",
            "score": 0-10, // Score for their last response (10=perfect, 0=wrong/blank)
            "candidateNote": " -SCORE: X/10\\n -TOPIC: Skill Area\\n - Analysis: Professional assessment...",
            "codeSnippet": "${roleType === 'TECHNICAL' && roundNum === 2 ? 'Starter code here' : roundNum === 2 ? 'Analysis framework' : ''}"
          }

          CRITICAL RULES FOR REAL INTERVIEW BEHAVIOR:
          1. MEMORY: Remember the conversation flow and topics covered.
          2. UNIQUENESS: Each question must be new and different.
          3. CONTEXT: Reference previous answers when appropriate.
          4. DEPTH: Explore topics thoroughly before moving on.
          5. NATURAL: Sound like a human, not a question bank.

          ${!roundContext ? ROUND_GUARDIANS[roundNum] || ROUND_GUARDIANS[1] : ''}
        `;

        // Combine messages into a single user prompt
        const lastUserMessage = processedMessages[processedMessages.length - 1]?.text || '';
        const history = processedMessages.slice(0, -1).map((m: any) => `${m.role === 'user' ? 'CANDIDATE' : 'INTERVIEWER'}: ${m.text}`).join('\n');

        const fullUserPrompt = `
        ### INTERVIEW HISTORY (READ CAREFULLY - REMEMBER THIS):
        ${history}
        
        ### CANDIDATE'S LAST RESPONSE:
        "${lastUserMessage}"
        
        ### YOUR TASK:
        Continue the interview naturally as the ${roleType} INTERVIEWER.
        Remember what has been discussed. Do not repeat questions/topics.
        Provide your next question/response in JSON format.
        `;

        let finalResponseData: any = null;
        let attempts = 0;
        const maxAttempts = 3;
        let currentFullUserPrompt = fullUserPrompt;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const { text, provider } = await LLMRouter.generate(systemPrompt, currentFullUserPrompt, 0.2);
                console.log(`DEBUG: Attempt ${attempts} via ${provider} for ${roleType} round ${roundNum}`);

                let cleanJson = text;
                // Extract JSON from response
                const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanJson = jsonMatch[0];
                }

                const parsed = JSON.parse(cleanJson);

                // --- REAL INTERVIEW VALIDATION ---
                if (roundNum === 0) {
                    // MCQ validation
                    const hasOptions = parsed.text.includes('A)') && parsed.text.includes('B)') &&
                        parsed.text.includes('C)') && parsed.text.includes('D)');
                    if (!hasOptions) {
                        console.warn(`[Guardian] Missing MCQ options. Retrying...`);
                        currentFullUserPrompt += "\n\nERROR: You failed to provide an MCQ. You MUST provide a new question with options A), B), C), D). Stop explaining and ASK THE QUESTION.";
                        continue;
                    }

                    // Check for question uniqueness using keyword extraction
                    const responseText = parsed.text.toLowerCase();

                    console.log(`[DEBUG] Checking duplicate for new response:`, responseText.substring(0, 100));
                    console.log(`[DEBUG] Previous topics:`, previousTopics);

                    // Extract meaningful keywords from the new question (ignore common question words)
                    const commonWords = ['which', 'what', 'how', 'why', 'following', 'best', 'describes', 'characteristic', 'not', 'is', 'are', 'the', 'of', 'a', 'an', 'in', 'to', 'for', 'from', 'with', 'that', 'this', 'these', 'those', 'used', 'using', 'use', 'does', 'would', 'should', 'could', 'common', 'most', 'least', 'data', 'system'];
                    const extractKeywords = (text: string) => {
                        return text
                            .replace(/[^a-z0-9\s]/g, ' ')
                            .split(/\s+/)
                            .filter(word => word.length > 3 && !commonWords.includes(word))
                            .slice(0, 8); // Take first 8 meaningful words
                    };

                    const newQuestionWords = extractKeywords(responseText);
                    console.log(`[DEBUG] New question keywords:`, newQuestionWords);

                    // Check if this question shares too many keywords with previous topics
                    let isDuplicate = previousTopics.some(topic => {
                        const topicWords = extractKeywords(topic.toLowerCase());

                        // Count how many keywords match
                        const matchCount = newQuestionWords.filter(word =>
                            topicWords.some(topicWord => topicWord === word || topicWord.includes(word) || word.includes(topicWord))
                        ).length;

                        // If more than 3 keywords match, it's likely a duplicate topic
                        const isDup = matchCount >= 4;
                        if (isDup) {
                            console.log(`[DEBUG] Duplicate detected - ${matchCount} matching keywords with topic:`, topic.substring(0, 50));
                        }
                        return isDup;
                    });


                    if (isDuplicate) {
                        console.warn(`[Guardian] Duplicate MCQ question detected. Retrying...`);
                        currentFullUserPrompt += `\n\nERROR: You already asked a question about "${previousTopics[previousTopics.length - 1]}". Choose a COMPLETELY DIFFERENT topic from a different domain.`;
                        continue;
                    }
                } else {
                    // Non-MCQ rounds: Check for topic repetition
                    const responseText = parsed.text.toLowerCase();
                    const isRepetitive = previousTopics.some(topic => {
                        const shortTopic = topic.slice(0, 30);
                        return responseText.includes(shortTopic) && shortTopic.length > 15;
                    });

                    if (isRepetitive && attempts < maxAttempts - 1) {
                        console.warn(`[Guardian] Repetitive topic detected. Retrying...`);
                        currentFullUserPrompt += `\n\nREMINDER: You've already covered similar topics. Choose a NEW direction.`;
                        continue;
                    }
                }

                // Validate required fields
                if (!parsed.text || parsed.text.length < 10) {
                    console.warn(`[Guardian] Response too short. Retrying...`);
                    currentFullUserPrompt += "\n\nERROR: Your response is too brief. Provide a proper interview question/response.";
                    continue;
                }

                finalResponseData = parsed;
                break; // Success!

            } catch (e) {
                console.error(`Attempt ${attempts} failed:`, e);
                if (attempts === maxAttempts) {
                    console.error(`All ${maxAttempts} attempts failed for round ${roundNum}`);
                    // Let it fall through to the final response handler
                }
            }
        }

        return NextResponse.json({
            text: finalResponseData?.text || "I apologize, I'm having trouble generating a question. Let's continue.",
            candidateNote: finalResponseData?.candidateNote || "[SCORE: 0/10] | [TOPIC: System Error]",
            codeSnippet: finalResponseData?.codeSnippet || "",
            score: finalResponseData?.score || 0,
            metadata: {
                roleType: roleType,
                round: roundNum,
                jobTitle: selectedJob?.title || 'Unknown',
                topicsCovered: previousTopics.length
            }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({
            error: error.message,
            roleType: roleType || 'Unknown'
        }, { status: 500 });
    }
}