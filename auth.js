// auth.js — Supabase client init + auth helpers

const SUPABASE_URL = 'SUPABASE_PLACEHOLDER';
const SUPABASE_ANON_KEY = 'ANON_KEY_PLACEHOLDER';

const { createClient } = supabase;
window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSession() {
  const { data: { session } } = await window.sb.auth.getSession();
  return session;
}

async function sendMagicLink(email) {
  const { error } = await window.sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: 'https://app.catovermeulen.com'
    }
  });
  return { error };
}

async function signOut() {
  await window.sb.auth.signOut();
  window.location.reload();
}
