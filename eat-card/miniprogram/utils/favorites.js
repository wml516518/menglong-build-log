const KEY = 'eat-card:favorites';

function getFavorites() {
  return wx.getStorageSync(KEY) || [];
}

function saveFavorites(favorites) {
  wx.setStorageSync(KEY, favorites);
}

function isFavorite(id) {
  return getFavorites().some((item) => item.id === id);
}

function addFavorite(recipe) {
  const favorites = getFavorites().filter((item) => item.id !== recipe.id);
  favorites.unshift({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    budgetCents: recipe.budgetCents,
    budgetText: recipe.budgetText,
    cookMinutes: recipe.cookMinutes,
    cookTimeText: recipe.cookTimeText,
    servings: recipe.servings,
    servingsText: recipe.servingsText,
    tags: recipe.tags || []
  });
  saveFavorites(favorites);
}

function removeFavorite(id) {
  saveFavorites(getFavorites().filter((item) => item.id !== id));
}

module.exports = {
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite
};
