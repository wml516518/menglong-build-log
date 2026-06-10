import { getAdminToken } from './_lib/env.js';
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { fromRecipeInput, toRecipeDetail } from './_lib/recipes.js';
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

function buildAdminListPath(params = {}) {
  const query = new URLSearchParams();
  query.set('select', '*');
  query.set('order', 'updated_at.desc');

  const search = String(params.search || '').trim();
  const status = String(params.status || '').trim();
  const tag = String(params.tag || params.tags || '').trim();

  if (search) query.set('title', `ilike.*${search}*`);
  if (['draft', 'published'].includes(status)) query.set('status', `eq.${status}`);
  if (tag) query.set('tags', `cs.{${tag}}`);

  return `recipes?${query.toString()}`;
}

async function listRecipes(event) {
  if (!isAuthorized(event)) return json(401, { error: 'Unauthorized' });

  const rows = await supabaseRequest(buildAdminListPath(event.queryStringParameters || {}));
  if (!Array.isArray(rows)) return json(502, { error: 'Invalid recipe response' });

  return json(200, { recipes: rows.map(toRecipeDetail) });
}

async function saveRecipe(event) {
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
}

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (!['GET', 'POST'].includes(event.httpMethod)) return methodNotAllowed(['GET', 'POST']);

  try {
    if (event.httpMethod === 'GET') return await listRecipes(event);
    return await saveRecipe(event);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(statusCode, { error: error.message });
  }
}
