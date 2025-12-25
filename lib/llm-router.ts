import { HfInference } from "@huggingface/inference";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize HF Client
const hf = new HfInference(HF_API_KEY);

// Balanced Chain: Gemini 2.0 (Best All-Round) -> Qwen (Fastest) -> Gemma 3 (Quota)
const MODEL_CHAIN = [
    {
        provider: 'google',
        name: 'Gemini 2.0 Flash',
        id: 'gemini-2.0-flash' // Rank 1: High Quality + Fast (~1.2s)
    },
    {
        provider: 'hf',
        name: 'Qwen 2.5 7B',
        id: 'Qwen/Qwen2.5-7B-Instruct' // Rank 2: Speed King (~0.7s)
    },
    {
        provider: 'google',
        name: 'Gemma 3 27B',
        id: 'gemma-3-27b-it' // Rank 3: High Quota Backup
    },
    {
        provider: 'hf',
        name: 'Llama 3 8B',
        id: 'meta-llama/Meta-Llama-3-8B-Instruct'
    },
    {
        provider: 'google',
        name: 'Gemini 2.5 Flash Lite',
        id: 'gemini-2.5-flash-lite'
    }
];

export class LLMRouter {

    static async generate(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<{ text: string, provider: string }> {
        console.log(">>> [LLM Router] Request Initiated");
        let lastError: any = null;

        for (const model of MODEL_CHAIN) {
            try {
                console.log(`>>> [LLM Router] Attempting: ${model.name} (${model.provider})`);

                if (model.provider === 'hf') {
                    // Use SDK
                    const result = await this.callHuggingFace(model.id, systemPrompt, userPrompt, temperature);
                    if (result) {
                        console.log(`>>> [LLM Router] Success via ${model.name}`);
                        return { text: result, provider: model.name };
                    }
                }
                else if (model.provider === 'google') {
                    // Use REST (Proven to work)
                    const result = await this.callGemini(model.id, systemPrompt, userPrompt, temperature);
                    if (result) {
                        console.log(`>>> [LLM Router] Success via ${model.name}`);
                        return { text: result, provider: model.name };
                    }
                }

            } catch (err: any) {
                console.warn(`>>> [LLM Router] Failed ${model.name}: ${err.message}`);
                lastError = err;
            }
        }

        throw new Error(`All LLM models failed. Last error: ${lastError?.message}`);
    }

    private static async callHuggingFace(modelId: string, system: string, user: string, temp: number): Promise<string | null> {
        if (!HF_API_KEY) throw new Error("HUGGINGFACE_API_KEY not set");

        try {
            const response = await hf.chatCompletion({
                model: modelId,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user }
                ],
                max_tokens: 2048,
                temperature: temp
            });
            return response.choices[0].message.content || null;
        } catch (err: any) {
            // Log full error for debugging
            console.error(`[HF SDK Error] ${modelId}:`, err);
            throw new Error(`HF SDK Error: ${err.message}`);
        }
    }

    private static async callGemini(modelId: string, system: string, user: string, temp: number): Promise<string | null> {
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

        const cleanId = modelId.startsWith('models/') ? modelId : modelId;
        const isGemma = cleanId.toLowerCase().includes('gemma');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanId}:generateContent?key=${GEMINI_API_KEY}`;

        // Gemma models via API often don't support 'system_instruction' yet.
        // We merge system prompt into user message for them.
        const finalUserPrompt = isGemma ? `System Instruction:\n${system}\n\nUser Message:\n${user}` : user;

        const payload: any = {
            contents: [{ role: 'user', parts: [{ text: finalUserPrompt }] }],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: temp
            }
        };

        if (!isGemma) {
            payload.system_instruction = { parts: [{ text: system }] };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Gemini Error ${res.status}: ${text}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
}

