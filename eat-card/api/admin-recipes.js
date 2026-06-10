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

    const row = fromRecipeInput(input);
    const result = input.id
      ? await supabaseRequest(`recipes?id=eq.${input.id}`, { method: 'PATCH', body: row })
      : await supabaseRequest('recipes', { method: 'POST', body: row });

    return json(200, { recipe: firstRow(result) });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(statusCode, { error: error.message });
  }
}
