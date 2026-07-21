// auth.js — VPS auth via /v2/auth/ API (SQLite + JWT)

const API_BASE = 'https://api.catovermeulen.com';

// On page load, check for magic-link token in URL
(function handleAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  if (!token) return;

  // Verify the token and get a JWT session
  fetch(`${API_BASE}/v2/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok && data.access_token) {
        localStorage.setItem('cato_token', data.access_token);
        localStorage.setItem('cato_user', JSON.stringify(data.user));
        // Clean the URL and reload
        window.history.replaceState(null, '', window.location.pathname);
        window.location.reload();
      } else {
        console.error('Auth verify failed:', data);
      }
    })
    .catch(err => console.error('Auth verify error:', err));
})();

/** Get current session (JWT + user). Returns null if not logged in. */
async function getSession() {
  const token = localStorage.getItem('cato_token');
  const userJson = localStorage.getItem('cato_user');
  if (!token || !userJson) return null;

  // Validate the token is still good
  try {
    const res = await fetch(`${API_BASE}/v2/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      // Token expired or invalid — clear and return null
      localStorage.removeItem('cato_token');
      localStorage.removeItem('cato_user');
      return null;
    }
    const data = await res.json();
    // Return a session-like object matching the shape the portal expects
    return {
      access_token: token,
      user: data.user,
    };
  } catch {
    return null;
  }
}

/** Send magic link via the VPS auth API. */
async function sendMagicLink(email) {
  try {
    const res = await fetch(`${API_BASE}/v2/auth/send-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.detail || 'Failed to send magic link' };
    return {};
  } catch (err) {
    return { error: err.message };
  }
}

/** Sign out — revoke server sessions and clear local storage. */
async function signOut() {
  const token = localStorage.getItem('cato_token');
  if (token) {
    fetch(`${API_BASE}/v2/auth/sign-out`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
  }
  localStorage.removeItem('cato_token');
  localStorage.removeItem('cato_user');
  window.location.reload();
}
