import { createClient } from '@supabase/supabase-js';

// Helper function to validate and create Supabase clients
function getSupabaseClient(useServiceRole = false) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL environment variable is not defined');
  }

  if (useServiceRole) {
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not defined');
    }
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } else {
    if (!anonKey) {
      throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable is not defined');
    }
    return createClient(supabaseUrl, anonKey);
  }
}

// Helper function to create authenticated Supabase client
function createAuthenticatedClient(authHeader: string) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Required Supabase environment variables are not defined');
  }

  const token = authHeader.replace('Bearer ', '');
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
}

export async function POST(request: Request, { id }: { id: string }) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createAuthenticatedClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Use admin client for the update operation since we need to generate new tokens
    const supabaseAdmin = getSupabaseClient(true);
    const { data: character, error } = await supabaseAdmin
      .from('characters')
      .update({
        share_token: crypto.randomUUID(),
        token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('share_token, token_expires_at')
      .single();

    if (error) {
      console.error('Error generating share token:', error);
      return new Response('Error generating share token', { status: 500 });
    }

    return Response.json({
      share_token: character.share_token,
      expires_at: character.token_expires_at,
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createAuthenticatedClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Use admin client for the update operation
    const supabaseAdmin = getSupabaseClient(true);
    const { error } = await supabaseAdmin
      .from('characters')
      .update({
        share_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error revoking share token:', error);
      return new Response('Error revoking share token', { status: 500 });
    }

    return new Response('Share token revoked', { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}