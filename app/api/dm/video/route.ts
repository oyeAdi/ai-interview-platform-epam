import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    const folder = req.nextUrl.searchParams.get('folder');
    if (!folder) {
        return new NextResponse("Folder required", { status: 400 });
    }

    const videoPath = path.join(process.cwd(), 'data', 'sessions', folder, 'recording.webm');

    if (!fs.existsSync(videoPath)) {
        return new NextResponse("Video not found", { status: 404 });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        // @ts-ignore
        return new NextResponse(file, {
            status: 206,
            headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': 'video/webm',
            }
        });
    } else {
        const file = fs.createReadStream(videoPath);
        // @ts-ignore
        return new NextResponse(file, {
            headers: {
                'Content-Length': fileSize.toString(),
                'Content-Type': 'video/webm',
            }
        });
    }
}
