export function splitList(value, separator = '\n') {
  return String(value ?? '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

const fieldLabels = {
  id: 'Id',
  title: 'Title',
  description: 'Description',
  budgetCents: 'Budget cents',
  cookMinutes: 'Cook minutes',
  servings: 'Servings',
  difficulty: 'Difficulty',
  tags: 'Tags',
  ingredients: 'Ingredients',
  steps: 'Steps',
  tips: 'Tips',
  status: 'Status'
};

function toNumber(value) {
  return Number.parseInt(String(value ?? '').trim(), 10) || 0;
}

export function buildRecipePayload(formValues) {
  const payload = {
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

  const id = String(formValues.id ?? '').trim();
  if (id) payload.id = id;

  return payload;
}

function readFormValues(form) {
  const data = new FormData(form);

  return Object.fromEntries(data.entries());
}

function getToken() {
  return document.querySelector('#adminToken')?.value.trim() || '';
}

function setStatus(message) {
  const status = document.querySelector('#status');
  if (status) status.textContent = message;
}

export function formatFieldErrors(errors = {}) {
  return Object.entries(errors)
    .map(([field, message]) => `${fieldLabels[field] || field}: ${message}`)
    .join('\n');
}

function recipeToFormValues(recipe) {
  return {
    id: recipe.id || '',
    title: recipe.title || '',
    description: recipe.description || '',
    budgetCents: recipe.budgetCents ?? '',
    cookMinutes: recipe.cookMinutes ?? '',
    servings: recipe.servings ?? '',
    difficulty: recipe.difficulty || 'easy',
    tags: (recipe.tags || []).join(','),
    ingredients: (recipe.ingredients || []).join('\n'),
    steps: (recipe.steps || []).join('\n'),
    tips: recipe.tips || '',
    status: recipe.status || 'draft'
  };
}

export function loadRecipeIntoForm(recipe, form = document.querySelector('#recipeForm')) {
  if (!form) return;

  const values = recipeToFormValues(recipe);
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements[name];
    if (field) field.value = value;
  }

  setStatus(`Editing ${values.title || 'recipe'}`);
}

function renderRecipes(recipes) {
  const list = document.querySelector('#recipeList');
  if (!list) return;

  list.innerHTML = '';
  if (recipes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No recipes found.';
    list.append(empty);
    return;
  }

  for (const recipe of recipes) {
    const card = document.createElement('article');
    card.className = 'recipe-card';

    const title = document.createElement('h3');
    title.textContent = recipe.title || 'Untitled recipe';

    const meta = document.createElement('p');
    meta.className = 'recipe-meta';
    meta.textContent = `${recipe.status || 'draft'} · ${(recipe.tags || []).join(', ') || 'No tags'}`;

    const actions = document.createElement('div');
    actions.className = 'recipe-card-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => loadRecipeIntoForm(recipe));

    const toggle = document.createElement('button');
    toggle.type = 'button';
    const nextStatus = recipe.status === 'published' ? 'draft' : 'published';
    toggle.textContent = nextStatus === 'published' ? 'Publish' : 'Draft';
    toggle.addEventListener('click', () => updateRecipeStatus(recipe.id, nextStatus));

    actions.append(edit, toggle);
    card.append(title, meta, actions);
    list.append(card);
  }
}

export async function loadRecipes() {
  const params = new URLSearchParams();
  const search = document.querySelector('#recipeSearch')?.value.trim();
  const status = document.querySelector('#recipeStatusFilter')?.value;
  const tag = document.querySelector('#recipeTagFilter')?.value.trim();

  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (tag) params.set('tag', tag);

  setStatus('Loading recipes...');

  try {
    const query = params.toString();
    const response = await fetch(`/.netlify/functions/admin-recipes${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: {
        'x-admin-token': getToken()
      }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    renderRecipes(Array.isArray(data.recipes) ? data.recipes : []);
    setStatus(`Loaded ${(data.recipes || []).length} recipes`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to load recipes.');
  }
}

export async function updateRecipeStatus(id, status) {
  setStatus('Updating status...');

  try {
    const response = await fetch('/.netlify/functions/admin-recipes-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': getToken()
      },
      body: JSON.stringify({ id, status })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data.errors) throw new Error(formatFieldErrors(data.errors));
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    setStatus(`Updated ${data.recipe?.title || 'recipe'} to ${status}`);
    await loadRecipes();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to update status.');
  }
}

export async function submitRecipe(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const token = form.elements.adminToken.value.trim();
  const payload = buildRecipePayload(readFormValues(form));

  setStatus('Saving recipe...');

  try {
    const response = await fetch('/.netlify/functions/admin-recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data.errors) throw new Error(formatFieldErrors(data.errors));
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    const recipe = data.recipe || data;
    setStatus(`Saved ${recipe.title || payload.title}`);
    form.reset();
    if (document.querySelector('#recipeList')) await loadRecipes();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to save recipe.');
  }
}

if (typeof document !== 'undefined') {
  document.querySelector('#recipeForm')?.addEventListener('submit', submitRecipe);
  document.querySelector('#loadRecipes')?.addEventListener('click', loadRecipes);
}
