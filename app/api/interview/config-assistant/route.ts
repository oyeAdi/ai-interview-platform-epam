import { NextRequest, NextResponse } from 'next/server';
import { LLMRouter } from '@/lib/llm-router';

export async function POST(req: NextRequest) {
    try {
        const { query, type } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const systemPrompt = `You are an Expert Interview Designer.
        Your task is to generate precise, high-quality instructions for an AI Interviewer based on a user's request.
        
        The user will describe a specific type of interview round (e.g., "Hard React Coding" or "Marketing Strategy").
        You must return a configuration object that best fits this request.
        
        OUTPUT FORMAT: JSON ONLY
        {
            "title": "A professional title for the round",
            "systemPromptContext": "The exact strict instruction to the AI Interviewer on how to conduct this round. Be specific about topics, constraints, and tone."
        }`;

        const userPrompt = `
        User Request: "${query}"
        Round Type Context: ${type || 'General'}
        
        Generate the configuration for this round.
        For 'systemPromptContext', write a clear, imperative instruction for the AI model that will act as the interviewer.
        Example Context: "Act as a Senior React Engineer. candidate is evaluating for L5. Focus strictly on Hooks closures and performance optimization. Do not ask basic syntax questions."
        `;

        const { text, provider } = await LLMRouter.generate(systemPrompt, userPrompt, 0.7);

        // Clean up JSON
        let cleanJson = text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanJson = jsonMatch[0];

        const config = JSON.parse(cleanJson);

        return NextResponse.json({ ...config, provider });

    } catch (error: any) {
        console.error("Config Assistant Error:", error);
        return NextResponse.json({
            title: "Custom Round",
            systemPromptContext: "Conduct a professional interview focusing on the candidate's skills."
        }, { status: 200 }); // Fallback instead of failure
    }
}
