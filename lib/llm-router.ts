import { GoogleGenerativeAI } from "@google/generative-ai";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// User Requested Chain: Qwen (HF) -> Llama (HF) -> Gemma (Google) -> Gemini (Google)
const MODEL_CHAIN = [
    {
        provider: 'hf',
        name: 'Qwen 2.5 7B',
        id: 'Qwen/Qwen2.5-7B-Instruct',
        url: 'https://router.huggingface.co/hf-inference/models/Qwen/Qwen2.5-7B-Instruct'
    },
    {
        provider: 'hf',
        name: 'Llama 3 8B',
        id: 'meta-llama/Meta-Llama-3-8B-Instruct',
        url: 'https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct'
    },
    {
        provider: 'google',
        name: 'Gemma 3 27B',
        id: 'gemma-3-27b-it', // Verified available on Google API
        url: ''
    },
    {
        provider: 'google',
        name: 'Gemini 2.5 Flash Lite',
        id: 'gemini-2.5-flash-lite', // Verified available on Google API
        url: ''
    },
    {
        provider: 'google',
        name: 'Gemini 2.0 Flash',
        id: 'gemini-2.0-flash', // Verified available
        url: ''
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
                    const result = await this.callHuggingFace(model.url, systemPrompt, userPrompt, temperature);
                    if (result) {
                        console.log(`>>> [LLM Router] Success via ${model.name}`);
                        return { text: result, provider: model.name };
                    }
                }
                else if (model.provider === 'google') {
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

    private static async callHuggingFace(url: string, system: string, user: string, temp: number): Promise<string | null> {
        if (!HF_API_KEY) throw new Error("HUGGINGFACE_API_KEY not set");

        const payload = {
            model: url.split('/').pop(),
            messages: [
                { role: "system", content: system },
                { role: "user", content: user }
            ],
            parameters: {
                max_new_tokens: 2048,
                temperature: temp,
                return_full_text: false
            },
            stream: false
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`HF API Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
        if (data.generated_text) return data.generated_text;
        if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;

        return null;
    }

    private static async callGemini(modelId: string, system: string, user: string, temp: number): Promise<string | null> {
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

        // Note: models/ prefix might be needed or not depending on exact endpoint, 
        // but the list verified 'models/gemini-...' format.
        // The v1beta generation endpoint usually expects 'models/' prefix or just ID.
        // We'll assume the ID needs to be clean but the URL adds 'models/'.
        // Actually, list returned 'models/gemini-2.0-flash'.

        // If modelId already has 'models/', don't add it again? 
        // The list output had 'models/' prefix.
        const cleanId = modelId.startsWith('models/') ? modelId : modelId;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanId}:generateContent?key=${GEMINI_API_KEY}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: user }] }],
                system_instruction: { parts: [{ text: system }] },
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: temp
                }
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Gemini Error ${res.status}: ${text}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
}
