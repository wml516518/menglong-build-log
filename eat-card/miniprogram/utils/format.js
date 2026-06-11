function yuan(cents) {
  return Math.round(Number(cents || 0) / 100);
}

function recipeSummary(recipe) {
  if (!recipe) return null;

  return Object.assign({}, recipe, {
    description: recipe.description || '',
    budgetText: recipe.budgetText || `${yuan(recipe.budgetCents)}元`,
    cookTimeText: recipe.cookTimeText || `${recipe.cookMinutes || 0}分钟`,
    servingsText: recipe.servingsText || `${recipe.servings || 0}人`,
    difficultyText: recipe.difficultyText || recipe.difficulty || '未标注',
    tags: recipe.tags || []
  });
}

function recipeDetail(recipe) {
  const summary = recipeSummary(recipe);
  if (!summary) return null;

  return Object.assign({}, summary, {
    ingredients: summary.ingredients || [],
    steps: (summary.steps || []).map((step, index) => ({
      orderText: step && typeof step === 'object' && step.orderText ? step.orderText : `${index + 1}.`,
      text: step && typeof step === 'object' && step.text ? step.text : step
    })),
    tips: summary.tips || ''
  });
}

module.exports = {
  yuan,
  recipeSummary,
  recipeDetail
};
