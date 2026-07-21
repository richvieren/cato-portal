# Cato Portal: Supabase → SQLite Cutover Plan

_Created: 2026-07-21_

## Current State (post-prep)

### What's running
- **Live portal** (app.catovermeulen.com): GitHub Pages, `main` branch, Supabase auth + data
- **VPS API** (api.catovermeulen.com): FastAPI + SQLite at `/opt/cato/data/cato.db`
- **Dual-write**: Flodesk webhook writes new purchases to both Supabase AND SQLite
- **Reading pipelines**: Blueprint, Transit, Astrocartography all generate via VPS, save PDFs locally

### What's ready but not live
- **Branch `sqlite-cutover-prep`**: Rewritten `auth.js`, `db.js`, all HTML files targeting `/v2/` API
- **v2 auth** (`/v2/auth/`): Magic link via Resend → verify token → JWT sessions
- **v2 data** (`/v2/api/`): Profile, grants, course progress, natal charts, PDF downloads
- **Test user verified**: `cutover-test@aooa.tv` — full flow tested (magic link → JWT → grants → PDF download)

### What's NOT ready
- **Stripe API key**: Expired. Needs regeneration in Stripe Dashboard before Stripe webhook can work
- **Stripe webhook secret**: Empty. Create endpoint in Stripe pointing to `https://api.catovermeulen.com/v2/api/stripe-webhook`
- **Profile.js grant insert**: Replaced with fetch to `/v2/api/access-grants` endpoint — this endpoint doesn't exist yet in `api_data.py`. Needs to be added or the profile.js logic reworked

## Cutover Day Checklist

### Pre-cutover (do first)
1. **Re-sync data**: Run `migrate_from_supabase.py` one final time to catch any grants/users created via Supabase since July 15. Dual-write covers Flodesk purchases, but manual grants added directly in Supabase won't be in SQLite
2. **Verify dual-write logs**: Check VPS logs for any `[sqlite] DUAL-WRITE FAILED` entries since July 21. Fix any issues found
3. **Test the branch one more time**: Load `sqlite-cutover-prep` locally, test all pages against VPS API
4. **Generate fresh Stripe API key** if Stripe checkout is needed (currently all purchases go through Flodesk)

### Cutover (15 minutes)
1. Merge `sqlite-cutover-prep` → `main` in the portal repo
2. Push to GitHub Pages (auto-deploys)
3. Stop Supabase writes: Remove the Supabase block from `_create_access_grant()` in `webhook_server.py`, restart service
4. Update CORS: Remove `app.catovermeulen.com` from allowed origins if using a different domain, or keep both

### Post-cutover monitoring (1 week)
1. **Watch for auth failures**: Check VPS logs for 401s on `/v2/auth/` endpoints
2. **Watch for grant creation**: Verify new Flodesk purchases create SQLite grants correctly
3. **Watch for download failures**: Check for 404s on `/v2/api/files/` (PDF not found = PDF not generated yet)
4. **Keep Supabase project alive** for 30 days as rollback. Don't delete until confident

### Rollback plan
1. Revert `main` to the commit before merge
2. Push to GitHub Pages
3. Re-add Supabase block to `_create_access_grant()`
4. Run another `migrate_from_supabase.py` to catch any SQLite-only grants back to Supabase (would need reverse migration script)

## Architecture After Cutover

```
Client browser (app.catovermeulen.com)
  ├── auth.js → POST /v2/auth/send-magic-link
  │              POST /v2/auth/verify → JWT
  │              GET  /v2/auth/me
  ├── db.js   → GET  /v2/api/profile
  │              POST /v2/api/profile
  │              GET  /v2/api/grants/{product}
  │              POST /v2/api/set-available
  │              GET  /v2/api/download/{product} → signed URL
  │              GET  /v2/api/files/{token} → PDF
  │              GET  /v2/api/natal-chart
  │              POST /v2/api/compute-chart
  │              GET  /v2/api/course-progress
  │              POST /v2/api/course-progress/{id}
  └── pipelines → POST /blueprint-portal
                  POST /transit-portal
                  POST /astrocartography-portal

Flodesk Checkout → POST /flodesk-webhook → SQLite grant + magic link email

VPS (api.catovermeulen.com)
  └── FastAPI (uvicorn :8000)
      └── SQLite (/opt/cato/data/cato.db)
          ├── WAL mode
          ├── Daily backup at 3am → /opt/cato/backups/
          └── Offsite copy → /root/AOOA/ → git-sync → Mac
```

## Known Issues to Address Before Cutover

1. **`/v2/api/access-grants` POST endpoint missing**: `profile.js` was rewritten to POST here for manual grant creation. Either add this endpoint to `api_data.py` or remove the manual grant flow from profile.js
2. **Email templates are generic**: The Stripe webhook welcome email in `api_data.py` uses a basic template. Port the product-specific templates from the old Supabase edge functions
3. **Session cleanup**: No cron to expire old sessions/tokens. Not critical but good hygiene — add a weekly cleanup of expired `auth_tokens` and `sessions`
4. **Stripe key**: Needs regeneration. Check if any active Stripe Checkout links exist that would break
