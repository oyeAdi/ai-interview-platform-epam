import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return NextResponse.json({ status: 'error', message: 'GEMINI_API_KEY is missing from environment.' }, { status: 500 });
    }

    const modelName = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

    try {
        console.log(`[Health Check] Testing connectivity to ${modelName}...`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: "Ping. Reply with 'Pong' if you are alive." }] }],
                generationConfig: { maxOutputTokens: 10 }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`[Health Check] Failed: ${res.status} ${res.statusText}`, errText);
            return NextResponse.json({
                status: 'error',
                code: res.status,
                message: res.statusText,
                details: errText
            }, { status: res.status });
        }

        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return NextResponse.json({
            status: 'ok',
            model: modelName,
            response: reply
        });

    } catch (error: any) {
        console.error('[Health Check] Network/Unknown Error:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
