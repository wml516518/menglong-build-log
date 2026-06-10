import { getAdminToken } from './_lib/env.js';
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { fromRecipeInput } from './_lib/recipes.js';
import { supabaseRequest } from './_lib/supabase.js';
import { parseJsonBody, validateRecipeInput } from './_lib/validation.js';

function isAuthorized(event) {
  return event.headers?.['x-admin-token'] === getAdminToken();
}

function firstRow(result) {
  return Array.isArray(result) ? result[0] : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST']);

  try {
    if (!isAuthorized(event)) return json(401, { error: 'Unauthorized' });

    const input = parseJsonBody(event.body);
    const errors = validateRecipeInput(input);
    if (Object.keys(errors).length > 0) {
      return json(422, { errors });
    }
    if (input.id && !isUuid(input.id)) {
      return json(422, { errors: { id: 'id must be a valid UUID' } });
    }

    const row = fromRecipeInput(input);
    const result = input.id
      ? await supabaseRequest(`recipes?id=eq.${encodeURIComponent(input.id)}`, { method: 'PATCH', body: row })
      : await supabaseRequest('recipes', { method: 'POST', body: row });

    const recipe = firstRow(result);
    if (!recipe) return json(502, { error: 'Invalid recipe response' });

    return json(200, { recipe });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(statusCode, { error: error.message });
  }
}
