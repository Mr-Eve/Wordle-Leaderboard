import 'dotenv/config';

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || process.env.YOUR_OPENAI_API_KEY;
}

function truncateForDiscord(text, maxLen) {
  if (!text) return '';
  const s = String(text);
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 12)) + '\n\n…(truncated)';
}

export async function askAI(question) {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY (or YOUR_OPENAI_API_KEY) in your .env');
  }

  const prompt = String(question || '').trim();
  if (!prompt) {
    throw new Error('Question cannot be empty');
  }

  // Use the Responses API (fast + simple).
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You are a helpful assistant. Keep answers concise and accurate.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      max_output_tokens: 400,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  // Standard field for Responses API
  const outputText = data && data.output_text ? data.output_text : '';
  return truncateForDiscord(outputText, 1900);
}


