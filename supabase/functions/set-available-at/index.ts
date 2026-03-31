import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify caller is authenticated
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = supabaseAdmin();

  // Get user from JWT
  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = user.email!.toLowerCase();

  // Set available_at = NOW() + 24h using Postgres clock (not Edge Function clock).
  // Uses the set_blueprint_available_at SQL function (security definer) created in schema setup.
  // The .is('available_at', null) guard inside the SQL function ensures idempotency.
  const { error } = await supabase.rpc('set_blueprint_available_at', { p_email: email });

  if (error) {
    console.error('set-available-at error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
