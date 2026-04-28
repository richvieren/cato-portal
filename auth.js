// auth.js — Supabase client init + auth helpers

const SUPABASE_URL = 'https://fdewbbrzetgqqsonpqvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZXdiYnJ6ZXRncXFzb25wcXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDc0NjUsImV4cCI6MjA5MDUyMzQ2NX0.8QbNLvBMNFDcmnsexPPUG0OazaMX0J2BrHonG-dDJmk';

const { createClient } = supabase;
window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// If URL has a magic link token, sign out current session first so the new user gets logged in
(async function handleMagicLinkSwitch() {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  if (hash.includes('access_token') || hash.includes('type=magiclink') || params.get('token_hash')) {
    await window.sb.auth.signOut();
  }
})();

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
