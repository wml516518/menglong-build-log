import express from 'express';
import { handler as adminRecipes } from '../api/admin-recipes.js';
import { handler as adminRecipesStatus } from '../api/admin-recipes-status.js';
import { handler as aiMeal } from '../api/ai-meal.js';
import { handler as recipesDetail } from '../api/recipes-detail.js';
import { handler as recipesRandom } from '../api/recipes-random.js';
import { handler as tags } from '../api/tags.js';

const app = express();
const port = Number(process.env.PORT || 10000);

app.use(express.json({ limit: '1mb' }));

const routes = new Map([
  ['/api/admin-recipes', adminRecipes],
  ['/api/admin-recipes-status', adminRecipesStatus],
  ['/api/ai-meal', aiMeal],
  ['/api/recipes-detail', recipesDetail],
  ['/api/recipes-random', recipesRandom],
  ['/api/tags', tags]
]);

function toEvent(request) {
  return {
    httpMethod: request.method,
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value])
    ),
    queryStringParameters: Object.fromEntries(
      Object.entries(request.query).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(',') : String(value)
      ])
    ),
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : JSON.stringify(request.body || {})
  };
}

async function sendHandlerResponse(response, handlerResponse) {
  for (const [key, value] of Object.entries(handlerResponse.headers || {})) {
    response.setHeader(key, value);
  }
  response.status(handlerResponse.statusCode || 200);
  response.send(handlerResponse.body || '');
}

for (const [path, handler] of routes.entries()) {
  app.all(path, async (request, response) => {
    try {
      const handlerResponse = await handler(toEvent(request));
      await sendHandlerResponse(response, handlerResponse);
    } catch (error) {
      response.status(500).json({ error: error.message || 'Internal server error' });
    }
  });
}

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'eat-card-api' });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.listen(port, () => {
  console.log(`Eat Card API listening on ${port}`);
});
