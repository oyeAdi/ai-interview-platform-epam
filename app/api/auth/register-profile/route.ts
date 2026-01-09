
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase Admin not available' }, { status: 500 });
    }

    try {
        const { id, email, client_role } = await request.json();

        if (!id || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Default to 'Systems' if not provided (though frontend should provide it)
        const role = client_role || 'Systems';

        // Upsert into public.users
        const { error } = await supabaseAdmin
            .from('users')
            .upsert({
                id,
                email,
                client_role: role,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error("Failed to insert user profile:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
