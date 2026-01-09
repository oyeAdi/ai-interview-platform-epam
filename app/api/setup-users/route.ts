import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper to create user if not exists
async function createUser(email: string, password: string, clientRole?: string) {
    if (!supabaseAdmin) throw new Error("Supabase Admin not configured");

    console.log(`Checking user: ${email}`);
    // Check if exists by trying to create (easiest way without listing all users)
    // Or we can try to get by email if we had that privilege, but admin.createUser handles duplicates gracefully usually? 
    // Actually, createUser returns error if exists.

    // Try to create
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { client_role: clientRole }
    });

    if (error) {
        if (error.message.includes('already registered') || error.status === 422) {
            console.log(`User ${email} already exists.`);
            // Optionally update metadata if needed, but for now just skip
            return { status: 'exists', email };
        }
        console.error(`Failed to create ${email}:`, error);
        return { status: 'error', email, error: error.message };
    }

    console.log(`Created user: ${email}`);
    return { status: 'created', email, id: data.user.id };
}

export async function GET() {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase Admin not available' }, { status: 500 });
    }

    try {
        const results = await Promise.all([
            createUser('admin@epam.com', 'Test@1234', 'Systems'),
            createUser('uber_oppertunities@epam.com', 'Test@1234', 'Uber'),
            createUser('servicenow_oppertunities@epam.com', 'Test@1234', 'ServiceNow')
        ]);

        return NextResponse.json({
            message: 'User setup complete',
            results
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
