import { getAdminToken } from './_lib/env.js';
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { supabaseRequest } from './_lib/supabase.js';
import { parseJsonBody } from './_lib/validation.js';

function isAuthorized(event) {
  return event.headers?.['x-admin-token'] === getAdminToken();
}

function firstRow(result) {
  return Array.isArray(result) ? result[0] : null;
}

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST']);

  try {
    if (!isAuthorized(event)) return json(401, { error: 'Unauthorized' });

    const input = parseJsonBody(event.body);
    if (!input.id) return json(422, { errors: { id: 'id is required' } });
    if (!['draft', 'published'].includes(input.status)) {
      return json(422, { errors: { status: 'Status must be draft or published' } });
    }

    const result = await supabaseRequest(`recipes?id=eq.${input.id}`, {
      method: 'PATCH',
      body: { status: input.status }
    });

    return json(200, { recipe: firstRow(result) });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(statusCode, { error: error.message });
  }
}
