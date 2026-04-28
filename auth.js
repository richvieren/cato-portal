// auth.js — Supabase client init + auth helpers

const SUPABASE_URL = 'https://fdewbbrzetgqqsonpqvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZXdiYnJ6ZXRncXFzb25wcXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDc0NjUsImV4cCI6MjA5MDUyMzQ2NX0.8QbNLvBMNFDcmnsexPPUG0OazaMX0J2BrHonG-dDJmk';

const { createClient } = supabase;
window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    flowType: 'implicit',
  }
});

// Listen for auth state changes. When a magic link is clicked,
// Supabase detects the tokens in the URL hash and fires SIGNED_IN.
// This handles the "different user already logged in" case by reloading
// the page so the dashboard picks up the new session.
window.sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
    // Clean the hash from the URL
    window.history.replaceState(null, '', window.location.pathname);
    // Reload to pick up the new session
    window.location.reload();
  }
});

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
