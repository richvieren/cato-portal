// send-ready-email — Sends "your reading is ready" email via Resend.
// Called by VPS after PDF upload. Authenticated via service role key.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = 'Cato Vermeulen <noreply@mail.catovermeulen.com>';
const PORTAL_URL = 'https://app.catovermeulen.com';
const TELEGRAM_BOT_URL = 'https://t.me/catcaitbot';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUPPORT_LINE = `<p style="color:#999;font-size:0.85em;margin-top:32px">Something not working? Email <a href="mailto:hello@catovermeulen.com" style="color:#9F8261">hello@catovermeulen.com</a></p>`;

interface ReadyEmailRequest {
  email: string;
  name: string;
  product: 'blueprint' | 'transit_reading' | 'astrocartography';
  download_url: string;
}

function buildEmail(req: ReadyEmailRequest): { subject: string; html: string } {
  const firstName = req.name.split(' ')[0] || 'babe';

  if (req.product === 'blueprint') {
    return {
      subject: `${firstName}, your Blueprint is ready`,
      html: `
        <p>Hey ${firstName},</p>
        <p>Your Category of One Blueprint is done. I went deep on your chart.</p>
        <p style="margin:24px 0">
          <a href="${req.download_url}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Download your Blueprint</a>
        </p>
        <p style="font-size:0.9em;color:#666">This link expires in 7 days. You can always re-download from your portal:<br>
        <a href="${PORTAL_URL}" style="color:#9F8261">${PORTAL_URL}</a></p>
        <p>Read it once all the way through. Let it land. Then come back to it whenever you need clarity or direction.</p>
        <p>Can't wait to hear what resonates.</p>
        <p>Cato</p>
        ${SUPPORT_LINE}
      `,
    };
  }

  if (req.product === 'transit_reading') {
    return {
      subject: `${firstName}, your Transits Reading is ready`,
      html: `
        <p>Hey ${firstName},</p>
        <p>Your Transits Reading is done. I mapped out what's activating your chart and when to move.</p>
        <p style="margin:24px 0">
          <a href="${req.download_url}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Download your Transits Reading</a>
        </p>
        <p style="font-size:0.9em;color:#666">This link expires in 7 days. You can always re-download from your portal:<br>
        <a href="${PORTAL_URL}" style="color:#9F8261">${PORTAL_URL}</a></p>
        <p>One more thing. I built a Telegram bot that sends you transit alerts based on your chart. Whenever a transit is hitting your chart, you get a message so you know exactly when to move and when to wait. Free for reading clients.</p>
        <p style="margin:20px 0">
          <a href="${TELEGRAM_BOT_URL}" style="color:#9F8261;font-weight:500">Start the bot on Telegram &rarr;</a>
        </p>
        <p>Cato</p>
        ${SUPPORT_LINE}
      `,
    };
  }

  // astrocartography
  return {
    subject: `${firstName}, your Astrocartography Reading is ready`,
    html: `
      <p>Hey ${firstName},</p>
      <p>Your Astrocartography Reading is done. I went deep on every city you listed and mapped your chart across the globe.</p>
      <p style="margin:24px 0">
        <a href="${req.download_url}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Download your Reading</a>
      </p>
      <p style="font-size:0.9em;color:#666">This link expires in 7 days. You can always re-download from your portal:<br>
      <a href="${PORTAL_URL}" style="color:#9F8261">${PORTAL_URL}</a></p>
      <p>Read it once all the way through. Let it land. Then come back to it whenever you're planning a move, a trip, or a retreat.</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Auth handled by Supabase gateway — service role key required in Authorization header

  const body: ReadyEmailRequest = await req.json();

  if (!body.email || !body.product || !body.download_url) {
    return new Response(JSON.stringify({ error: 'Missing required fields: email, product, download_url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const { subject, html } = buildEmail(body);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: body.email,
      subject,
      html,
    }),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error('Resend error:', result);
    return new Response(JSON.stringify({ error: 'Email send failed', detail: result }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  console.log(`Ready email sent: ${body.product} -> ${body.email} (${res.status})`);

  return new Response(JSON.stringify({ ok: true, resend_id: result.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
});
