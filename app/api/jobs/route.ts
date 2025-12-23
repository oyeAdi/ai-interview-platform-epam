import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { InterviewData, JobDescription } from '@/types';

const DATA_PATH = path.join(process.cwd(), 'data', 'interview_config.json');

async function getData(): Promise<InterviewData> {
    const content = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(content);
}

async function saveData(data: InterviewData) {
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
    try {
        const data = await getData();
        return NextResponse.json(data.uber_roles);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const newJob: JobDescription = await req.json();
        const data = await getData();

        // Simple validation
        if (!newJob.id) newJob.id = Math.random().toString(36).substr(2, 9);

        data.uber_roles.push(newJob);
        await saveData(data);

        return NextResponse.json(newJob);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const updatedJob: JobDescription = await req.json();
        const data = await getData();

        const index = data.uber_roles.findIndex(j => j.id === updatedJob.id);
        if (index === -1) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        data.uber_roles[index] = updatedJob;
        await saveData(data);

        return NextResponse.json(updatedJob);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();
        const data = await getData();

        const index = data.uber_roles.findIndex(j => j.id === id);
        if (index === -1) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        data.uber_roles.splice(index, 1);
        await saveData(data);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
