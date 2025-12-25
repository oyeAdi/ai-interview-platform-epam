import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Uber Engineering Interview',
    description: 'AI-Powered Technical Screening Platform',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
