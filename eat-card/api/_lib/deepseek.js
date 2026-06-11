import { getDeepSeekConfig } from './env.js';
import { UpstreamError } from './supabase.js';

function parseJson(text, fallbackMessage) {
  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError(fallbackMessage, 502);
  }
}

export async function createMealCompletion(messages) {
  let config;
  try {
    config = getDeepSeekConfig();
  } catch (error) {
    throw new UpstreamError(error.message, 500);
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 900,
        response_format: { type: 'json_object' }
      })
    });
  } catch {
    throw new UpstreamError('Unable to reach AI meal service', 502);
  }

  const text = await response.text();
  const data = parseJson(text, 'AI meal service returned malformed JSON');

  if (!response.ok) {
    const message = data?.error?.message || `AI meal service failed with ${response.status}`;
    throw new UpstreamError(message, 502);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new UpstreamError('AI meal service returned an empty response', 502);
  }

  return parseJson(content, 'AI meal service returned an invalid meal card');
}
