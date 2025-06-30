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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = getSupabaseClient();

    // Set the auth token for this request
    supabase.auth.setSession({
      access_token: authHeader.replace('Bearer ', ''),
      refresh_token: '',
    });

    const { data: characters, error } = await supabase
      .from('characters')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database select error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(characters), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a new supabase client instance for this request
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Required Supabase environment variables are not defined');
    }

    const supabaseWithAuth = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Get the current user to ensure we have the correct user_id
    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication error:', userError);
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    
    // Ensure user_id is set to the authenticated user's ID
    const characterData = {
      ...body,
      user_id: user.id // Force the user_id to be the authenticated user's ID
    };

    const { data: character, error } = await supabaseWithAuth
      .from('characters')
      .insert([characterData])
      .select()
      .single();

    if (error) {
      console.error('💥 Database insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(character), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}