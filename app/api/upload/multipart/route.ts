import { NextRequest, NextResponse } from 'next/server';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, fileName, fileType, uploadId, key, parts } = body;

        if (action === 'check') {
            const isEnabled = !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT);
            return NextResponse.json({ enabled: isEnabled });
        }

        console.log(`[Multipart API] Action: ${action}`, { fileName, key, partsCount: parts?.length });

        if (action === 'init') {
            const command = new CreateMultipartUploadCommand({
                Bucket: R2_BUCKET_NAME,
                Key: `sessions/${fileName}`, // Organized in folders
                ContentType: fileType || 'video/webm'
            });
            const multipartUpload = await r2Client.send(command);
            return NextResponse.json({
                uploadId: multipartUpload.UploadId,
                key: multipartUpload.Key
            });
        }

        if (action === 'sign_parts') {
            // Generate presigned URLs for a batch of parts
            // body.parts = [{ partNumber: 1 }, { partNumber: 2 }...]
            if (!uploadId || !key || !parts) return NextResponse.json({ error: "Missing params" }, { status: 400 });

            const signedUrls = await Promise.all(parts.map(async (part: any) => {
                const command = new UploadPartCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    UploadId: uploadId,
                    PartNumber: part.partNumber,
                });
                const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
                return { partNumber: part.partNumber, url };
            }));

            return NextResponse.json({ signedUrls });
        }

        if (action === 'complete') {
            if (!uploadId || !key || !parts) return NextResponse.json({ error: "Missing params" }, { status: 400 });

            // parts must be sorted by PartNumber
            const sortedParts = parts.sort((a: any, b: any) => a.PartNumber - b.PartNumber);

            const command = new CompleteMultipartUploadCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: { Parts: sortedParts },
            });
            await r2Client.send(command);
            return NextResponse.json({ success: true, location: key });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("[Multipart API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
