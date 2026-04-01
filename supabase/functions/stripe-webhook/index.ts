import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const APP_URL = 'https://app.catovermeulen.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

async function generateMagicLink(email: string): Promise<string> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: APP_URL }
  });
  if (error) throw error;
  return data.properties.action_link;
}

async function sendWelcomeEmail(email: string, magicLink: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Cato Vermeulen <noreply@mail.catovermeulen.com>',
      to: email,
      subject: 'Your Blueprint Portal Access',
      html: `
        <p>Your payment went through. Here is what happens next.</p>

        <p><strong>Step 1 — Enter your portal</strong><br>
        Click the link below. It takes you straight in.<br>
        <a href="${magicLink}" style="color:#9F8261">Enter your portal →</a></p>

        <p><strong>Step 2 — Fill in your details</strong><br>
        Your reading is built on your birth data and your business context. Take 5 minutes to fill in the form accurately. The quality of the reading depends on it.</p>

        <p><strong>Step 3 — Your reading is prepared</strong><br>
        Once you've submitted, Cato gets to work. Your Blueprint will be ready within 24 hours.</p>

        <p><strong>Step 4 — Download your Blueprint</strong><br>
        You'll find it waiting in your portal. A full PDF, yours to keep.</p>

        <p style="color:#888;font-size:0.85em">This link expires in 24 hours. If you didn't purchase a Blueprint, you can ignore this email.</p>
        <p>— Cato</p>
      `
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend error: ${JSON.stringify(body)}`);
  }
}

Deno.serve(async (req) => {
  // Always return 200 to Stripe for business logic errors to prevent retries.
  // Exception: return 400 on bad signature — Stripe does not retry on 4xx,
  // and a bad signature means the request is not from Stripe.
  const respond = (status = 200) =>
    new Response('OK', { status });

  if (req.method !== 'POST') return respond(405);

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err);
    return respond(400);
  }

  if (event.type !== 'checkout.session.completed') {
    return respond(200);
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const email = (
    session.customer_details?.email ?? session.customer_email ?? ''
  ).toLowerCase();
  const sessionId = session.id;

  if (!email) {
    console.error('No email in Stripe session:', sessionId);
    return respond(200);
  }

  const supabase = supabaseAdmin();

  // Upsert access_grants — UNIQUE on stripe_session_id prevents duplicate grants on Stripe retries
  const { error: grantErr } = await supabase.from('access_grants').upsert({
    email,
    product: 'blueprint',
    stripe_session_id: sessionId,
    available_at: null,  // set when intake form submitted
  }, { onConflict: 'stripe_session_id' });

  if (grantErr) {
    console.error('access_grants upsert error:', grantErr);
    return respond(200);
  }

  console.log('Access granted:', email, sessionId);

  // Generate magic link + send welcome email
  try {
    const magicLink = await generateMagicLink(email);
    await sendWelcomeEmail(email, magicLink);
    console.log('Welcome email sent to:', email);
  } catch (err) {
    console.error('Magic link / email error:', err);
    // Not fatal — grant already written, client can still log in manually
  }

  return respond(200);
});
