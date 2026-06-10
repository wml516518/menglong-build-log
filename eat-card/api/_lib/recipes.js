export function toRecipeCard(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    budgetCents: row.budget_cents,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    difficulty: row.difficulty,
    tags: row.tags || [],
    tips: row.tips
  };
}

export function toRecipeDetail(row) {
  return {
    ...toRecipeCard(row),
    ingredients: row.ingredients || [],
    steps: row.steps || [],
    status: row.status
  };
}

export function fromRecipeInput(input) {
  return {
    title: String(input.title).trim(),
    description: String(input.description || '').trim(),
    budget_cents: input.budgetCents,
    cook_minutes: input.cookMinutes,
    servings: input.servings,
    difficulty: input.difficulty,
    tags: Array.isArray(input.tags) ? input.tags : [],
    ingredients: input.ingredients,
    steps: input.steps,
    tips: String(input.tips || '').trim(),
    status: input.status
  };
}
