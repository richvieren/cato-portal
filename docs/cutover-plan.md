# Cato Portal: Supabase → SQLite Cutover

_Created: 2026-07-21_
_Cutover executed: 2026-07-21 ~22:00 SAST_

## Status: LIVE on SQLite

### What happened
1. Pre-flight: backup verified (90 users, integrity ok), offsite confirmed on Mac, zero dual-write failures
2. Merged `sqlite-cutover-prep` → `main`, pushed to GitHub Pages
3. Verified app.catovermeulen.com serves VPS-backed code (0 Supabase refs, 26 /v2/ API calls)
4. Set `PORTAL_URL=https://app.catovermeulen.com`
5. Production smoke test passed: magic link → email → verify → JWT → /me → grants → download URL → PDF (200, 171KB)
6. Flipped webhook: SQLite primary, Supabase mirror
7. Deleted `staging` branch and portal.catovermeulen.com deployment
8. portal.catovermeulen.com was a stale GitHub Pages staging deploy from July 15 — served over HTTP only, never used by clients

### Current architecture

```
Client browser (app.catovermeulen.com — GitHub Pages, TLS)
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

Flodesk Checkout → POST /flodesk-webhook
  → SQLite grant (primary)
  → Supabase grant (mirror, non-blocking)
  → Magic link email via Resend

VPS (api.catovermeulen.com / 161.97.100.134)
  └── FastAPI (uvicorn :8000)
      └── SQLite (/opt/cato/data/cato.db)
          ├── WAL mode
          ├── Daily backup 3am → /opt/cato/backups/ (14-day retention)
          └── Offsite pull 9:15am → ~/backups/cato/ on Mac (14-day retention)
```

### Watch week (July 21–28)

Daily check: `ssh root@161.97.100.134 "journalctl -u cato-blueprint --since '24 hours ago' | grep -iE 'FAIL|error|401|sqlite'"`

Watch for:
- Auth failures: 401s on `/v2/auth/` endpoints (bad JWT, expired session)
- Grant creation: `[sqlite] PRIMARY WRITE FAILED` in logs (new purchase didn't save)
- Download failures: 404 on `/v2/api/files/` (PDF not yet generated or path mismatch)
- Supabase mirror: `[supabase-mirror] MIRROR FAILED` (non-blocking, but track for data divergence)

### Rollback plan
1. `git revert HEAD` on main, push → app. back on Supabase within 2 minutes
2. Flip webhook back: Supabase primary, SQLite secondary
3. Run `migrate_from_supabase.py` to re-sync any SQLite-only grants

### Remaining issues
1. **Stripe API key expired** — Flodesk is the only purchase path. Regenerate when needed
2. **`/v2/api/access-grants` POST endpoint missing** — profile.js references it for manual grant creation
3. **Session/token cleanup** — no cron to expire old auth_tokens and sessions
4. **Email templates generic** — Stripe webhook welcome email uses basic template
5. **Supabase decommission** — keep alive 30 days (until Aug 20), then delete project
