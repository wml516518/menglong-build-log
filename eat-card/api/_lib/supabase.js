import { getSupabaseConfig } from './env.js';

export class UpstreamError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
  }
}

function parseSupabaseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError('Supabase returned malformed JSON');
  }
}

export async function supabaseRequest(path, { method = 'GET', body } = {}) {
  let config;
  try {
    config = getSupabaseConfig();
  } catch (error) {
    throw new UpstreamError(error.message, 500);
  }

  const { url, serviceRoleKey } = config;
  let response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer: 'return=representation'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new UpstreamError('Unable to reach recipe service', 502);
  }

  const text = await response.text();
  const data = parseSupabaseJson(text);

  if (!response.ok) {
    const message = data?.message || data?.hint || `Supabase request failed with ${response.status}`;
    throw new UpstreamError(message);
  }

  return data;
}
