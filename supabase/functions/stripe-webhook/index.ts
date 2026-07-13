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

const SUPPORT_LINE = `<p style="color:#999;font-size:0.85em;margin-top:32px">Something not working? Email <a href="mailto:hello@catovermeulen.com" style="color:#9F8261">hello@catovermeulen.com</a> with a description of what's happening, any error messages you see, and the email address you used to purchase. We'll sort it out.</p>`;

const FALLBACK_LINE = `<p style="font-size:0.85em;color:#666">If the link doesn't work or has expired, go to <a href="https://app.catovermeulen.com" style="color:#9F8261">app.catovermeulen.com</a>, enter your email, and we'll send you a fresh one. Check your spam folder if you don't see it within a minute.</p>`;

const EMAIL_TEMPLATES: Record<string, (link: string) => { subject: string; html: string }> = {
  blueprint: (link) => ({
    subject: 'Your Blueprint Portal Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your reading.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your portal</a></p>
      ${FALLBACK_LINE}

      <p><strong>Step 2: Fill in your details</strong><br>
      Once you're logged in, you'll see your reading card. Click on it and fill in the form. You'll need your exact date of birth, time of birth, and city of birth. Then answer the business questions. Be specific and take your time. The more detail you give, the deeper your reading goes.</p>

      <p><strong>Step 3: Your reading is created</strong><br>
      After you submit, your reading is generated. This takes up to 48 hours. You'll get an email the moment it's done.</p>

      <p><strong>Step 4: Download your reading</strong><br>
      When you get that email, go to <a href="https://app.catovermeulen.com" style="color:#9F8261">app.catovermeulen.com</a>, enter your email to get a login link, and your PDF will be waiting in your portal.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),

  mini_reading: (link) => ({
    subject: 'Your Business Astrology Roadmap Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your reading.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your portal</a></p>
      ${FALLBACK_LINE}

      <p><strong>Step 2: Fill in your birth details</strong><br>
      Once you're logged in, you'll see your reading card. Click on it and fill in your birth date, time, and place accurately.</p>

      <p><strong>Step 3: Download your reading</strong><br>
      Once you've submitted, your Business Astrology Roadmap is generated immediately. You'll find it waiting in your portal as a PDF to download and keep.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),

  transit_reading: (link) => ({
    subject: 'Your Transits Reading Portal Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your reading.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your portal</a></p>
      ${FALLBACK_LINE}

      <p><strong>Step 2: Fill in your details</strong><br>
      Once you're logged in, you'll see your reading card. Click on it and fill in the form. You'll need your exact date of birth, time of birth, and city of birth. Then answer the business questions. Be specific and take your time. The more detail you give on your launches and offers, the more precise your timing guidance will be.</p>

      <p><strong>Step 3: Your reading is created</strong><br>
      After you submit, your reading is generated. This takes up to 48 hours. You'll get an email the moment it's done.</p>

      <p><strong>Step 4: Download your reading</strong><br>
      When you get that email, go to <a href="https://app.catovermeulen.com" style="color:#9F8261">app.catovermeulen.com</a>, enter your email to get a login link, and your PDF will be waiting in your portal.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),

  astrocartography: (link) => ({
    subject: 'Your Astrocartography Reading Portal Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your reading.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your portal</a></p>
      ${FALLBACK_LINE}

      <p><strong>Step 2: Fill in your details</strong><br>
      Once you're logged in, you'll see your reading card. Click on it and fill in the form. You'll need your exact date of birth, time of birth, and city of birth. Then list the cities you want analyzed. Include the country for each city so your chart can be mapped accurately.</p>

      <p><strong>Step 3: Your reading is created</strong><br>
      After you submit, your reading is generated. This takes up to 48 hours. You'll get an email the moment it's done.</p>

      <p><strong>Step 4: Download your reading</strong><br>
      When you get that email, go to <a href="https://app.catovermeulen.com" style="color:#9F8261">app.catovermeulen.com</a>, enter your email to get a login link, and your PDF will be waiting in your portal.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),

  cosmic_profile: (link) => ({
    subject: 'Your Cosmic Profile Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your cosmic profile.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your portal</a></p>
      ${FALLBACK_LINE}

      <p><strong>Step 2: Fill in your birth details</strong><br>
      Once you're logged in, you'll see a form asking for your date, time, and place of birth. Fill it in accurately. That's all you need.</p>

      <p><strong>Step 3: Explore your profile</strong><br>
      Your natal chart, planet placements, element balance, business lens, and more. It's all there, instantly.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),

  course: (link) => ({
    subject: 'Your Introduction Course Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your course.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your course</a></p>
      ${FALLBACK_LINE}

      <p>Inside you'll find all 6 modules of the Astrology Business Reading Introduction Course. It's self-paced, with progress tracking so you can pick up where you left off.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),
};

async function sendWelcomeEmail(email: string, magicLink: string, product: string): Promise<void> {
  const template = EMAIL_TEMPLATES[product] ?? EMAIL_TEMPLATES['blueprint'];
  const { subject, html } = template(magicLink);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Cato Vermeulen <noreply@mail.catovermeulen.com>',
      to: email,
      subject,
      html,
    }),
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

  // Determine product: check metadata first, then match Stripe price ID
  const PRICE_TO_PRODUCT: Record<string, string> = {
    'price_1SdnYPPDOFXTchBMnw3MtZgz': 'blueprint',
    'price_1TGxqyPDOFXTchBMddOzggCy': 'mini_reading',
    'price_1TGxxePDOFXTchBMSohT0suK': 'course',
    'price_1SlAcFPDOFXTchBMxKJwlS00': 'transit_reading',
    'price_1TeywIPDOFXTchBMB95vEfZN': 'astrocartography',
    // cosmic_profile: add Stripe price ID here once created
    // 'price_XXXXX': 'cosmic_profile',
  };

  let product = (session.metadata?.product as string) || '';

  // If no metadata, look up product by Stripe price ID from line items
  if (!product) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      if (priceId && PRICE_TO_PRODUCT[priceId]) {
        product = PRICE_TO_PRODUCT[priceId];
      }
    } catch (err) {
      console.error('Failed to fetch line items:', err);
    }
  }

  // No fallback — if product is unknown, ignore this event
  if (!product) {
    console.log('Unknown product for session:', sessionId, '— skipping');
    return respond(200);
  }

  // available_at: null for blueprint (set on intake submit) and mini_reading (set on intake submit)
  // course has no intake, so we set available_at immediately
  const available_at = (product === 'course' || product === 'cosmic_profile') ? new Date().toISOString() : null;

  const supabase = supabaseAdmin();

  // Upsert access_grants — UNIQUE on stripe_session_id prevents duplicate grants on Stripe retries
  const { error: grantErr } = await supabase.from('access_grants').upsert({
    email,
    product,
    stripe_session_id: sessionId,
    available_at,
  }, { onConflict: 'stripe_session_id' });

  if (grantErr) {
    console.error('access_grants upsert error:', grantErr);
    return respond(200);
  }

  console.log('Access granted:', email, product, sessionId);

  // Notify Telegram with payment details
  try {
    const amountPaid = ((session.amount_total ?? 0) / 100).toFixed(2);
    const currency = (session.currency ?? 'usd').toUpperCase();
    const discount = ((session.total_details?.amount_discount ?? 0) / 100).toFixed(2);
    const customerName = session.customer_details?.name ?? email;
    const coupon = session.discounts?.[0]?.coupon?.name ?? '';

    let msg = `💰 New purchase: ${customerName}\nProduct: ${product}\nPaid: ${currency} ${amountPaid}`;
    if (parseFloat(discount) > 0) {
      msg += `\nDiscount: ${currency} ${discount}`;
      if (coupon) msg += ` (${coupon})`;
    }
    if (parseFloat(amountPaid) === 0) {
      msg += `\n⚠️ 100% discount — free`;
    }

    const TELEGRAM_BOT_TOKEN = '8612517573:AAEuEgVAr6hjsA0nldPU7mdH1iq3JE9aGIE';
    const chatIds = ['1168464793', '1479373068'];
    for (const chatId of chatIds) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg }),
      });
    }
  } catch (err) {
    console.error('Telegram notification error:', err);
  }

  // Generate magic link + send welcome email
  try {
    const magicLink = await generateMagicLink(email);
    await sendWelcomeEmail(email, magicLink, product);
    console.log('Welcome email sent to:', email, 'for product:', product);
  } catch (err) {
    console.error('Magic link / email error:', err);
    // Not fatal — grant already written, client can still log in manually
  }

  return respond(200);
});
