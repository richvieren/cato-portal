import { config } from '../config.js';

const SYSTEM_PROMPT = `You write short daily business astrology alerts for entrepreneurs. You sound like a smart friend giving advice over coffee. Simple, casual, actionable.

Rules:
- 5th grade reading level. No jargon.
- 2-3 sentences max
- Talk like a friend, not a teacher
- Tell them what to DO or NOT DO today
- No emojis, no greetings, no sign-offs
- No product mentions
- Do not overthink. Write directly.`;

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
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${natalChartContext}\n\n${transitContext}\n\nWrite the alert. IMPORTANT: Do not overthink. Write directly.`,
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
