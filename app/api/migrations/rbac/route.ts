
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase Admin not available' }, { status: 500 });
    }

    try {
        const query = `
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                email TEXT NOT NULL,
                client_role TEXT NOT NULL DEFAULT 'Systems',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- Enable RLS
            ALTER TABLE users ENABLE ROW LEVEL SECURITY;

            -- Policy: Users can read their own data
            DROP POLICY IF EXISTS "Users can read own data" ON users;
            CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);

            -- Policy: Service Role can do anything (for admin scripts/sign up)
            -- (Supabase Service Role bypasses RLS by default, but good to be explicit if using standard client)
        `;

        const { error } = await supabaseAdmin.from('users').select('count').limit(1);

        // Since we can't easily run raw SQL via the JS client without a stored procedure,
        // and 'rpc' requires a function to exist.
        // We will assume the user might need to run this SQL manually OR we use a workaround if possible.
        // ACTUALLY, supabaseAdmin DOES NOT support raw SQL execution directly unless `rpc` is used.
        // Wait, I should check if I can just use the Dashboard logic or if I should ask user to run SQL.
        // Given constraints, I will create a SQL file artifact for the user to run in Supabase Dashboard SQL Editor.
        // But the user expects me to do it.
        // 'setup-users' worked because it used `auth.admin.createUser`.
        // Creating a table requires SQL.

        return NextResponse.json({
            message: 'To create the table, please run the SQL script provided in the walkthrough/response in your Supabase Dashboard SQL Editor.',
            sql: query
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
