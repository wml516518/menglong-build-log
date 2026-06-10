import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { parsePositiveInt, parseTags } from './_lib/validation.js';
import { toRecipeCard } from './_lib/recipes.js';
import { supabaseRequest } from './_lib/supabase.js';

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET']);

  try {
    const params = event.queryStringParameters || {};
    const maxBudgetCents = parsePositiveInt(params.maxBudgetCents, 'maxBudgetCents');
    const maxCookMinutes = parsePositiveInt(params.maxCookMinutes, 'maxCookMinutes');
    const servings = parsePositiveInt(params.servings, 'servings');
    const tags = parseTags(params.tags);

    const query = new URLSearchParams();
    query.set('select', 'id,title,description,budget_cents,cook_minutes,servings,difficulty,tags,tips');
    query.set('status', 'eq.published');
    if (maxBudgetCents !== undefined) query.set('budget_cents', `lte.${maxBudgetCents}`);
    if (maxCookMinutes !== undefined) query.set('cook_minutes', `lte.${maxCookMinutes}`);
    if (servings !== undefined) query.set('servings', `eq.${servings}`);
    for (const tag of tags) {
      query.append('tags', `cs.{${tag}}`);
    }

    const rows = await supabaseRequest(`recipes?${query.toString()}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      return json(404, { error: 'No matching recipe found' });
    }

    const index = Math.floor(Math.random() * rows.length);
    return json(200, { recipe: toRecipeCard(rows[index]) });
  } catch (error) {
    return json(error.statusCode || 400, { error: error.message });
  }
}
