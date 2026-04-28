// auth.js — Supabase client init + auth helpers

const SUPABASE_URL = 'https://fdewbbrzetgqqsonpqvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZXdiYnJ6ZXRncXFzb25wcXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDc0NjUsImV4cCI6MjA5MDUyMzQ2NX0.8QbNLvBMNFDcmnsexPPUG0OazaMX0J2BrHonG-dDJmk';

const { createClient } = supabase;
window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSession() {
  // If the URL has auth params (magic link redirect), exchange the token first
  const hash = window.location.hash;
  if (hash && (hash.includes('access_token') || hash.includes('type='))) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      // Sign out any existing session first
      await window.sb.auth.signOut();
      // Set the new session from the magic link
      await window.sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      // Clean the URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
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
