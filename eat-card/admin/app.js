export function splitList(value, separator = '\n') {
  return String(value ?? '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value) {
  return Number.parseInt(String(value ?? '').trim(), 10) || 0;
}

export function buildRecipePayload(formValues) {
  return {
    title: String(formValues.title ?? '').trim(),
    description: String(formValues.description ?? '').trim(),
    budgetCents: toNumber(formValues.budgetCents),
    cookMinutes: toNumber(formValues.cookMinutes),
    servings: toNumber(formValues.servings),
    difficulty: String(formValues.difficulty ?? 'easy').trim(),
    tags: splitList(formValues.tags, ','),
    ingredients: splitList(formValues.ingredients),
    steps: splitList(formValues.steps),
    tips: String(formValues.tips ?? '').trim(),
    status: String(formValues.status ?? 'draft').trim()
  };
}

function readFormValues(form) {
  const data = new FormData(form);

  return Object.fromEntries(data.entries());
}

export async function submitRecipe(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = document.querySelector('#status');
  const token = form.elements.adminToken.value.trim();
  const payload = buildRecipePayload(readFormValues(form));

  status.textContent = 'Saving recipe...';

  try {
    const response = await fetch('/.netlify/functions/admin-recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const recipe = await response.json().catch(() => ({}));
    status.textContent = `Saved ${recipe.title || payload.title}`;
    form.reset();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Unable to save recipe.';
  }
}

if (typeof document !== 'undefined') {
  document.querySelector('#recipeForm')?.addEventListener('submit', submitRecipe);
}
