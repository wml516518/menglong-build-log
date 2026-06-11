import { createMealCompletion } from './_lib/deepseek.js';
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { parseJsonBody } from './_lib/validation.js';

const MAX_TEXT_LENGTH = 240;

function toNonNegativeInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function normalizeInput(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    budgetCents: toNonNegativeInt(source.budgetCents, 0),
    cookMinutes: toNonNegativeInt(source.cookMinutes, 0),
    servings: Math.max(1, toNonNegativeInt(source.servings, 1)),
    preferences: Array.isArray(source.preferences)
      ? source.preferences.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [],
    ingredients: String(source.ingredients || '').trim(),
    restrictions: String(source.restrictions || '').trim()
  };
}

function validateInput(input) {
  const errors = {};
  if (input.ingredients.length > MAX_TEXT_LENGTH) {
    errors.ingredients = `Ingredients must be ${MAX_TEXT_LENGTH} characters or less`;
  }
  if (input.restrictions.length > MAX_TEXT_LENGTH) {
    errors.restrictions = `Restrictions must be ${MAX_TEXT_LENGTH} characters or less`;
  }
  return errors;
}

function buildMessages(input) {
  return [
    {
      role: 'system',
      content: [
        'You generate practical home-cooking meal ideas in Simplified Chinese.',
        'Return only one JSON object. Do not include markdown.',
        'Do not make medical, therapeutic, or guaranteed health claims.',
        'The JSON object must include: title, reason, budgetCents, cookMinutes, servings, difficulty, tags, ingredients, steps, tips.',
        'ingredients and steps must be arrays of short strings. difficulty must be easy, normal, or hard.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        budgetCents: input.budgetCents,
        cookMinutes: input.cookMinutes,
        servings: input.servings,
        preferences: input.preferences,
        ingredients: input.ingredients,
        restrictions: input.restrictions
      })
    }
  ];
}

function normalizeMeal(meal, input) {
  if (!meal || typeof meal !== 'object' || Array.isArray(meal)) {
    throw Object.assign(new Error('AI meal card is not an object'), { statusCode: 502 });
  }

  return {
    title: String(meal.title || 'AI 推荐菜').trim(),
    reason: String(meal.reason || '').trim(),
    budgetCents: toNonNegativeInt(meal.budgetCents, input.budgetCents),
    cookMinutes: toNonNegativeInt(meal.cookMinutes, input.cookMinutes),
    servings: Math.max(1, toNonNegativeInt(meal.servings, input.servings)),
    difficulty: ['easy', 'normal', 'hard'].includes(meal.difficulty) ? meal.difficulty : 'easy',
    tags: Array.isArray(meal.tags) ? meal.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8) : [],
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
      : [],
    steps: Array.isArray(meal.steps)
      ? meal.steps.map((item) => String(item).trim()).filter(Boolean).slice(0, 10)
      : [],
    tips: String(meal.tips || 'AI 内容仅供参考，请根据实际食材和安全烹饪判断。').trim()
  };
}

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST']);

  try {
    const input = normalizeInput(parseJsonBody(event.body));
    const errors = validateInput(input);
    if (Object.keys(errors).length > 0) {
      return json(422, { errors });
    }

    const meal = await createMealCompletion(buildMessages(input));
    return json(200, { meal: normalizeMeal(meal, input) });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message });
  }
}
