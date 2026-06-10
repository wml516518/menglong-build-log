import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { supabaseRequest } from './_lib/supabase.js';

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET']);

  try {
    const query = new URLSearchParams();
    query.set('select', 'id,name,type,sort_order');
    query.set('order', 'type.asc,sort_order.asc,name.asc');
    const rows = await supabaseRequest(`tags?${query.toString()}`);
    if (!Array.isArray(rows)) {
      return json(502, { error: 'Invalid tags response' });
    }
    return json(200, {
      tags: rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        sortOrder: row.sort_order
      }))
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(statusCode, { error: error.message });
  }
}
