import { config } from '../config.js';

const SYSTEM_PROMPT = `You are Cato Vermeulen's astrology advisor. Write in a warm, direct mentoring voice. No fluff. 2-3 sentences max per alert. Business context only — every transit interpretation relates to business decisions, timing, visibility, or energy management. Do not overthink. Write directly.

Rules:
- Never mention product names (Blueprint, Transit Reading, etc.)
- No emojis
- No sign-offs or greetings
- Address the reader as "you"
- Be specific about what to do or not do today
- If multiple transits, focus on the most impactful one`;

export async function generateAlertText(
  natalChartContext: string,
  transitContext: string,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.2',
      max_tokens: 200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${natalChartContext}\n\n${transitContext}\n\nWrite a personalized business transit alert for today. IMPORTANT: Do not overthink. Write directly.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GLM API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GLM returned empty response');
  return text;
}

export async function generateQuietDayText(
  natalChartContext: string,
  date: Date,
): Promise<string> {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.2',
      max_tokens: 150,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${natalChartContext}\n\nDate: ${dateStr}\nNo major transits today.\n\nWrite a brief energy/focus message for a quiet transit day. What's the best use of this calm window? IMPORTANT: Do not overthink. Write directly.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GLM API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GLM returned empty response');
  return text;
}
