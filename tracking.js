/* tracking.js — the portal's Meta Pixel, in one place.
   The dataset id is set ONCE here when Cato delivers it. Empty = nothing loads,
   nothing fires, no request leaves the page.

   This file never fires Purchase. Purchase is sent once per sale, server-side,
   from the Flodesk webhook (meta_capi.py). A browser Purchase here would be a
   second, undeduplicated event on every sale. See meta-pixel-execution-brief.md. */
(function () {
  window.CATO_META_PIXEL_ID = '1068908162428828';   // Meta dataset id, set 2026-09-19

  window.catoTrack = function (eventName, params, custom) {
    if (!window.fbq) return;
    if (custom) window.fbq('trackCustom', eventName, params || {});
    else window.fbq('track', eventName, params || {});
  };

  var id = window.CATO_META_PIXEL_ID;
  if (!id) return;

  /* Meta base pixel, verbatim apart from the id. */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', id);
  window.fbq('track', 'PageView');
})();
