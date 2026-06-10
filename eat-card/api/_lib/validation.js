export function parsePositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return number;
}

export function parseTags(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseJsonBody(body) {
  if (!body) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Body must be valid JSON');
  }
}

export function validateRecipeInput(input) {
  const errors = {};
  if (!input.title || !String(input.title).trim()) {
    errors.title = 'Title is required';
  }
  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    errors.ingredients = 'At least one ingredient is required';
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    errors.steps = 'At least one step is required';
  }
  if (!['draft', 'published'].includes(input.status)) {
    errors.status = 'Status must be draft or published';
  }
  if (!['easy', 'normal', 'hard'].includes(input.difficulty)) {
    errors.difficulty = 'Difficulty must be easy, normal, or hard';
  }
  if (!Number.isInteger(input.budgetCents) || input.budgetCents < 0) {
    errors.budgetCents = 'Budget must be a non-negative integer';
  }
  if (!Number.isInteger(input.cookMinutes) || input.cookMinutes < 0) {
    errors.cookMinutes = 'Cook minutes must be a non-negative integer';
  }
  if (!Number.isInteger(input.servings) || input.servings <= 0) {
    errors.servings = 'Servings must be a positive integer';
  }
  return errors;
}
