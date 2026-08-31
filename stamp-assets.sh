#!/bin/bash
# stamp-assets.sh — content-hash every local <script src="*.js"> in the portal HTML.
#
# GitHub Pages serves db.js et al with cache-control: max-age=600 and that is not
# configurable. Without a version string a client can run up to 10 minutes of
# stale JS after a deploy. On 2026-08-30 that was a live suspicion when a client
# reported an error the fix had already removed.
#
# Run this after ANY change to a .js file and before committing. Idempotent:
# re-running with no js changes produces no diff.
#
# Usage: bash stamp-assets.sh [--check]
#   --check  exit 1 if any stamp is stale, change nothing (for CI / pre-deploy)

set -euo pipefail
cd "$(dirname "$0")"

CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

STALE=0
for js in *.js; do
    [[ -f "$js" ]] || continue
    hash=$(md5 -q "$js" | cut -c1-8)
    esc=${js//./\\.}
    for html in *.html; do
        grep -qE "src=\"$esc(\?v=[0-9a-f]{8})?\"" "$html" || continue
        if grep -qE "src=\"$esc\?v=$hash\"" "$html"; then continue; fi
        STALE=1
        if $CHECK; then
            echo "STALE: $html references $js without the current hash ($hash)"
        else
            perl -pi -e "s/src=\"$esc(\?v=[0-9a-f]{8})?\"/src=\"$js?v=$hash\"/g" "$html"
            echo "  stamped $html -> $js?v=$hash"
        fi
    done
done

if $CHECK; then
    if [[ $STALE -eq 1 ]]; then
        echo "Asset stamps are stale. Run: bash stamp-assets.sh"
        exit 1
    fi
    echo "Asset stamps: OK"
fi
