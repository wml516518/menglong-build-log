import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { toRecipeDetail } from './_lib/recipes.js';
import { supabaseRequest } from './_lib/supabase.js';

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET']);

  const id = event.queryStringParameters?.id;
  if (!id) {
    return json(400, { error: 'id is required' });
  }

  try {
    const query = new URLSearchParams();
    query.set('select', '*');
    query.set('id', `eq.${id}`);
    query.set('status', 'eq.published');
    query.set('limit', '1');
    const rows = await supabaseRequest(`recipes?${query.toString()}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      return json(404, { error: 'Recipe not found' });
    }
    return json(200, { recipe: toRecipeDetail(rows[0]) });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(statusCode, { error: error.message });
  }
}
