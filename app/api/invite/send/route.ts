import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, subject, body: emailBody, link, jobId, candidateName } = body;

        // Validation
        if (!to || !subject || !emailBody || !link) {
            return NextResponse.json(
                { error: 'Missing required fields (to, subject, body, link)' },
                { status: 400 }
            );
        }

        const nodemailer = require('nodemailer');

        const transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY,
            },
        });

        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'aditya_raj@epam.com';

        await transporter.sendMail({
            from: `"EPAM AI Interview" <${fromEmail}>`,
            to,
            subject,
            text: emailBody, // Fallback text
            html: emailBody.replace(/\n/g, '<br>'), // Simple HTML conversion
        });

        return NextResponse.json({
            success: true,
            message: 'Email sent successfully via SendGrid'
        });

    } catch (error: any) {
        console.error("Email send error:", error);
        return NextResponse.json(
            { error: error.message || 'Failed to send email' },
            { status: 500 }
        );
    }
}
